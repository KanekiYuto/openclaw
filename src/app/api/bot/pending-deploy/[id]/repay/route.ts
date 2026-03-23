import { respData, respErr } from '@/shared/lib/resp';
import {
  BOT_PENDING_DEPLOY_PAYMENT_STATUS,
  BOT_PENDING_DEPLOY_STATUS,
  getBotPendingDeployById,
  updateBotPendingDeployById,
} from '@/shared/models/bot-pending-deploy';
import { getUserInfo } from '@/shared/models/user';
import { createBotPendingDeployCheckout } from '@/shared/services/bot-pending-deploy-checkout';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserInfo();
    if (!user || !user.email) {
      return respErr('no auth, please sign in');
    }

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const locale = String(body?.locale || '').trim();
    const paymentProvider = String(body?.paymentProvider || '').trim();

    const pending = await getBotPendingDeployById(id, user.id);
    if (!pending) {
      return respErr('pending deploy not found');
    }
    if (pending.status === BOT_PENDING_DEPLOY_STATUS.DEPLOYED) {
      return respErr('pending deploy already completed');
    }
    if (pending.status === BOT_PENDING_DEPLOY_STATUS.PAID) {
      return respErr('payment already completed, please execute deploy');
    }

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
      status: BOT_PENDING_DEPLOY_STATUS.PENDING_PAYMENT,
      paymentStatus: BOT_PENDING_DEPLOY_PAYMENT_STATUS.PENDING,
      paymentOrderNo: checkout.orderNo,
      paymentProvider: checkout.paymentProvider,
      checkoutUrl: checkout.checkoutUrl,
      errorMessage: '',
    });

    return respData({
      id: pending.id,
      checkoutUrl: checkout.checkoutUrl,
      orderNo: checkout.orderNo,
    });
  } catch (e: any) {
    console.log('repay pending deploy failed:', e);
    return respErr(`repay pending deploy failed: ${e.message}`);
  }
}

