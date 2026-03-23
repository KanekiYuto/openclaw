import { generateId } from 'ai';
import { randomBytes } from 'node:crypto';

import { BOT_DEPLOY_PLANS, type DeployPlan } from '@/shared/config/bot-deploy-plans';
import { createBot, type NewBotRecord } from '@/shared/models/bots';
import { provisionFlyBotApp } from '@/shared/services/fly';
import { createDefaultTokenForUser } from '@/shared/services/newapi';

export type { DeployPlan } from '@/shared/config/bot-deploy-plans';

// 部署默认参数
const DEFAULT_REGION = 'nrt';
const DEFAULT_NETWORK = 'default';
const DEFAULT_VOLUME_NAME = 'data';
const DEFAULT_MACHINE_CPU_KIND = 'shared';
const DEFAULT_PORT = '8080';
const DEFAULT_OPENCLAW_CONFIG_PATH = '/home/node/.openclaw/openclaw.json';
const DEFAULT_NEWAPI_BASE_URL = 'https://new-api-production-178a.up.railway.app/v1';
const DEFAULT_MODEL = 'newapi/anthropic/claude-sonnet-4.6';

const SUPPORTED_MODEL_IDS = [
  'newapi/openai/gpt-4.1-mini',
  'newapi/openai/gpt-5.4',
  'newapi/anthropic/claude-sonnet-4.6',
  'newapi/anthropic/claude-opus-4.6',
  'newapi/anthropic/claude-haiku-4.5',
  'newapi/anthropic/claude-3.5-haiku',
  'newapi/anthropic/claude-3-haiku',
] as const;

const BOT_NAME_MAX_LEN = 64;
const TOKEN_MAX_LEN = 512;
const REGION_MAX_LEN = 16;
const MODEL_MAX_LEN = 128;
const PLAN_MAX_LEN = 16;
const ACCESS_TOKEN_MAX_LEN = 2048;
const USER_ID_MAX_LEN = 128;

export type DeployPayload = {
  plan: DeployPlan;
  region: string;
  model: string;
  botName: string;
  telegramBotToken: string;
  discordBotToken: string;
  newapiAccessToken: string;
  newapiUserId: string;
};

type MachineEnvInput = {
  appName: string;
  model: string;
  telegramBotToken: string;
  discordBotToken: string;
  gatewayToken: string;
  newapiApiKey: string;
};

type CreateBotPayloadInput = {
  botName: string;
  appName: string;
  network: string;
  region: string;
  volumeName: string;
  volumeSizeGb: number;
  machineCpuKind: string;
  machineCpus: number;
  machineMemoryMb: number;
  machineId: string;
  machineState: string;
  volumeId: string;
  gatewayToken: string;
  apiToken: string;
  telegramBotToken: string;
  discordBotToken: string;
};

const sanitizeText = (value: unknown, maxLen: number) => {
  const text = typeof value === 'string' ? value.trim() : '';
  return text.slice(0, maxLen);
};

export function resolvePlan(value: unknown): DeployPlan {
  const planRaw = sanitizeText(value, PLAN_MAX_LEN).toLowerCase();
  if (planRaw === 'basic' || planRaw === 'max') {
    return planRaw;
  }
  return 'pro';
}

export function resolveRegion(value: unknown) {
  const region = sanitizeText(value, REGION_MAX_LEN).toLowerCase();
  if (!/^[a-z0-9-]{2,16}$/.test(region)) {
    return DEFAULT_REGION;
  }
  return region;
}

export function resolveModel(value: unknown) {
  const model = sanitizeText(value, MODEL_MAX_LEN).toLowerCase();
  if (SUPPORTED_MODEL_IDS.some((item) => item.toLowerCase() === model)) {
    return model;
  }
  return DEFAULT_MODEL;
}

const generateGatewayToken = () => randomBytes(32).toString('hex');

// 组装实例运行环境变量（NEWAPI_API_KEY 使用本次部署新建的用户 token）
const buildMachineEnv = (input: MachineEnvInput) => {
  return {
    PORT: DEFAULT_PORT,
    OPENCLAW_CONFIG_PATH: DEFAULT_OPENCLAW_CONFIG_PATH,
    FLY_APP_NAME: input.appName,
    GATEWAY_TOKEN: input.gatewayToken,
    NEWAPI_API_KEY: `sk-${input.newapiApiKey}`,
    NEWAPI_BASE_URL: DEFAULT_NEWAPI_BASE_URL,
    DEFAULT_MODEL: input.model,
    TELEGRAM_BOT_TOKEN: input.telegramBotToken || 'NULL',
    TELEGRAM_ENABLED: input.telegramBotToken ? 'true' : 'false',
    DISCORD_BOT_TOKEN: input.discordBotToken || 'NULL',
    DISCORD_ENABLED: input.discordBotToken ? 'true' : 'false',
  } as Record<string, string>;
};

