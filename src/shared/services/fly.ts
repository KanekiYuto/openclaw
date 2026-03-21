import 'server-only';

const FLY_API_BASE_URL = 'https://api.machines.dev/v1';
const FLY_GRAPHQL_URL = 'https://api.fly.io/graphql';
const DEFAULT_MACHINE_IMAGE = 'kanekiyuto/openclaw:latest';
const DEFAULT_MACHINE_MOUNT_PATH = '/data';
const DEFAULT_MACHINE_INTERNAL_PORT = 8080;
const DEFAULT_MACHINE_CPU_KIND = 'shared';
const DEFAULT_MACHINE_CPUS = 1;
const DEFAULT_MACHINE_MEMORY_MB = 1024;

type FlyRequestInit = RequestInit & {
  jsonBody?: Record<string, unknown>;
};

type FlyVolume = {
  id: string;
  [key: string]: unknown;
};

type FlyMachine = {
  id: string;
  [key: string]: unknown;
};

type FlyGraphqlResponse<T> = {
  data?: T;
  errors?: Array<{ message?: string }>;
};

export type FlyCreateAppInput = {
  appName: string;
  network: string;
  enableSubdomains?: boolean;
};

export type FlyCreateVolumeInput = {
  appName: string;
  volumeName: string;
  region: string;
  sizeGb: number;
  encrypted?: boolean;
  autoBackupEnabled?: boolean;
  snapshotRetention?: number;
  requireUniqueZone?: boolean;
  machinesOnly?: boolean;
  fstype?: string;
};

export type FlyCreateMachineInput = {
  appName: string;
  region: string;
  volumeId: string;
  image?: string;
  mountPath?: string;
  env?: Record<string, string>;
  cpuKind?: string;
  cpus?: number;
  memoryMb?: number;
};

export type ProvisionFlyBotAppInput = {
  appName: string;
  network: string;
  region: string;
  volumeName: string;
  volumeSizeGb: number;
  machineEnv: Record<string, string>;
  machineCpuKind?: string;
  machineCpus?: number;
  machineMemoryMb?: number;
};

export type FlyExecMachineCommandInput = {
  appName: string;
  machineId: string;
  command: string[];
  container?: string;
  stdin?: string;
  timeout?: number;
};

export type FlyExecMachineCommandResult = {
  [key: string]: unknown;
};

export type FlyMachineStatusResult = {
  id: string;
  state: string;
  [key: string]: unknown;
};

type FlyMachineConfig = {
  env?: Record<string, string>;
  [key: string]: unknown;
};

type FlyMachineDetail = {
  id: string;
  config?: FlyMachineConfig;
  current_version?: string;
  version?: string;
  [key: string]: unknown;
};

export type FlyUpdateMachineEnvInput = {
  appName: string;
  machineId: string;
  env: Record<string, string>;
};

export type FlyMachineEnvResult = {
  env: Record<string, string>;
};

function getFlyApiKey() {
  const apiKey = process.env.FLY_API_KEY;
  if (!apiKey) {
    throw new Error('FLY_API_KEY is required');
  }

  return apiKey;
}

function getFlyOrgSlug() {
  const orgSlug = process.env.FLY_ORG_SLUG;
  if (!orgSlug) {
    throw new Error('FLY_ORG_SLUG is required');
  }

  return orgSlug;
}

async function flyRequest<T>(path: string, init: FlyRequestInit): Promise<T> {
  const resp = await fetch(`${FLY_API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getFlyApiKey()}`,
      ...init.headers,
    },
    body: init.jsonBody ? JSON.stringify(init.jsonBody) : undefined,
  });

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const message =
      data?.error ||
      data?.message ||
      data?.details ||
      `Fly API request failed with status ${resp.status}`;
    throw new Error(message);
  }

  return data as T;
}

