import 'server-only';

import { generateId } from 'ai';
import { randomBytes } from 'node:crypto';
import type { NewApiTokenPayload, NewApiUserPayload } from './types';

export const REQUEST_TIMEOUT_MS = 12_000;
const DEFAULT_USERNAME_MIN_LEN = 6;
const DEFAULT_USERNAME_MAX_LEN = 16;
const DEFAULT_PASSWORD_LEN = 12;
const MIN_PASSWORD_LEN = 8;
const MAX_PASSWORD_LEN = 32;
const CREDITS_TO_QUOTA_BASE_CREDITS = 1;
const CREDITS_TO_QUOTA_BASE_QUOTA = 5000;

export function sanitizeText(value: unknown, maxLen: number) {
  const text = typeof value === 'string' ? value.trim() : '';
  return text.slice(0, maxLen);
}

export function getNewApiBaseUrl() {
  const rawBase = sanitizeText(process.env.NEWAPI_BASE_URL, 2048);
  if (!rawBase) {
    throw new Error('NEWAPI_BASE_URL is required');
  }

  let base = rawBase.replace(/\/+$/, '');
  if (/\/v1$/i.test(base)) {
    base = base.replace(/\/v1$/i, '');
  }

  return base;
}

export function getBaseEndpoint(path: string, withTrailingSlash = false) {
  const base = getNewApiBaseUrl();
  const normalizedPath = `/${path}`.replace(/\/+/g, '/');
  const pattern = new RegExp(`${normalizedPath.replace(/\//g, '\\/')}\\/?$`, 'i');
  const endpoint = pattern.test(base) ? base.replace(/\/+$/, '') : `${base}${normalizedPath}`;

  return withTrailingSlash ? `${endpoint.replace(/\/+$/, '')}/` : endpoint.replace(/\/+$/, '');
}

export function buildNewApiUsername() {
  const usernameMaxLen = Math.max(
    DEFAULT_USERNAME_MIN_LEN,
    Math.min(
      parseInt(process.env.NEWAPI_USERNAME_MAX_LEN || '', 10) || DEFAULT_USERNAME_MAX_LEN,
      32
    )
  );

  const generated = generateId().toLowerCase().replace(/[^a-z0-9]/g, '');
  if (generated.length >= DEFAULT_USERNAME_MIN_LEN) {
    return generated.slice(0, usernameMaxLen);
  }

  const randomUsername = `u${randomBytes(8).toString('hex')}`.slice(0, usernameMaxLen);
  if (randomUsername.length >= DEFAULT_USERNAME_MIN_LEN) {
    return randomUsername;
  }

  return randomUsername.padEnd(DEFAULT_USERNAME_MIN_LEN, '0');
}

export function buildNewApiPassword() {
  const passwordLen = Math.max(
    MIN_PASSWORD_LEN,
    Math.min(
      parseInt(process.env.NEWAPI_PASSWORD_LEN || '', 10) || DEFAULT_PASSWORD_LEN,
      MAX_PASSWORD_LEN
    )
  );

  let value = '';
  while (value.length < passwordLen) {
    value += randomBytes(16).toString('base64').replace(/[^A-Za-z0-9]/g, '');
  }

  return value.slice(0, passwordLen);
}

export function buildSignupUserPayload(): NewApiUserPayload {
  const username = buildNewApiUsername();
  return {
    username,
    password: buildNewApiPassword(),
    remark: `AutoCreate:${username}`.slice(0, 512),
  };
}

export function buildDefaultTokenPayload(): NewApiTokenPayload {
  return {
    remain_quota: 0,
    expired_time: -1,
    unlimited_quota: true,
    model_limits_enabled: false,
    model_limits: '',
    cross_group_retry: false,
    name: 'default',
    group: 'credit',
    allow_ips: '',
  };
}

export function getAuthorization() {
  return `Bearer ${process.env.NEWAPI_API_ADMIN_KEY || ''}`;
}

export function buildAuthorization(token: string) {
  return `Bearer ${token}`;
}

export function getAdminUserId() {
  const userId = String(process.env.NEWAPI_USER_ID || '').trim();
  if (userId) {
    return userId;
  }

  throw new Error('NEWAPI_USER_ID is required');
}

export function createRequestController() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  return {
    signal: controller.signal,
    close: () => clearTimeout(timeout),
  };
}

export async function parseResponseBody(resp: Response) {
  return resp.json().catch(async () => {
    const text = await resp.text().catch(() => '');
    return { message: text };
  });
}

export function summarizeBody(body: object) {
  try {
    return JSON.stringify(body);
  } catch {
    return '[unserializable response body]';
  }
}

export function getApiErrorMessage(body: any, fallback: string) {
  if (body && (body.message || body.error)) {
    return String(body.message || body.error);
  }
  return fallback;
}

// 积分转换为 NewAPI 配额：1 积分 = 5000 配额
export function convertCreditsToQuota(credits: number) {
  const normalizedCredits = Number(credits);
  if (!Number.isFinite(normalizedCredits) || normalizedCredits <= 0) {
    return 0;
  }

  return Math.floor(
    (normalizedCredits * CREDITS_TO_QUOTA_BASE_QUOTA) /
    CREDITS_TO_QUOTA_BASE_CREDITS
  );
}