// 组装四张表（bot/app/machine/volume）统一入参
const buildCreateBotPayload = (input: CreateBotPayloadInput): NewBotRecord => {
  return {
    bot: {
      id: generateId().toLowerCase(),
      botName: input.botName,
      gatewayToken: input.gatewayToken,
      apiToken: input.apiToken,
      channelTelegramBotToken: input.telegramBotToken,
      channelDiscordBotToken: input.discordBotToken,
    },
    app: {
      id: generateId().toLowerCase(),
      appName: input.appName,
      network: input.network,
      region: input.region,
      ip: '',
    },
    machine: {
      id: generateId().toLowerCase(),
      machineId: input.machineId,
      cpuKind: input.machineCpuKind,
      cpus: input.machineCpus,
      memoryMb: input.machineMemoryMb,
      machineState: input.machineState,
    },
    volume: {
      id: generateId().toLowerCase(),
      volumeName: input.volumeName,
      volumeId: input.volumeId,
      region: input.region,
      sizeGb: input.volumeSizeGb,
    },
  };
};

// 从 Fly 返回体提取关键资源标识
const parseFlyResourceIds = (result: {
  machine?: { id?: string; state?: string };
  volume?: { id?: string };
}) => {
  const machineId = String(result.machine?.id || '');
  if (!machineId) {
    throw new Error('Fly machine id is missing');
  }

  return {
    machineId,
    machineState: String(result.machine?.state || 'unknown'),
    volumeId: String(result.volume?.id || ''),
  };
};

export function parseDeployPayload(body: any): Omit<
  DeployPayload,
  'newapiAccessToken' | 'newapiUserId'
> {
  // 部署请求体只接收机器参数，用户 NewAPI 凭据由服务端从用户表读取
  return {
    plan: resolvePlan(body?.plan),
    region: resolveRegion(body?.region),
    model: resolveModel(body?.model),
    botName: sanitizeText(body?.botName, BOT_NAME_MAX_LEN),
    telegramBotToken: sanitizeText(body?.telegramBotToken, TOKEN_MAX_LEN),
    discordBotToken: sanitizeText(body?.discordBotToken, TOKEN_MAX_LEN),
  };
}

export async function deployBot(payload: DeployPayload) {
  // 校验用户 NewAPI 凭据
  const newapiAccessToken = sanitizeText(
    payload.newapiAccessToken,
    ACCESS_TOKEN_MAX_LEN
  );
  const newapiUserId = sanitizeText(payload.newapiUserId, USER_ID_MAX_LEN);
  if (!newapiAccessToken) {
    throw new Error('deployBot requires newapiAccessToken');
  }
  if (!newapiUserId) {
    throw new Error('deployBot requires newapiUserId');
  }

  // 1) 为本次部署创建独立 NewAPI token（避免复用默认 token）
  const newapiApiToken = await createDefaultTokenForUser({
    accessToken: newapiAccessToken,
    userId: newapiUserId,
  });

  const planConfig = BOT_DEPLOY_PLANS[payload.plan];
  const appName = generateId().toLowerCase();
  const gatewayToken = generateGatewayToken();
  // 2) 用新 token 组装实例环境变量
  const machineEnv = buildMachineEnv({
    appName,
    model: payload.model,
    telegramBotToken: payload.telegramBotToken,
    discordBotToken: payload.discordBotToken,
    gatewayToken,
    newapiApiKey: newapiApiToken,
  });

  const result = await provisionFlyBotApp({
    appName,
    network: DEFAULT_NETWORK,
    region: payload.region,
    volumeName: DEFAULT_VOLUME_NAME,
    volumeSizeGb: planConfig.volumeGb,
    machineCpuKind: DEFAULT_MACHINE_CPU_KIND,
    machineCpus: planConfig.cpus,
    machineMemoryMb: planConfig.memoryMb,
    machineEnv,
  });

  const { machineId, machineState, volumeId } = parseFlyResourceIds({
    machine: result.machine as { id?: string; state?: string },
    volume: result.volume as { id?: string },
  });

  // 3) 落库保存 bot 配置（包含 apiToken）和 Fly 资源映射
  const created = await createBot(
    buildCreateBotPayload({
      botName: payload.botName,
      appName: result.appName,
      network: DEFAULT_NETWORK,
      region: payload.region,
      volumeName: DEFAULT_VOLUME_NAME,
      volumeSizeGb: planConfig.volumeGb,
      machineCpuKind: DEFAULT_MACHINE_CPU_KIND,
      machineCpus: planConfig.cpus,
      machineMemoryMb: planConfig.memoryMb,
      machineId,
      machineState,
      volumeId,
      gatewayToken,
      apiToken: newapiApiToken,
      telegramBotToken: payload.telegramBotToken,
      discordBotToken: payload.discordBotToken,
    })
  );

  return {
    appName: result.appName,
    plan: payload.plan,
    region: payload.region,
    model: payload.model,
    fly: {
      app: result.app,
      volume: result.volume,
      machine: result.machine,
    },
    botId: created.bot.id,
  };
}