async function flyGraphqlRequest<T>(
  query: string,
  variables: Record<string, unknown>
): Promise<T> {
  const resp = await fetch(FLY_GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getFlyApiKey()}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  const payload = (await resp.json().catch(() => ({}))) as FlyGraphqlResponse<T>;

  if (!resp.ok) {
    throw new Error(`Fly GraphQL request failed with status ${resp.status}`);
  }

  if (Array.isArray(payload.errors) && payload.errors.length > 0) {
    const message = payload.errors
      .map((item) => item?.message || '')
      .filter(Boolean)
      .join('; ');
    throw new Error(message || 'Fly GraphQL request failed');
  }

  if (!payload.data) {
    throw new Error('Fly GraphQL response missing data');
  }

  return payload.data;
}

export function sanitizeFlyAppName(input: string) {
  const normalized = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!normalized) {
    throw new Error('appName must contain letters or numbers');
  }

  return normalized.slice(0, 63);
}

export async function createFlyApp(input: FlyCreateAppInput) {
  return flyRequest('/apps', {
    method: 'POST',
    jsonBody: {
      app_name: input.appName,
      org_slug: getFlyOrgSlug(),
      network: input.network,
      enable_subdomains: input.enableSubdomains ?? true,
    },
  });
}

export async function allocateFlySharedIpv4(appName: string) {
  type Result = {
    allocateIpAddress?: {
      app?: {
        sharedIpAddress?: string | null;
      };
    };
  };

  const query = `
mutation ($input: AllocateIPAddressInput!) {
  allocateIpAddress(input: $input) {
    app {
      sharedIpAddress
    }
  }
}
`;

  try {
    return await flyGraphqlRequest<Result>(query, {
      input: {
        appId: appName,
        type: 'shared_v4',
        region: '',
      },
    });
  } catch (e: any) {
    const message = String(e?.message || '');
    const normalized = message.toLowerCase();
    const isAlreadyAllocated =
      normalized.includes('already') && normalized.includes('shared');
    if (isAlreadyAllocated) {
      return null;
    }
    throw new Error(`allocate shared IPv4 failed: ${message}`);
  }
}

export async function createFlyVolume(
  input: FlyCreateVolumeInput
): Promise<FlyVolume> {
  return flyRequest(`/apps/${input.appName}/volumes`, {
    method: 'POST',
    jsonBody: {
      name: input.volumeName,
      region: input.region,
      size_gb: input.sizeGb,
      encrypted: input.encrypted ?? true,
      auto_backup_enabled: input.autoBackupEnabled ?? true,
      snapshot_retention: input.snapshotRetention ?? 5,
      require_unique_zone: input.requireUniqueZone ?? true,
      machines_only: input.machinesOnly ?? true,
      fstype: input.fstype || 'ext4',
    },
  });
}

export async function createFlyMachine(
  input: FlyCreateMachineInput
): Promise<FlyMachine> {
  return flyRequest(`/apps/${input.appName}/machines`, {
    method: 'POST',
    jsonBody: {
      region: input.region,
      config: {
        image: input.image || DEFAULT_MACHINE_IMAGE,
        env: input.env,
        guest: {
          cpu_kind: input.cpuKind || DEFAULT_MACHINE_CPU_KIND,
          cpus: input.cpus ?? DEFAULT_MACHINE_CPUS,
          memory_mb: input.memoryMb ?? DEFAULT_MACHINE_MEMORY_MB,
        },
        restart: {
          policy: 'always',
        },
        mounts: [
          {
            volume: input.volumeId,
            path: input.mountPath || DEFAULT_MACHINE_MOUNT_PATH,
          },
        ],
        services: [
          {
            protocol: 'tcp',
            internal_port: DEFAULT_MACHINE_INTERNAL_PORT,
            autostart: true,
            autostop: 'off',
            min_machines_running: 1,
            // OpenClaw 冷启动较慢，这里预留健康检查宽限期，避免启动早期出现 PC01 误报。
            tcp_checks: [
              {
                interval: '15s', // 健康检查间隔：每 15 秒检查一次
                timeout: '2s', // 单次检查超时：2 秒未连通则本次失败
                grace_period: '300s', // 启动宽限期：启动后 90 秒内失败不计为不健康
              },
            ],
            ports: [
              {
                port: 80,
                handlers: ['http'],
              },
              {
                port: 443,
                handlers: ['tls', 'http'],
              },
            ],
          },
        ],
      },
    },
  });
}

