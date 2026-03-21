import { respData, respErr } from '@/shared/lib/resp';
import {
  BotRecord,
  getBots,
  updateBotMachineState,
} from '@/shared/models/bots';
import { getUserInfo } from '@/shared/models/user';
import { getFlyMachineStatus } from '@/shared/services/fly';

export async function POST(req: Request) {
  try {
    const user = await getUserInfo();
    if (!user) {
      return respErr('no auth, please sign in');
    }

    const body = await req.json().catch(() => ({}));
    const botIds = Array.isArray(body?.botIds)
      ? body.botIds
          .map((id: unknown) => String(id || '').trim())
          .filter(Boolean)
      : [];

    const rows: BotRecord[] = await getBots(100);
    const targets =
      botIds.length > 0
        ? rows.filter((item) => botIds.includes(item.id))
        : rows;

    const updates = await Promise.all(
      targets.map(async (bot) => {
        try {
          const status = await getFlyMachineStatus(bot.appName, bot.machineId);
          const nextState = String(status.state || 'unknown');

          if (nextState !== bot.machineState) {
            await updateBotMachineState(bot.id, nextState);
          }

          return {
            id: bot.id,
            machineState: nextState,
          };
        } catch (e) {
          return {
            id: bot.id,
            machineState: bot.machineState,
            error: String((e as Error)?.message || 'sync failed'),
          };
        }
      })
    );

    return respData({ items: updates });
  } catch (e: any) {
    console.log('sync bot status failed:', e);
    return respErr(e.message || 'sync bot status failed');
  }
}
