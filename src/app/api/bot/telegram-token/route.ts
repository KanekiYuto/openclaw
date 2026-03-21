import { respData, respErr } from '@/shared/lib/resp';
import { getBotById, updateBotTelegramToken } from '@/shared/models/bots';
import { getUserInfo } from '@/shared/models/user';
import { updateFlyMachineEnv } from '@/shared/services/fly';

export async function POST(req: Request) {
  try {
    const user = await getUserInfo();
    if (!user) {
      return respErr('no auth, please sign in');
    }

    const body = await req.json().catch(() => ({}));
    const botId =
      typeof body?.botId === 'string' ? body.botId.trim() : '';
    const token =
      typeof body?.token === 'string' ? body.token.trim() : '';
    const enabled = body?.enabled === true;

    if (!botId) {
      return respErr('botId is required');
    }

    if (enabled && !token) {
      return respErr('telegram bot token is required');
    }

    if (token.length > 512) {
      return respErr('telegram bot token is too long');
    }

    const bot = await getBotById(botId);
    if (!bot) {
      return respErr('bot not found');
    }

    const updateResult = await updateFlyMachineEnv({
      appName: bot.appName,
      machineId: bot.machineId,
      env: {
        TELEGRAM_BOT_TOKEN: enabled ? token : 'NULL',
        TELEGRAM_ENABLED: enabled ? 'true' : 'false',
      },
    });
    console.log('fly machine update result (telegram token update):', {
      botId,
      appName: bot.appName,
      machineId: bot.machineId,
      updateResult,
    });

    await updateBotTelegramToken(botId, enabled ? token : '');

    return respData({ botId });
  } catch (e: any) {
    console.log('update telegram bot token failed:', e);
    return respErr(e.message || 'update telegram bot token failed');
  }
}
