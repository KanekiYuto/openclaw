import { respData, respErr } from '@/shared/lib/resp';
import { listBotPendingDeploysByUser } from '@/shared/models/bot-pending-deploy';
import { getBotById } from '@/shared/models/bots';
import { getUserInfo } from '@/shared/models/user';

export async function GET() {
  try {
    const user = await getUserInfo();
    if (!user?.id) {
      return respErr('no auth, please sign in');
    }

    const pendingDeploys = await listBotPendingDeploysByUser(user.id, 100);
    const botIds = Array.from(
      new Set(
        pendingDeploys
          .map((item) => String(item.deployedBotId || '').trim())
          .filter(Boolean)
      )
    );

    const botRows = await Promise.all(botIds.map((id) => getBotById(id)));
    const bots = botRows.filter((item) => Boolean(item));
    return respData({ bots });
  } catch (e: any) {
    console.log('get dashboard bots failed:', e);
    return respErr(`get dashboard bots failed: ${e.message}`);
  }
}
