import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { oneTap } from 'better-auth/plugins';
import { getLocale } from 'next-intl/server';

import { db } from '@/core/db';
import { envConfigs } from '@/config';
import * as schema from '@/config/db/schema';
import { VerifyEmail } from '@/shared/blocks/email/verify-email';
import {
  getCookieFromCtx,
  getHeaderValue,
  guessLocaleFromAcceptLanguage,
} from '@/shared/lib/cookie';
import { getUuid } from '@/shared/lib/hash';
import { getClientIp } from '@/shared/lib/ip';
import { grantCreditsForNewUser } from '@/shared/models/credit';
import { getEmailService } from '@/shared/services/email';
import { createUserForSignup } from '@/shared/services/newapi';
import { grantRoleForNewUser } from '@/shared/services/rbac';

// 尽力去重，避免验证码邮件被过于频繁地发送。
// 这在开发/热更新、瞬时网络抖动场景下尤其有用，
// 同时作为客户端冷却之外的服务端限流保护。
const recentVerificationEmailSentAt = new Map<string, number>();
const VERIFICATION_EMAIL_MIN_INTERVAL_MS = 60_000;

// 静态认证选项：不建立数据库连接
// 确保构建阶段不会触发任何数据库调用
const authOptions = {
  appName: envConfigs.app_name,
  baseURL: envConfigs.auth_url,
  secret: envConfigs.auth_secret,
  trustedOrigins: envConfigs.app_url ? [envConfigs.app_url] : [],
  user: {
    // 允许持久化 user 表中的自定义字段。
    // 否则 better-auth 在 create/update 时可能会忽略这些额外属性。
    additionalFields: {
      utmSource: {
        type: 'string',
        // 不是用户可编辑输入；由服务端内部写入。
        input: false,
        required: false,
        defaultValue: '',
      },
      ip: {
        type: 'string',
        input: false,
        required: false,
        defaultValue: '',
      },
      locale: {
        type: 'string',
        input: false,
        required: false,
        defaultValue: '',
      },
      newapiUsername: {
        type: 'string',
        input: false,
        required: false,
        defaultValue: '',
      },
      newapiUserPass: {
        type: 'string',
        input: false,
        required: false,
        defaultValue: '',
      },
      newapiUserId: {
        type: 'string',
        input: false,
        required: false,
        defaultValue: '',
      },
      newapiAccessToken: {
        type: 'string',
        input: false,
        required: false,
        defaultValue: '',
      },
      newapiUserDefaultToken: {
        type: 'string',
        input: false,
        required: false,
        defaultValue: '',
      },
    },
  },
  advanced: {
    database: {
      generateId: () => getUuid(),
    },
  },
  emailAndPassword: {
    enabled: true,
  },
  logger: {
    verboseLogging: false,
    // 在构建和生产环境关闭所有日志
    disabled: true,
  },
};

