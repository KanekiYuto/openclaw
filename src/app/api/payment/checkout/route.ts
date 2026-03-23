import { NextResponse } from 'next/server';

import {
  PaymentInterval,
  PaymentOrder,
  PaymentPrice,
  PaymentType,
} from '@/extensions/payment/types';
import { getSnowId, getUuid } from '@/shared/lib/hash';
import { respData, respErr } from '@/shared/lib/resp';
import { getAllConfigs } from '@/shared/models/config';
import {
  createOrder,
  NewOrder,
  OrderStatus,
  updateOrderByOrderNo,
} from '@/shared/models/order';
import { getUserInfo } from '@/shared/models/user';
import { getPaymentService } from '@/shared/services/payment';

type CreditPackage = {
  productId: string;
  productName: string;
  description: string;
  amount: number;
  currency: string;
  credits: number;
  validDays: number;
};

const CREDIT_PACKAGES: Record<string, CreditPackage> = {
  'credits-100': {
    productId: 'credits-100',
    productName: 'Credits 100',
    description: 'Credits Package 100',
    amount: 990,
    currency: 'CNY',
    credits: 100,
    validDays: 365,
  },
  'credits-500': {
    productId: 'credits-500',
    productName: 'Credits 500',
    description: 'Credits Package 500',
    amount: 3990,
    currency: 'CNY',
    credits: 500,
    validDays: 365,
  },
  'credits-1000': {
    productId: 'credits-1000',
    productName: 'Credits 1000',
    description: 'Credits Package 1000',
    amount: 6990,
    currency: 'CNY',
    credits: 1000,
    validDays: 365,
  },
};

type CheckoutInput = {
  product_id?: string;
  locale?: string;
  payment_provider?: string;
};

async function createCreditsCheckout(input: CheckoutInput) {
  const productId = String(input.product_id || '').trim();
  if (!productId) {
    throw new Error('product_id is required');
  }

  const pkg = CREDIT_PACKAGES[productId];
  if (!pkg) {
    throw new Error('credit package not found');
  }

  const user = await getUserInfo();
  if (!user || !user.email) {
    throw new Error('no auth, please sign in');
  }

  const configs = await getAllConfigs();

  let paymentProviderName = String(input.payment_provider || '').trim();
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

  const locale = String(input.locale || '').trim();
  let callbackBaseUrl = `${configs.app_url}`;
  if (locale && locale !== configs.default_locale) {
    callbackBaseUrl += `/${locale}`;
  }

  const orderNo = getSnowId();
  const checkoutPrice: PaymentPrice = {
    amount: pkg.amount,
    currency: pkg.currency,
  };

  const checkoutOrder: PaymentOrder = {
    description: pkg.productName,
    customer: {
      name: user.name,
      email: user.email,
    },
    type: PaymentType.ONE_TIME,
    price: checkoutPrice,
    metadata: {
      app_name: configs.app_name,
      order_no: orderNo,
      user_id: user.id,
      product_id: pkg.productId,
    },
    successUrl: `${configs.app_url}/api/payment/callback?order_no=${orderNo}`,
    cancelUrl: `${callbackBaseUrl}/settings/credits`,
  };

  const order: NewOrder = {
    id: getUuid(),
    orderNo,
    userId: user.id,
    userEmail: user.email,
    status: OrderStatus.PENDING,
    amount: pkg.amount,
    currency: pkg.currency,
    productId: pkg.productId,
    paymentType: PaymentType.ONE_TIME,
    paymentInterval: PaymentInterval.ONE_TIME,
    paymentProvider: paymentProvider.name,
    checkoutInfo: JSON.stringify(checkoutOrder),
    createdAt: new Date(),
    productName: pkg.productName,
    description: pkg.description,
    callbackUrl: `${callbackBaseUrl}/settings/credits`,
    creditsAmount: pkg.credits,
    creditsValidDays: pkg.validDays,
    planName: pkg.productName,
    paymentProductId: '',
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
      checkoutUrl: result.checkoutInfo.checkoutUrl,
      sessionId: result.checkoutInfo.sessionId,
      orderNo,
    };
  } catch (e: any) {
    await updateOrderByOrderNo(orderNo, {
      status: OrderStatus.COMPLETED,
      checkoutInfo: JSON.stringify(checkoutOrder),
    });
    throw new Error(`checkout failed: ${e.message}`);
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const result = await createCreditsCheckout({
      product_id: searchParams.get('product_id') || '',
      locale: searchParams.get('locale') || '',
      payment_provider: searchParams.get('payment_provider') || '',
    });

    return NextResponse.redirect(result.checkoutUrl, 302);
  } catch (e: any) {
    const { searchParams } = new URL(req.url);
    const locale = String(searchParams.get('locale') || '').trim();
    const configs = await getAllConfigs();
    let fallback = `${configs.app_url}`;
    if (locale && locale !== configs.default_locale) {
      fallback += `/${locale}`;
    }
    fallback += '/settings/credits';
    return NextResponse.redirect(fallback, 302);
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CheckoutInput;
    const result = await createCreditsCheckout(body);
    return respData(result);
  } catch (e: any) {
    return respErr(e.message || 'checkout failed');
  }
}
