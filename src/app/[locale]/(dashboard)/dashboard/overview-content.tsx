'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/core/i18n/navigation';
import { PendingDeployCard } from './pending-deploy-card';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent } from '@/shared/components/ui/card';

type BotRecord = {
  id: string;
  region: string;
  machineState: string;
  updatedAt: unknown;
};

type PendingDeployItem = {
  id: string;
  botName: string;
  plan: string;
  billingCycle: string;
  region: string;
  model: string;
  telegramBotToken: string;
  discordBotToken: string;
  status: string;
  paymentStatus: string;
  createdAt: string | Date | number;
  periodStartAt: string | Date | number | null;
  periodEndAt: string | Date | number | null;
  errorMessage: string;
};

type OverviewResponseData = {
  bots: BotRecord[];
  pendingDeploys: PendingDeployItem[];
};

const RUNNING_STATES = new Set(['started', 'running']);
const PROVISIONING_STATES = new Set(['created', 'starting', 'pending']);
const WARNING_STATES = new Set(['stopped', 'failed', 'destroyed', 'suspended', 'unknown']);

const normalizeState = (state: string) => state.trim().toLowerCase() || 'unknown';

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

const formatPercent = (value: number) => {
  if (!Number.isFinite(value)) return '0%';
  return `${Math.max(0, Math.min(100, Math.round(value)))}%`;
};

export function OverviewContent({ locale }: { locale: string }) {
  const t = useTranslations('dashboard.overview');
  const [loading, setLoading] = useState(true);
  const [bots, setBots] = useState<BotRecord[]>([]);
  const [pendingDeploys, setPendingDeploys] = useState<PendingDeployItem[]>([]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        const resp = await fetch('/api/dashboard/overview', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          cache: 'no-store',
        });
        const result = await resp.json();
        if (!resp.ok || result?.code !== 0) {
          throw new Error(result?.message || 'load dashboard overview failed');
        }
        const data = (result?.data || {}) as OverviewResponseData;
        if (!cancelled) {
          setBots(Array.isArray(data.bots) ? data.bots : []);
          setPendingDeploys(
            Array.isArray(data.pendingDeploys) ? data.pendingDeploys : []
          );
        }
      } catch (e) {
        console.log('load dashboard overview failed:', e);
        if (!cancelled) {
          setBots([]);
          setPendingDeploys([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const heroData = useMemo(() => {
    const totalBots = bots.length;
    const runningBots = bots.filter((item) =>
      RUNNING_STATES.has(normalizeState(item.machineState))
    ).length;
    const provisioningBots = bots.filter((item) =>
      PROVISIONING_STATES.has(normalizeState(item.machineState))
    ).length;
    const warningBots = bots.filter((item) =>
      WARNING_STATES.has(normalizeState(item.machineState))
    ).length;
    const runningRate = totalBots > 0 ? (runningBots / totalBots) * 100 : 0;

    const regionMap = new Map<string, number>();
    for (const item of bots) {
      const region = (item.region || 'unknown').trim();
      regionMap.set(region, (regionMap.get(region) || 0) + 1);
    }

    const latestUpdated = bots
      .map((item) => toDate(item.updatedAt))
      .filter((item): item is Date => Boolean(item))
      .sort((a, b) => b.getTime() - a.getTime())[0];

    return {
      heroChips: [
        `${totalBots} bot${totalBots > 1 ? 's' : ''}`,
        `${regionMap.size} region${regionMap.size > 1 ? 's' : ''}`,
        `${formatPercent(runningRate)} running`,
      ],
      heroStats: [
        {
          label: 'Running bots',
          value: String(runningBots),
          meta: `${formatPercent(runningRate)} of fleet`,
        },
        {
          label: 'Provisioning',
          value: String(provisioningBots),
          meta: 'Being initialized on Fly',
        },
        {
          label: 'Warning states',
          value: String(warningBots),
          meta: 'Needs follow-up',
        },
        {
          label: 'Last update',
          value: latestUpdated ? formatDateTime(latestUpdated, locale) : '-',
          meta: 'Most recent bot heartbeat',
        },
      ],
    };
  }, [bots, locale]);

  if (loading) {
    return (
      <div className="grid gap-6">
        <Card className="overflow-hidden border-0">
          <CardContent className="px-6 py-8 text-sm text-muted-foreground">
            Loading dashboard...
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <Card className="overflow-hidden border-0 bg-linear-to-br from-slate-950 via-slate-900 to-cyan-950 text-white shadow-lg shadow-slate-950/10">
        <CardContent className="grid gap-8 px-6 py-8 lg:grid-cols-[1.35fr_1fr] lg:px-8">
          <div className="space-y-6">
            <div className="space-y-3">
              <Badge className="bg-white/12 text-white hover:bg-white/12">
                {t('hero.eyebrow')}
              </Badge>
              <div className="space-y-3">
                <h2 className="max-w-2xl text-3xl font-semibold tracking-tight md:text-4xl">
                  {t('hero.title')}
                </h2>
                <p className="max-w-2xl text-sm leading-6 text-slate-200 md:text-base">
                  {t('hero.description')}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {heroData.heroChips.map((chip) => (
                <Badge
                  key={chip}
                  variant="outline"
                  className="border-white/15 bg-white/6 px-3 py-1 text-white"
                >
                  {chip}
                </Badge>
              ))}
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild className="bg-white text-slate-950 hover:bg-white/90">
                <Link href="/dashboard/bots">{t('hero.primary')}</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="border-white/15 bg-white/6 text-white hover:bg-white/12 hover:text-white"
              >
                <Link href="/dashboard/bots">{t('hero.secondary')}</Link>
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {heroData.heroStats.map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-white/10 bg-white/6 p-4 backdrop-blur-sm"
              >
                <div className="text-sm text-slate-300">{item.label}</div>
                <div className="mt-2 text-2xl font-semibold">{item.value}</div>
                <div className="mt-1 text-sm text-cyan-200">{item.meta}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <PendingDeployCard items={pendingDeploys} locale={locale} />
    </div>
  );
}

