import { generateId } from 'ai';
import { randomBytes } from 'node:crypto';

import { respData, respErr } from '@/shared/lib/resp';
import { createBot, type NewBotRecord } from '@/shared/models/bots';
import { getUserInfo } from '@/shared/models/user';
import { provisionFlyBotApp } from '@/shared/services/fly';

const DEFAULT_REGION = 'nrt';
const DEFAULT_NETWORK = 'default';
const DEFAULT_VOLUME_NAME = 'data';
const DEFAULT_MACHINE_CPU_KIND = 'shared';
const DEFAULT_PORT = '8080';
const DEFAULT_OPENCLAW_CONFIG_PATH = '/home/node/.openclaw/openclaw.json';
const DEFAULT_NEWAPI_BASE_URL = 'https://new-api-production-178a.up.railway.app/v1';
const FALLBACK_NEWAPI_API_KEY = 'sk-KTCjwlehw0yBNSmVuGsA15oPG8u1x00k4uezAzLgqFtne9th';
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

const PLAN_MAP = {
  basic: {
    volumeSizeGb: 40,
    machineCpus: 2,
    machineMemoryMb: 1024 * 4,
  },
  pro: {
    volumeSizeGb: 80,
    machineCpus: 4,
    machineMemoryMb: 1024 * 8,
  },
  max: {
    volumeSizeGb: 160,
    machineCpus: 8,
    machineMemoryMb: 1024 * 16,
  },
} as const;

type DeployPlan = keyof typeof PLAN_MAP;

type DeployPayload = {
  plan: DeployPlan;
  region: string;
  model: string;
  botName: string;
  telegramBotToken: string;
  discordBotToken: string;
};

function sanitizeText(value: unknown, maxLen: number) {
  const text = typeof value === 'string' ? value.trim() : '';
  return text.slice(0, maxLen);
}

function resolvePlan(value: unknown): DeployPlan {
  const planRaw = sanitizeText(value, 16).toLowerCase();
  if (planRaw === 'basic' || planRaw === 'max') {
    return planRaw;
  }
  return 'pro';
}

function resolveRegion(value: unknown) {
  const region = sanitizeText(value, 16).toLowerCase();
  if (!/^[a-z0-9-]{2,16}$/.test(region)) {
    return DEFAULT_REGION;
  }
  return region;
}

function resolveModel(value: unknown) {
  const model = sanitizeText(value, 128).toLowerCase();
  if (
    SUPPORTED_MODEL_IDS.some((item) => item.toLowerCase() === model)
  ) {
    return model;
  }
  return DEFAULT_MODEL;
}

function generateGatewayToken() {
  return randomBytes(32).toString('hex');
}

function parsePayload(body: any): DeployPayload {
  return {
    plan: resolvePlan(body?.plan),
    region: resolveRegion(body?.region),
    model: resolveModel(body?.model),
    botName: sanitizeText(body?.botName, 64),
    telegramBotToken: sanitizeText(body?.telegramBotToken, 512),
    discordBotToken: sanitizeText(body?.discordBotToken, 512),
  };
}

function buildMachineEnv(input: {
  appName: string;
  model: string;
  telegramBotToken: string;
  discordBotToken: string;
  gatewayToken: string;
}) {
  const machineEnv: Record<string, string> = {
    PORT: DEFAULT_PORT,
    OPENCLAW_CONFIG_PATH: DEFAULT_OPENCLAW_CONFIG_PATH,
    FLY_APP_NAME: input.appName,
    GATEWAY_TOKEN: input.gatewayToken,
    NEWAPI_API_KEY: FALLBACK_NEWAPI_API_KEY,
    NEWAPI_BASE_URL: DEFAULT_NEWAPI_BASE_URL,
    NEWAPI_DEFAULT_MODEL: input.model,
    DEFAULT_MODEL: input.model,
    TELEGRAM_BOT_TOKEN: input.telegramBotToken || 'NULL',
    TELEGRAM_ENABLED: input.telegramBotToken ? 'true' : 'false',
    DISCORD_BOT_TOKEN: input.discordBotToken || 'NULL',
    DISCORD_ENABLED: input.discordBotToken ? 'true' : 'false',
  };

  const serverNewApiKey = sanitizeText(process.env.NEWAPI_API_KEY, 2048);
  if (serverNewApiKey) {
    machineEnv.NEWAPI_API_KEY = serverNewApiKey;
  }

  return machineEnv;
}

