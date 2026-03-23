import { redirect } from 'next/navigation';

import { envConfigs } from '@/config';
import { PaymentType } from '@/extensions/payment/types';
import {
  BOT_PENDING_DEPLOY_PAYMENT_STATUS,
  BOT_PENDING_DEPLOY_STATUS,
  updateBotPendingDeployById,
} from '@/shared/models/bot-pending-deploy';
import { findOrderByOrderNo } from '@/shared/models/order';
import { getUserInfo } from '@/shared/models/user';
import {
  getPaymentService,
  handleCheckoutSuccess,
} from '@/shared/services/payment';

export async function GET(req: Request) {
  let redirectUrl = '';

  try {
    // get callback params
    const { searchParams } = new URL(req.url);
    const orderNo = searchParams.get('order_no');

    if (!orderNo) {
      throw new Error('invalid callback params');
    }

    // get sign user
    const user = await getUserInfo();
    if (!user || !user.email) {
      throw new Error('no auth, please sign in');
    }

    // get order
    const order = await findOrderByOrderNo(orderNo);
    if (!order) {
      throw new Error('order not found');
    }

    // validate order and user
    if (!order.paymentSessionId || !order.paymentProvider) {
      throw new Error('invalid order');
    }

    if (order.userId !== user.id) {
      throw new Error('order and user not match');
    }

    const paymentService = await getPaymentService();

    const paymentProvider = paymentService.getProvider(order.paymentProvider);
    if (!paymentProvider) {
      throw new Error('payment provider not found');
    }

    // get payment session
    const session = await paymentProvider.getPaymentSession({
      sessionId: order.paymentSessionId,
    });

    // console.log('callback payment session', session);

    await handleCheckoutSuccess({
      order,
      session,
    });

    const pendingDeployId = String(
      session?.metadata?.bot_pending_deploy_id || ''
    ).trim();
    if (pendingDeployId) {
      await updateBotPendingDeployById(pendingDeployId, order.userId, {
        status: BOT_PENDING_DEPLOY_STATUS.PAID,
        paymentStatus: BOT_PENDING_DEPLOY_PAYMENT_STATUS.PAID,
        paymentOrderNo: order.orderNo,
        paymentProvider: order.paymentProvider || '',
        errorMessage: '',
      });
    }

    redirectUrl =
      order.callbackUrl ||
      (order.paymentType === PaymentType.SUBSCRIPTION
        ? `${envConfigs.app_url}/settings/billing`
        : `${envConfigs.app_url}/settings/payments`);
  } catch (e: any) {
    console.log('checkout callback failed:', e);
    redirectUrl = `${envConfigs.app_url}/dashboard`;
  }

  redirect(redirectUrl);
}
