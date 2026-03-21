import { getTranslations, setRequestLocale } from 'next-intl/server';

import { BotCardsClient } from '@/app/[locale]/(dashboard)/dashboard/bots/bot-cards-client';
import { Header, Main, MainHeader } from '@/shared/blocks/dashboard';
import { BotRecord, getBots } from '@/shared/models/bots';
import { Button as ButtonType, Crumb } from '@/shared/types/blocks/common';

type StatusTone = 'success' | 'warning' | 'neutral';

type BotCard = {
  id: string;
  botName: string;
  appName: string;
  gatewayToken: string;
  machineState: string;
  statusTone: StatusTone;
  region: string;
  volumeSizeGb: number;
  machineCpus: number;
  machineMemoryMb: number;
  telegramBotToken: string;
  createdLabel: string;
  updatedLabel: string;
};

function toDate(value: unknown) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'number' || typeof value === 'string') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}

function formatDateTime(value: unknown, locale: string) {
  const date = toDate(value);
  if (!date) return '-';

  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatMemory(memoryMb: number) {
  if (memoryMb >= 1024) {
    const memoryGb = memoryMb / 1024;
    return Number.isInteger(memoryGb)
      ? `${memoryGb} GB`
      : `${memoryGb.toFixed(1)} GB`;
  }

  return `${memoryMb} MB`;
}

function getStatusTone(state: string): StatusTone {
  const normalized = state.toLowerCase();

  if (['started', 'running', 'created'].includes(normalized)) {
    return 'success';
  }

  if (['stopped', 'failed', 'destroyed', 'suspended'].includes(normalized)) {
    return 'warning';
  }

  return 'neutral';
}

export default async function DashboardBotsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('dashboard.bots');
  const rows: BotRecord[] = await getBots();

  const crumbs: Crumb[] = [
    { title: t('page.crumbs.dashboard'), url: '/dashboard' },
    { title: t('page.crumbs.bots'), is_active: true },
  ];

  const actions: ButtonType[] = [
    {
      title: t('page.primary_action'),
      url: '/dashboard',
      icon: 'LayoutDashboard',
    },
  ];

  const botCards: BotCard[] = rows.map((item: BotRecord) => ({
    id: item.id,
    botName: item.botName || '',
    appName: item.appName,
    gatewayToken: item.gatewayToken,
    machineState: item.machineState,
    statusTone: getStatusTone(item.machineState),
    region: item.region,
    volumeSizeGb: item.volumeSizeGb,
    machineCpus: item.machineCpus,
    machineMemoryMb: item.machineMemoryMb,
    telegramBotToken: item.telegramBotToken || '',
    createdLabel: formatDateTime(item.createdAt, locale),
    updatedLabel: formatDateTime(item.updatedAt, locale),
  }));

  return (
    <>
      <Header crumbs={crumbs} show_locale={false} show_theme />
      <Main>
        <MainHeader
          title={t('page.title')}
          description={t('page.description')}
          actions={actions}
        />

        <div className="grid gap-6">
          <BotCardsClient
            initialCards={botCards}
            labels={{
              createdAt: t('labels.created_at'),
              updatedAt: t('labels.updated_at'),
              config: t('labels.configure'),
              openclawPanel: t('labels.openclaw_panel'),
              emptyTitle: t('empty.title'),
              emptyDescription: t('empty.description'),
            }}
          />
        </div>
      </Main>
    </>
  );
}
