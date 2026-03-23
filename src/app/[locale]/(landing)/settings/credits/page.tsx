import { getLocale, getTranslations } from 'next-intl/server';
import { Coins } from 'lucide-react';

import { Empty } from '@/shared/blocks/common';
import { TableCard } from '@/shared/blocks/table';
import {
  CreditStatus,
  CreditTransactionType,
  getCredits,
  getCreditsCount,
  getRemainingCredits,
} from '@/shared/models/credit';
import { getUserInfo } from '@/shared/models/user';
import { Tab } from '@/shared/types/blocks/common';
import { type Table } from '@/shared/types/blocks/table';

export default async function CreditsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: number; pageSize?: number; type?: string }>;
}) {
  const { page: pageNum, pageSize, type } = await searchParams;
  const page = pageNum || 1;
  const limit = pageSize || 20;

  const user = await getUserInfo();
  if (!user) {
    return <Empty message="no auth" />;
  }

  const t = await getTranslations('settings.credits');
  const locale = await getLocale();

  const total = await getCreditsCount({
    transactionType: type as CreditTransactionType,
    userId: user.id,
    status: CreditStatus.ACTIVE,
  });

  const credits = await getCredits({
    userId: user.id,
    status: CreditStatus.ACTIVE,
    transactionType: type as CreditTransactionType,
    page,
    limit,
  });

  const table: Table = {
    title: t('list.title'),
    columns: [
      {
        name: 'transactionNo',
        title: t('fields.transaction_no'),
        type: 'copy',
      },
      { name: 'description', title: t('fields.description') },
      {
        name: 'transactionType',
        title: t('fields.type'),
        type: 'label',
        metadata: { variant: 'outline' },
      },
      {
        name: 'transactionScene',
        title: t('fields.scene'),
        type: 'label',
        placeholder: '-',
        metadata: { variant: 'outline' },
      },
      {
        name: 'credits',
        title: t('fields.credits'),
        type: 'label',
        metadata: { variant: 'outline' },
      },
      {
        name: 'createdAt',
        title: t('fields.created_at'),
        type: 'time',
      },
    ],
    data: credits,
    pagination: {
      total,
      page,
      limit,
    },
  };

  const remainingCredits = await getRemainingCredits(user.id);
  const formattedRemainingCredits = new Intl.NumberFormat().format(
    remainingCredits
  );
  const packageCredits = [100, 500, 1000];
  const packageProductIds: Record<number, string> = {
    100: 'credits-100',
    500: 'credits-500',
    1000: 'credits-1000',
  };
  const packageItems = packageCredits.map((creditsValue) => ({
    creditsValue,
    productId: packageProductIds[creditsValue],
    name: t(`view.packages.items.${creditsValue}.name` as any),
    description: t(`view.packages.items.${creditsValue}.description` as any),
    price: t(`view.packages.items.${creditsValue}.price` as any),
  }));

  const tabs: Tab[] = [
    {
      title: t('list.tabs.all'),
      name: 'all',
      url: '/settings/credits',
      is_active: !type || type === 'all',
    },
    {
      title: t('list.tabs.grant'),
      name: 'grant',
      url: '/settings/credits?type=grant',
      is_active: type === 'grant',
    },
    {
      title: t('list.tabs.consume'),
      name: 'consume',
      url: '/settings/credits?type=consume',
      is_active: type === 'consume',
    },
  ];

  return (
    <div className="space-y-8">
      <div className="rounded-xl border bg-card p-5 shadow-sm sm:p-6">
        <div className="mb-4 flex items-center gap-2 text-sm font-medium text-foreground">
          <Coins className="text-primary h-4 w-4" />
          <span>{t('view.title')}</span>
        </div>
        <div className="text-primary text-4xl leading-none font-bold tracking-tight sm:text-5xl">
          {formattedRemainingCredits}
        </div>
        <div className="text-muted-foreground mt-2 text-xs">
          {t('fields.credits')}
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-base font-semibold">{t('view.packages.title')}</div>
        <div className="grid gap-3 md:grid-cols-3">
          {packageItems.map((item) => (
            <div
              key={item.creditsValue}
              className="rounded-xl border bg-card p-4 shadow-sm"
            >
              <div className="text-sm font-semibold">{item.name}</div>
              <div className="text-muted-foreground mt-1 text-xs">
                {item.description}
              </div>
              <div className="mt-3 text-sm">
                {t('view.packages.credits')}:{' '}
                <span className="font-semibold">{item.creditsValue}</span>
              </div>
              <div className="mt-1 text-sm">
                {t('view.packages.price')}:{' '}
                <span className="text-primary font-semibold">{item.price}</span>
              </div>
              <div className="mt-4">
                <a
                  href={`/api/payment/checkout?product_id=${item.productId}&locale=${locale}`}
                  className="inline-flex h-9 w-full items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  {t('view.packages.purchase')}
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
      <TableCard title={t('list.title')} tabs={tabs} table={table} />
    </div>
  );
}
