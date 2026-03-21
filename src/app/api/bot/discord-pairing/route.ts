import { respData, respErr } from '@/shared/lib/resp';
import { getBotById } from '@/shared/models/bots';
import { getUserInfo } from '@/shared/models/user';
import { execFlyMachineCommand } from '@/shared/services/fly';

type DiscordPairingRequest = {
  id: string;
  code: string;
  createdAt?: string;
  lastSeenAt?: string;
  meta?: {
    username?: string;
    firstName?: string;
    accountId?: string;
  };
};

type DiscordPairingFile = {
  version?: number;
  requests?: DiscordPairingRequest[];
};

export async function POST(req: Request) {
  try {
    const user = await getUserInfo();
    if (!user) {
      return respErr('no auth, please sign in');
    }

    const body = await req.json().catch(() => ({}));
    const botId = typeof body?.botId === 'string' ? body.botId.trim() : '';
    if (!botId) {
      return respErr('botId is required');
    }

    const bot = await getBotById(botId);
    if (!bot) {
      return respErr('bot not found');
    }

    const readPairingScript = `
const fs = require('fs');
const path = '/home/node/.openclaw/credentials/discord-pairing.json';
if (!fs.existsSync(path)) {
  process.stdout.write(JSON.stringify({ version: 1, requests: [] }));
  process.exit(0);
}

const raw = fs.readFileSync(path, 'utf8');
if (!raw.trim()) {
  process.stdout.write(JSON.stringify({ version: 1, requests: [] }));
  process.exit(0);
}

const data = JSON.parse(raw);
if (!data || typeof data !== 'object') {
  process.stdout.write(JSON.stringify({ version: 1, requests: [] }));
  process.exit(0);
}

if (!Array.isArray(data.requests)) {
  data.requests = [];
}

process.stdout.write(JSON.stringify(data));
`;

    const execResult = await execFlyMachineCommand({
      appName: bot.appName,
      machineId: bot.machineId,
      command: ['node', '-e', readPairingScript],
      timeout: 30,
    });

    const exitCode = Number(
      (execResult as { exit_code?: number | string }).exit_code ?? 0
    );
    if (exitCode !== 0) {
      const stderr = String(
        (execResult as { stderr?: string }).stderr || 'unknown exec error'
      );
      return respErr(`fly exec failed: ${stderr}`);
    }

    const stdout = String((execResult as { stdout?: string }).stdout || '').trim();
    const parsed: DiscordPairingFile = stdout
      ? JSON.parse(stdout)
      : { version: 1, requests: [] };

    return respData({
      version: typeof parsed.version === 'number' ? parsed.version : 1,
      requests: Array.isArray(parsed.requests) ? parsed.requests : [],
    });
  } catch (e: any) {
    console.log('get discord pairing failed:', e);
    return respErr(e.message || 'get discord pairing failed');
  }
}

