import { respData, respErr } from '@/shared/lib/resp';
import { getBotById, updateBotDiscordToken } from '@/shared/models/bots';
import { getUserInfo } from '@/shared/models/user';
import { updateFlyMachineEnv } from '@/shared/services/fly';

export async function POST(req: Request) {
  try {
    const user = await getUserInfo();
    if (!user) {
      return respErr('no auth, please sign in');
    }

    const body = await req.json().catch(() => ({}));
    const botId = typeof body?.botId === 'string' ? body.botId.trim() : '';
    const token = typeof body?.token === 'string' ? body.token.trim() : '';
    const enabled = body?.enabled === true;

    if (!botId) {
      return respErr('botId is required');
    }

    if (enabled && !token) {
      return respErr('discord bot token is required');
    }

    if (token.length > 512) {
      return respErr('discord bot token is too long');
    }

    const bot = await getBotById(botId);
    if (!bot) {
      return respErr('bot not found');
    }

    const updateResult = await updateFlyMachineEnv({
      appName: bot.appName,
      machineId: bot.machineId,
      env: {
        DISCORD_BOT_TOKEN: enabled ? token : 'NULL',
        DISCORD_ENABLED: enabled ? 'true' : 'false',
      },
    });
    console.log('fly machine update result (discord token update):', {
      botId,
      appName: bot.appName,
      machineId: bot.machineId,
      updateResult,
    });

    await updateBotDiscordToken(botId, enabled ? token : '');

    return respData({ botId });
  } catch (e: any) {
    console.log('update discord bot token failed:', e);
    return respErr(e.message || 'update discord bot token failed');
  }
}