export async function getFlyMachineStatus(
  appName: string,
  machineId: string
): Promise<FlyMachineStatusResult> {
  const result = await flyRequest<FlyMachineStatusResult>(
    `/apps/${appName}/machines/${machineId}`,
    {
      method: 'GET',
    }
  );

  return {
    ...result,
    id: String((result as { id?: unknown }).id || machineId),
    state: String((result as { state?: unknown }).state || 'unknown'),
  };
}

export async function updateFlyMachineEnv(
  input: FlyUpdateMachineEnvInput
): Promise<FlyMachine> {
  const machine = await flyRequest<FlyMachineDetail>(
    `/apps/${input.appName}/machines/${input.machineId}`,
    {
      method: 'GET',
    }
  );

  const currentConfig =
    machine.config && typeof machine.config === 'object' ? machine.config : {};
  const currentEnv =
    currentConfig.env && typeof currentConfig.env === 'object'
      ? currentConfig.env
      : {};

  const nextConfig: FlyMachineConfig = {
    ...currentConfig,
    env: {
      ...currentEnv,
      ...input.env,
    },
  };

  const currentVersion =
    (typeof machine.current_version === 'string' && machine.current_version) ||
    (typeof machine.version === 'string' && machine.version) ||
    '';

  return flyRequest<FlyMachine>(`/apps/${input.appName}/machines/${input.machineId}`, {
    method: 'POST',
    jsonBody: {
      config: nextConfig,
      ...(currentVersion ? { current_version: currentVersion } : {}),
    },
  });
}

export async function getFlyMachineEnv(
  appName: string,
  machineId: string
): Promise<FlyMachineEnvResult> {
  const machine = await flyRequest<FlyMachineDetail>(
    `/apps/${appName}/machines/${machineId}`,
    {
      method: 'GET',
    }
  );

  const config =
    machine.config && typeof machine.config === 'object' ? machine.config : {};
  const env =
    config.env && typeof config.env === 'object' ? config.env : {};

  return { env };
}

export async function execFlyMachineCommand(
  input: FlyExecMachineCommandInput
): Promise<FlyExecMachineCommandResult> {
  if (!Array.isArray(input.command) || input.command.length === 0) {
    throw new Error('command is required');
  }

  const timeout = input.timeout ?? 30;
  if (timeout <= 0) {
    throw new Error('timeout must be greater than 0');
  }

  return flyRequest<FlyExecMachineCommandResult>(
    `/apps/${input.appName}/machines/${input.machineId}/exec`,
    {
      method: 'POST',
      jsonBody: {
        command: input.command,
        container: input.container ?? '',
        stdin: input.stdin ?? '',
        timeout,
      },
    }
  );
}

export async function provisionFlyBotApp(input: ProvisionFlyBotAppInput) {
  const appName = sanitizeFlyAppName(input.appName);

  const app = await createFlyApp({
    appName,
    network: input.network,
    enableSubdomains: true,
  });
  await allocateFlySharedIpv4(appName);

  const volume = await createFlyVolume({
    appName,
    volumeName: input.volumeName,
    region: input.region,
    sizeGb: input.volumeSizeGb,
  });

  if (!volume.id) {
    throw new Error('Fly volume id is missing');
  }

  const machine = await createFlyMachine({
    appName,
    region: input.region,
    volumeId: volume.id,
    env: input.machineEnv,
    cpuKind: input.machineCpuKind,
    cpus: input.machineCpus,
    memoryMb: input.machineMemoryMb,
  });

  return {
    appName,
    app,
    volume,
    machine,
  };
}