function buildCreateBotPayload(input: {
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
  telegramBotToken: string;
  discordBotToken: string;
}): NewBotRecord {
  return {
    bot: {
      id: generateId().toLowerCase(),
      botName: input.botName,
      gatewayToken: input.gatewayToken,
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
}

function buildDeploymentResponse(input: {
  appName: string;
  plan: DeployPlan;
  region: string;
  model: string;
  user: { id: string; name: string; email: string };
  fly: { app: unknown; volume: unknown; machine: unknown };
}) {
  return {
    id: `deploy_${generateId().toLowerCase()}`,
    appName: input.appName,
    status: 'queued',
    plan: input.plan,
    env: 'production',
    triggerSource: 'dashboard',
    createdAt: new Date().toISOString(),
    triggeredBy: {
      id: input.user.id,
      name: input.user.name,
      email: input.user.email,
    },
    fly: input.fly,
    region: input.region,
    model: input.model,
    message: `bot deployment has been queued in region ${input.region}`,
  };
}

export async function POST(req: Request) {
  try {
    const user = await getUserInfo();
    if (!user) {
      return respErr('no auth, please sign in');
    }

    const body = await req.json().catch(() => ({}));
    const payload = parsePayload(body);

    if (!payload.botName) {
      return respErr('botName is required');
    }

    const planConfig = PLAN_MAP[payload.plan];
    const appName = generateId().toLowerCase();
    const gatewayToken = generateGatewayToken();
    const machineEnv = buildMachineEnv({
      appName,
      model: payload.model,
      telegramBotToken: payload.telegramBotToken,
      discordBotToken: payload.discordBotToken,
      gatewayToken,
    });

    const result = await provisionFlyBotApp({
      appName,
      network: DEFAULT_NETWORK,
      region: payload.region,
      volumeName: DEFAULT_VOLUME_NAME,
      volumeSizeGb: planConfig.volumeSizeGb,
      machineCpuKind: DEFAULT_MACHINE_CPU_KIND,
      machineCpus: planConfig.machineCpus,
      machineMemoryMb: planConfig.machineMemoryMb,
      machineEnv,
    });

    const machineId = String((result.machine as { id?: string })?.id || '');
    if (!machineId) {
      throw new Error('Fly machine id is missing');
    }

    const machineState = String(
      (result.machine as { state?: string })?.state || 'unknown'
    );
    const volumeId = String((result.volume as { id?: string })?.id || '');

    await createBot(
      buildCreateBotPayload({
        botName: payload.botName,
        appName: result.appName,
        network: DEFAULT_NETWORK,
        region: payload.region,
        volumeName: DEFAULT_VOLUME_NAME,
        volumeSizeGb: planConfig.volumeSizeGb,
        machineCpuKind: DEFAULT_MACHINE_CPU_KIND,
        machineCpus: planConfig.machineCpus,
        machineMemoryMb: planConfig.machineMemoryMb,
        machineId,
        machineState,
        volumeId,
        gatewayToken,
        telegramBotToken: payload.telegramBotToken,
        discordBotToken: payload.discordBotToken,
      })
    );

    return respData(
      buildDeploymentResponse({
        appName: result.appName,
        plan: payload.plan,
        region: payload.region,
        model: payload.model,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
        fly: {
          app: result.app,
          volume: result.volume,
          machine: result.machine,
        },
      })
    );
  } catch (e: any) {
    console.log('deploy bot failed:', e);
    return respErr(`deploy bot failed: ${e.message}`);
  }
}
