import { respData, respErr } from '@/shared/lib/resp';
import {
  BOT_PENDING_DEPLOY_STATUS,
  getBotPendingDeployById,
  updateBotPendingDeployById,
} from '@/shared/models/bot-pending-deploy';
import { getUserInfo } from '@/shared/models/user';
import { resolveModel, resolveRegion } from '@/shared/services/bot-deploy';

const sanitizeText = (value: unknown, maxLen: number) => {
  const text = typeof value === 'string' ? value.trim() : '';
  return text.slice(0, maxLen);
};

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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
      pending.status === BOT_PENDING_DEPLOY_STATUS.DEPLOYING ||
      pending.status === BOT_PENDING_DEPLOY_STATUS.DEPLOYED
    ) {
      return respErr('current status does not allow update');
    }

    const body = await req.json().catch(() => ({}));
    const botName = sanitizeText(body?.botName, 64);
    const region = resolveRegion(body?.region);
    const model = resolveModel(body?.model);
    const telegramBotToken = sanitizeText(body?.telegramBotToken, 512);
    const discordBotToken = sanitizeText(body?.discordBotToken, 512);

    if (!botName) {
      return respErr('botName is required');
    }

    const updated = await updateBotPendingDeployById(pending.id, user.id, {
      botName,
      region,
      model,
      telegramBotToken,
      discordBotToken,
      errorMessage: '',
    });

    return respData({
      id: updated.id,
      botName: updated.botName,
      region: updated.region,
      model: updated.model,
      telegramBotToken: updated.telegramBotToken,
      discordBotToken: updated.discordBotToken,
    });
  } catch (e: any) {
    console.log('update pending deploy failed:', e);
    return respErr(`update pending deploy failed: ${e.message}`);
  }
}

