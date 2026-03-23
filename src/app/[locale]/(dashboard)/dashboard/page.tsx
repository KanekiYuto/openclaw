import { getTranslations, setRequestLocale } from 'next-intl/server';

import { OverviewContent } from './overview-content';
import { Header, Main, MainHeader } from '@/shared/blocks/dashboard';
import { Button as ButtonType, Crumb } from '@/shared/types/blocks/common';

export default async function DashboardOverviewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('dashboard.overview');

  const crumbs: Crumb[] = [{ title: t('page.crumb'), is_active: true }];
  const actions: ButtonType[] = [
    {
      title: t('page.primary_action'),
      url: '/dashboard/bots',
      icon: 'Bot',
    },
  ];

  return (
    <>
      <Header crumbs={crumbs} show_theme />
      <Main>
        <MainHeader
          title={t('page.title')}
          description={t('page.description')}
          actions={actions}
        />
        <OverviewContent locale={locale} />
      </Main>
    </>
  );
}
