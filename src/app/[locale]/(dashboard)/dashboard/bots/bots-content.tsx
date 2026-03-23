'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';

import {
  BotCardView,
  BotCardsClient,
} from '@/app/[locale]/(dashboard)/dashboard/bots/bot-cards-client';

type StatusTone = 'success' | 'warning' | 'neutral';

type BotRecord = {
  id: string;
  botName: string;
  appName: string;
  gatewayToken: string;
  machineState: string;
  region: string;
  volumeSizeGb: number;
  machineCpus: number;
  machineMemoryMb: number;
  telegramBotToken: string;
  createdAt: unknown;
  updatedAt: unknown;
};

const toDate = (value: unknown) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'number' || typeof value === 'string') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
};

const formatDateTime = (value: unknown, locale: string) => {
  const date = toDate(value);
  if (!date) return '-';
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const getStatusTone = (state: string): StatusTone => {
  const normalized = (state || '').toLowerCase();
  if (['started', 'running', 'created'].includes(normalized)) {
    return 'success';
  }
  if (['stopped', 'failed', 'destroyed', 'suspended'].includes(normalized)) {
    return 'warning';
  }
  return 'neutral';
};

const toCard = (item: BotRecord, locale: string): BotCardView => ({
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
});

export function BotsContent({ locale }: { locale: string }) {
  const t = useTranslations('dashboard.bots');
  const [cards, setCards] = useState<BotCardView[]>([]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const resp = await fetch('/api/dashboard/bots', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          cache: 'no-store',
        });
        const result = await resp.json();
        if (!resp.ok || result?.code !== 0) {
          throw new Error(result?.message || 'load dashboard bots failed');
        }
        const bots = Array.isArray(result?.data?.bots) ? result.data.bots : [];
        if (!cancelled) {
          setCards(bots.map((item: BotRecord) => toCard(item, locale)));
        }
      } catch (e) {
        console.log('load dashboard bots failed:', e);
        if (!cancelled) {
          setCards([]);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [locale]);

  const labels = useMemo(
    () => ({
      createdAt: t('labels.created_at'),
      updatedAt: t('labels.updated_at'),
      config: t('labels.configure'),
      openclawPanel: t('labels.openclaw_panel'),
      emptyTitle: t('empty.title'),
      emptyDescription: t('empty.description'),
    }),
    [t]
  );

  return <BotCardsClient initialCards={cards} labels={labels} />;
}