// 根据配置生成认证选项
export async function getAuthOptions(configs: Record<string, string>) {
  const emailVerificationEnabled =
    configs.email_verification_enabled === 'true' && !!configs.resend_api_key;

  return {
    ...authOptions,
    // 仅在运行时确实需要时才注入数据库连接
    database: envConfigs.database_url
      ? drizzleAdapter(db(), {
        provider: getDatabaseProvider(envConfigs.database_provider),
        schema: schema,
      })
      : null,
    databaseHooks: {
      user: {
        create: {
          before: async (user: any, ctx: any) => {
            // 注册前必须先在 New API 侧创建用户；失败则中断注册
            if (!user.id) {
              user.id = getUuid();
            }
            if (!user.email) {
              throw new Error('user email is required');
            }

            console.log('[auth] before create user: sync newapi user', {
              id: user.id,
              email: user.email,
            });

            const newApiUser = await createUserForSignup();
            user.newapiUsername = newApiUser.newapiUsername;
            user.newapiUserPass = newApiUser.newapiUserPass;
            user.newapiUserId = newApiUser.newapiUserId;
            user.newapiAccessToken = newApiUser.newapiAccessToken;
            user.newapiUserDefaultToken = newApiUser.newapiUserDefaultToken;

            try {
              const ip = await getClientIp();
              if (ip) {
                user.ip = ip;
              }

              // 优先使用 NEXT_LOCALE（next-intl）cookie，兜底使用 accept-language。
              const localeFromCookie = getCookieFromCtx(ctx, 'NEXT_LOCALE');

              const localeFromHeader = guessLocaleFromAcceptLanguage(
                getHeaderValue(ctx, 'accept-language')
              );

              const locale =
                (localeFromCookie || localeFromHeader || (await getLocale())) ??
                '';

              if (locale && typeof locale === 'string') {
                user.locale = locale.slice(0, 20);
              }

              // 仅在首次创建时写入，后续不覆盖。
              if (!user?.utmSource) {
                const raw = getCookieFromCtx(ctx, 'utm_source');
                if (raw && typeof raw === 'string') {
                  // 控制长度并做安全清洗。
                  const decoded = decodeURIComponent(raw).trim();
                  const sanitized = decoded
                    .replace(/[^\w\-.:]/g, '') // 仅允许 a-zA-Z0-9_ - . :
                    .slice(0, 100);

                  if (sanitized) {
                    user.utmSource = sanitized;
                  }
                }
              }
            } catch {
              // 尽力而为，不影响主流程
            }

            return user;
          },
          after: async (user: any) => {
            try {
              if (!user.id) {
                throw new Error('user id is required');
              }
              if (!user.email) {
                throw new Error('user email is required');
              }

              console.log('grant credits or role for new user', {
                id: user.id,
                email: user.email,
              });

              // 给新用户发放初始积分
              await grantCreditsForNewUser(user);

              // 给新用户授予初始角色
              await grantRoleForNewUser(user);
            } catch (e) {
              console.log('post-signup initialization (credits/role) failed', e);
            }
          },
        },
      },
    },
    emailAndPassword: {
      enabled: configs.email_auth_enabled !== 'false',
      requireEmailVerification: emailVerificationEnabled,
      // 当要求邮箱验证时，注册后不立即创建会话。
      autoSignIn: emailVerificationEnabled ? false : true,
    },
    ...(emailVerificationEnabled
      ? {
        emailVerification: {
          // 由前端显式携带 callbackURL 触发验证邮件发送
          // （跳转到 /verify-email），关闭自动发送以避免重复。
          sendOnSignUp: false,
          sendOnSignIn: false,
          // 用户点击验证链接后，自动创建会话。
          autoSignInAfterVerification: true,
          // 24 小时
          expiresIn: 60 * 60 * 24,
          sendVerificationEmail: async (
            { user, url }: { user: any; url: string; token: string },
            _request: Request
          ) => {
            try {
              const key = String(user?.email || '').toLowerCase();
              const now = Date.now();
              const last = recentVerificationEmailSentAt.get(key) || 0;
              if (key && now - last < VERIFICATION_EMAIL_MIN_INTERVAL_MS) {
                return;
              }
              if (key) {
                recentVerificationEmailSentAt.set(key, now);
              }

              const emailService = await getEmailService(configs as any);
              const logoUrl = envConfigs.app_logo?.startsWith('http')
                ? envConfigs.app_logo
                : `${envConfigs.app_url}${envConfigs.app_logo?.startsWith('/') ? '' : '/'}${envConfigs.app_logo || ''}`;
              // 避免邮件发送阻塞认证接口响应。
              await emailService.sendEmail({
                to: user.email,
                subject: `Verify your email - ${envConfigs.app_name}`,
                react: VerifyEmail({
                  appName: envConfigs.app_name,
                  logoUrl,
                  url,
                }),
              });
            } catch (e) {
              console.log('send verification email failed:', e);
            }
          },
        },
      }
      : {}),
    socialProviders: await getSocialProviders(configs),
    plugins:
      configs.google_client_id && configs.google_one_tap_enabled === 'true'
        ? [oneTap()]
        : [],
  };
}

// 根据配置生成社交登录 provider
export async function getSocialProviders(configs: Record<string, string>) {
  const providers: any = {};

  // Google 登录
  if (configs.google_client_id && configs.google_client_secret) {
    providers.google = {
      clientId: configs.google_client_id,
      clientSecret: configs.google_client_secret,
    };
  }

  // GitHub 登录
  if (configs.github_client_id && configs.github_client_secret) {
    providers.github = {
      clientId: configs.github_client_id,
      clientSecret: configs.github_client_secret,
    };
  }

  return providers;
}

// 将数据库 provider 名称转换为 better-auth 所需的 provider
export function getDatabaseProvider(
  provider: string
): 'sqlite' | 'pg' | 'mysql' {
  switch (provider) {
    case 'sqlite':
      return 'sqlite';
    case 'turso':
      return 'sqlite';
    case 'postgresql':
      return 'pg';
    case 'mysql':
      return 'mysql';
    default:
      throw new Error(
        `Unsupported database provider for auth: ${envConfigs.database_provider}`
      );
  }
}
