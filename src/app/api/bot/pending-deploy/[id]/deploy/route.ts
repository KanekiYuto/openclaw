import { generateId } from 'ai';

import { respData, respErr } from '@/shared/lib/resp';
import {
  BOT_PENDING_DEPLOY_STATUS,
  getBotPendingDeployById,
  updateBotPendingDeployById,
} from '@/shared/models/bot-pending-deploy';
import { findUserById, getUserInfo } from '@/shared/models/user';
import { deployBot, resolveModel, resolvePlan, resolveRegion } from '@/shared/services/bot-deploy';

export async function POST(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserInfo();
  if (!user || !user.email) {
    return respErr('no auth, please sign in');
  }

  const { id } = await params;
  const pending = await getBotPendingDeployById(id, user.id);
  if (!pending) {
    return respErr('pending deploy not found');
  }
  if (
    pending.status !== BOT_PENDING_DEPLOY_STATUS.PAID &&
    pending.status !== BOT_PENDING_DEPLOY_STATUS.DEPLOY_FAILED
  ) {
    return respErr('payment not completed');
  }
  if (!pending.botName) {
    return respErr('invalid pending deploy payload');
  }

  try {
    const currentUser = await findUserById(user.id);
    const newapiAccessToken = String(currentUser?.newapiAccessToken || '').trim();
    const newapiUserId = String(currentUser?.newapiUserId || '').trim();
    if (!newapiAccessToken || !newapiUserId) {
      return respErr('newapi credentials are missing for current user');
    }

    await updateBotPendingDeployById(pending.id, user.id, {
      status: BOT_PENDING_DEPLOY_STATUS.DEPLOYING,
      errorMessage: '',
    });

    const result = await deployBot({
      plan: resolvePlan(pending.plan),
      region: resolveRegion(pending.region),
      model: resolveModel(pending.model),
      botName: pending.botName,
      telegramBotToken: pending.telegramBotToken,
      discordBotToken: pending.discordBotToken,
      newapiAccessToken,
      newapiUserId,
    });

    await updateBotPendingDeployById(pending.id, user.id, {
      status: BOT_PENDING_DEPLOY_STATUS.DEPLOYED,
      deployedBotId: result.botId,
      deployResult: JSON.stringify(result),
      errorMessage: '',
    });

    return respData({
      id: `deploy_${generateId().toLowerCase()}`,
      appName: result.appName,
      status: 'queued',
      plan: result.plan,
      region: result.region,
      model: result.model,
      botId: result.botId,
      message: `bot deployment has been queued in region ${result.region}`,
    });
  } catch (e: any) {
    await updateBotPendingDeployById(pending.id, user.id, {
      status: BOT_PENDING_DEPLOY_STATUS.DEPLOY_FAILED,
      errorMessage: e.message || 'deploy failed',
    });
    console.log('deploy pending deploy failed:', e);
    return respErr(`deploy pending deploy failed: ${e.message}`);
  }
}
