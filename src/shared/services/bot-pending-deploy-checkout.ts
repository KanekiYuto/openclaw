import {
  PaymentInterval,
  PaymentOrder,
  PaymentPrice,
  PaymentType,
} from '@/extensions/payment/types';
import { BOT_DEPLOY_PLANS } from '@/shared/config/bot-deploy-plans';
import { getSnowId, getUuid } from '@/shared/lib/hash';
import { getAllConfigs } from '@/shared/models/config';
import { NewOrder, OrderStatus, createOrder, updateOrderByOrderNo } from '@/shared/models/order';
import { getPaymentService } from '@/shared/services/payment';

import { BotPendingDeploy } from '../models/bot-pending-deploy';

function resolveAmount(plan: string, billingCycle: string) {
  const normalizedPlan = String(plan || '').trim().toLowerCase();
  const normalizedCycle = String(billingCycle || '').trim().toLowerCase();
  const planPrice =
    normalizedPlan === 'basic'
      ? BOT_DEPLOY_PLANS.basic
      : normalizedPlan === 'max'
        ? BOT_DEPLOY_PLANS.max
        : BOT_DEPLOY_PLANS.pro;
  const price =
    normalizedCycle === 'yearly'
      ? planPrice.yearlyPrice
      : planPrice.monthlyPrice;
  return Math.round(price * 100);
}

function resolveCreditsAmount(plan: string, billingCycle: string) {
  const normalizedPlan = String(plan || '').trim().toLowerCase();
  const normalizedCycle = String(billingCycle || '').trim().toLowerCase();
  const planConfig =
    normalizedPlan === 'basic'
      ? BOT_DEPLOY_PLANS.basic
      : normalizedPlan === 'max'
        ? BOT_DEPLOY_PLANS.max
        : BOT_DEPLOY_PLANS.pro;
  return normalizedCycle === 'yearly'
    ? planConfig.yearlyCredits
    : planConfig.monthlyCredits;
}

function resolveCreditsValidDays(billingCycle: string) {
  return String(billingCycle || '').trim().toLowerCase() === 'yearly'
    ? 365
    : 30;
}

function buildBotDeployProductId(plan: string, billingCycle: string) {
  const normalizedPlan = String(plan || '').trim().toLowerCase() || 'pro';
  const normalizedCycle =
    String(billingCycle || '').trim().toLowerCase() === 'yearly'
      ? 'yearly'
      : 'monthly';
  return `bot-deploy-${normalizedPlan}-${normalizedCycle}`;
}

function resolveSubscriptionInterval(billingCycle: string): PaymentInterval {
  return String(billingCycle || '').trim().toLowerCase() === 'yearly'
    ? PaymentInterval.YEAR
    : PaymentInterval.MONTH;
}

export async function createBotPendingDeployCheckout(input: {
  pending: BotPendingDeploy;
  user: { id: string; email: string; name?: string };
  locale?: string;
  paymentProvider?: string;
}) {
  const configs = await getAllConfigs();

  let paymentProviderName = String(input.paymentProvider || '').trim();
  if (!paymentProviderName) {
    paymentProviderName = String(configs.default_payment_provider || '').trim();
  }
  if (!paymentProviderName) {
    throw new Error('no payment provider configured');
  }

  const paymentService = await getPaymentService();
  const paymentProvider = paymentService.getProvider(paymentProviderName);
  if (!paymentProvider || !paymentProvider.name) {
    throw new Error('payment provider not found');
  }

  const orderNo = getSnowId();
  const amount = resolveAmount(input.pending.plan, input.pending.billingCycle);
  const creditsAmount = resolveCreditsAmount(
    input.pending.plan,
    input.pending.billingCycle
  );
  const creditsValidDays = resolveCreditsValidDays(input.pending.billingCycle);
  const currency = 'usd';
  const subscriptionInterval = resolveSubscriptionInterval(
    input.pending.billingCycle
  );
  const productId = buildBotDeployProductId(
    input.pending.plan,
    input.pending.billingCycle
  );

  const locale = String(input.locale || '').trim();
  let callbackBaseUrl = `${configs.app_url}`;
  if (locale && locale !== configs.default_locale) {
    callbackBaseUrl += `/${locale}`;
  }

  const checkoutPrice: PaymentPrice = {
    amount,
    currency,
  };

  const checkoutOrder: PaymentOrder = {
    description: `Bot deploy (${input.pending.plan}/${input.pending.billingCycle})`,
    customer: {
      name: input.user.name || input.user.email,
      email: input.user.email,
    },
    type: PaymentType.SUBSCRIPTION,
    metadata: {
      app_name: configs.app_name,
      order_no: orderNo,
      user_id: input.user.id,
      scene: 'bot_pending_deploy',
      bot_pending_deploy_id: input.pending.id,
    },
    successUrl: `${configs.app_url}/api/payment/callback?order_no=${orderNo}`,
    cancelUrl: `${callbackBaseUrl}/dashboard`,
    price: checkoutPrice,
    plan: {
      interval: subscriptionInterval,
      name: `Bot Deploy ${input.pending.plan}`,
    },
  };

  const currentTime = new Date();
  const order: NewOrder = {
    id: getUuid(),
    orderNo,
    userId: input.user.id,
    userEmail: input.user.email,
    status: OrderStatus.PENDING,
    amount: checkoutPrice.amount,
    currency: checkoutPrice.currency,
    productId,
    paymentType: PaymentType.SUBSCRIPTION,
    paymentInterval: subscriptionInterval,
    paymentProvider: paymentProvider.name,
    checkoutInfo: JSON.stringify(checkoutOrder),
    createdAt: currentTime,
    productName: `Bot Deploy ${input.pending.plan}`,
    description: `Deploy bot ${input.pending.botName}`,
    callbackUrl: `${callbackBaseUrl}/dashboard`,
    creditsAmount,
    creditsValidDays,
    planName: `${input.pending.plan}-${input.pending.billingCycle}`,
  };

  await createOrder(order);

  try {
    const result = await paymentProvider.createPayment({
      order: checkoutOrder,
    });

    await updateOrderByOrderNo(orderNo, {
      status: OrderStatus.CREATED,
      checkoutInfo: JSON.stringify(result.checkoutParams),
      checkoutResult: JSON.stringify(result.checkoutResult),
      checkoutUrl: result.checkoutInfo.checkoutUrl,
      paymentSessionId: result.checkoutInfo.sessionId,
      paymentProvider: result.provider,
    });

    return {
      orderNo,
      paymentProvider: result.provider,
      checkoutUrl: result.checkoutInfo.checkoutUrl,
    };
  } catch (e: any) {
    await updateOrderByOrderNo(orderNo, {
      status: OrderStatus.COMPLETED,
      checkoutInfo: JSON.stringify(checkoutOrder),
    });
    throw new Error(`checkout failed: ${e.message}`);
  }
}
