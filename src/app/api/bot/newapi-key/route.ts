import { respData, respErr } from '@/shared/lib/resp';
import { getBotById } from '@/shared/models/bots';
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
    const apiKey = typeof body?.apiKey === 'string' ? body.apiKey.trim() : '';

    if (!botId) {
      return respErr('botId is required');
    }

    if (!apiKey) {
      return respErr('NEWAPI_API_KEY is required');
    }

    if (apiKey.length > 2048) {
      return respErr('NEWAPI_API_KEY is too long');
    }

    const bot = await getBotById(botId);
    if (!bot) {
      return respErr('bot not found');
    }

    const updateResult = await updateFlyMachineEnv({
      appName: bot.appName,
      machineId: bot.machineId,
      env: {
        NEWAPI_API_KEY: apiKey,
      },
    });

    console.log('fly machine update result (newapi api key update):', {
      botId,
      appName: bot.appName,
      machineId: bot.machineId,
      updateResult,
    });

    return respData({ botId });
  } catch (e: any) {
    console.log('update NEWAPI_API_KEY failed:', e);
    return respErr(e.message || 'update NEWAPI_API_KEY failed');
  }
}
