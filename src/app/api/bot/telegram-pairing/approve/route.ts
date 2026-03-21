import { respData, respErr } from '@/shared/lib/resp';
import { getBotById } from '@/shared/models/bots';
import { execFlyMachineCommand } from '@/shared/services/fly';
import { getUserInfo } from '@/shared/models/user';

export async function POST(req: Request) {
  try {
    const user = await getUserInfo();
    if (!user) {
      return respErr('no auth, please sign in');
    }

    const body = await req.json().catch(() => ({}));
    const botId =
      typeof body?.botId === 'string' ? body.botId.trim() : '';
    const rawCode =
      typeof body?.code === 'string' ? body.code.trim() : '';
    const code = rawCode.toUpperCase();

    if (!botId) {
      return respErr('botId is required');
    }
    if (!code) {
      return respErr('pairing code is required');
    }
    if (!/^[A-Z0-9_-]+$/.test(code)) {
      return respErr('invalid pairing code');
    }

    const bot = await getBotById(botId);
    if (!bot) {
      return respErr('bot not found');
    }

    const execResult = await execFlyMachineCommand({
      appName: bot.appName,
      machineId: bot.machineId,
      command: [
        'sh',
        '-lc',
        `if command -v runuser >/dev/null 2>&1; then runuser -u node -- openclaw pairing approve telegram ${code}; elif command -v su >/dev/null 2>&1; then su -s /bin/sh node -c 'openclaw pairing approve telegram ${code}'; else openclaw pairing approve telegram ${code}; fi`,
      ],
      timeout: 30,
    });

    const exitCode = Number(
      (execResult as { exit_code?: number | string }).exit_code ?? 0
    );
    if (exitCode !== 0) {
      const stderr = String(
        (execResult as { stderr?: string }).stderr || 'unknown exec error'
      );
      if (
        stderr.toLowerCase().includes('no pending pairing request found for code')
      ) {
        return respErr('pairing code not found or expired, please refresh and retry');
      }
      return respErr(`pairing approve failed: ${stderr}`);
    }

    return respData({ botId, code });
  } catch (e: any) {
    console.log('approve telegram pairing failed:', e);
    return respErr(e.message || 'approve telegram pairing failed');
  }
}
