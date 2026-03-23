import { getUuid } from '@/shared/lib/hash';
import { respData, respErr } from '@/shared/lib/resp';
import {
  BOT_PENDING_DEPLOY_PAYMENT_STATUS,
  BOT_PENDING_DEPLOY_STATUS,
  createBotPendingDeploy,
  updateBotPendingDeployById,
} from '@/shared/models/bot-pending-deploy';
import { getUserInfo } from '@/shared/models/user';
import { parseDeployPayload } from '@/shared/services/bot-deploy';
import { createBotPendingDeployCheckout } from '@/shared/services/bot-pending-deploy-checkout';

export async function POST(req: Request) {
  let pendingId = '';
  try {
    const user = await getUserInfo();
    if (!user || !user.email) {
      return respErr('no auth, please sign in');
    }

    const body = await req.json().catch(() => ({}));
    const payload = parseDeployPayload(body);
    const locale = String(body?.locale || '').trim();
    const paymentProvider = String(body?.paymentProvider || '').trim();

    if (!payload.botName) {
      return respErr('botName is required');
    }

    pendingId = getUuid();
    const pending = await createBotPendingDeploy({
      id: pendingId,
      userId: user.id,
      status: BOT_PENDING_DEPLOY_STATUS.PENDING_PAYMENT,
      paymentStatus: BOT_PENDING_DEPLOY_PAYMENT_STATUS.PENDING,
      paymentOrderNo: '',
      paymentProvider: '',
      checkoutUrl: '',
      plan: payload.plan,
      billingCycle: String(body?.billingCycle || 'monthly').trim().toLowerCase() ===
        'yearly'
        ? 'yearly'
        : 'monthly',
      region: payload.region,
      model: payload.model,
      botName: payload.botName,
      telegramBotToken: payload.telegramBotToken,
      discordBotToken: payload.discordBotToken,
      deployedBotId: '',
      deployResult: '',
      errorMessage: '',
    });

    const checkout = await createBotPendingDeployCheckout({
      pending,
      user: {
        id: user.id,
        email: user.email,
        name: user.name || user.email,
      },
      locale,
      paymentProvider,
    });

    await updateBotPendingDeployById(pending.id, user.id, {
      paymentOrderNo: checkout.orderNo,
      paymentProvider: checkout.paymentProvider,
      checkoutUrl: checkout.checkoutUrl,
      errorMessage: '',
    });

    return respData({
      id: pending.id,
      status: pending.status,
      paymentStatus: pending.paymentStatus,
      checkoutUrl: checkout.checkoutUrl,
      orderNo: checkout.orderNo,
    });
  } catch (e: any) {
    if (pendingId) {
      const user = await getUserInfo();
      if (user?.id) {
        await updateBotPendingDeployById(pendingId, user.id, {
          paymentStatus: BOT_PENDING_DEPLOY_PAYMENT_STATUS.FAILED,
          errorMessage: e.message || 'create pending deploy checkout failed',
        });
      }
    }

    console.log('create pending deploy failed:', e);
    return respErr(`create pending deploy failed: ${e.message}`);
  }
}

