import { ReactNode } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { LocaleDetector } from '@/shared/blocks/common';
import { DashboardLayout } from '@/shared/blocks/dashboard/layout';
import { getAllConfigs } from '@/shared/models/config';
import { Sidebar as SidebarType } from '@/shared/types/blocks/dashboard';

export default async function UserDashboardLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [t, configs] = await Promise.all([
    getTranslations('dashboard.sidebar'),
    getAllConfigs(),
  ]);

  const sidebar: SidebarType = t.raw('sidebar');

  if (configs.app_name) {
    sidebar.header!.brand!.title = `${configs.app_name} Console`;
    sidebar.header!.brand!.logo!.alt = configs.app_name;
  }
  if (configs.app_logo) {
    sidebar.header!.brand!.logo!.src = configs.app_logo;
  }

  return (
    <DashboardLayout sidebar={sidebar}>
      <LocaleDetector />
      {children}
    </DashboardLayout>
  );
}
