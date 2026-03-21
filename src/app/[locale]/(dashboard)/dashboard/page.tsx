import {
  Activity,
  Bot,
  CheckCircle2,
  Clock3,
  Cpu,
  Globe2,
  HardDrive,
  LoaderCircle,
  ShieldAlert,
  type LucideIcon,
} from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { Link } from '@/core/i18n/navigation';
import { Header, Main, MainHeader } from '@/shared/blocks/dashboard';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import { Progress } from '@/shared/components/ui/progress';
import { cn } from '@/shared/lib/utils';
import { BotRecord, getBots } from '@/shared/models/bots';
import { Button as ButtonType, Crumb } from '@/shared/types/blocks/common';

type HeroStat = {
  label: string;
  value: string;
  meta: string;
};

type MetricItem = {
  title: string;
  value: string;
  description: string;
};

type ActivityItem = {
  title: string;
  meta: string;
  description: string;
  tone: 'success' | 'warning' | 'info';
};

type ChannelItem = {
  name: string;
  status: string;
  value: string;
  progress: number;
};

type UsageItem = {
  label: string;
  value: string;
  progress: number;
};

const RUNNING_STATES = new Set(['started', 'running']);
const PROVISIONING_STATES = new Set(['created', 'starting', 'pending']);
const WARNING_STATES = new Set([
  'stopped',
  'failed',
  'destroyed',
  'suspended',
  'unknown',
]);

function normalizeState(state: string) {
  return state.trim().toLowerCase() || 'unknown';
}

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

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return '0%';
  return `${Math.max(0, Math.min(100, Math.round(value)))}%`;
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

function getStatusTone(
  state: string
): 'success' | 'warning' | 'info' | 'neutral' {
  const normalized = normalizeState(state);

  if (RUNNING_STATES.has(normalized)) {
    return 'success';
  }

  if (WARNING_STATES.has(normalized)) {
    return 'warning';
  }

  if (PROVISIONING_STATES.has(normalized)) {
    return 'info';
  }

  return 'neutral';
}

export default async function DashboardOverviewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('dashboard.overview');
  const rows: BotRecord[] = await getBots(200);

  const crumbs: Crumb[] = [{ title: t('page.crumb'), is_active: true }];
  const actions: ButtonType[] = [
    {
      title: t('page.primary_action'),
      url: '/dashboard/bots',
      icon: 'Bot',
    },
  ];

  const totalBots = rows.length;
  const runningBots = rows.filter((item) =>
    RUNNING_STATES.has(normalizeState(item.machineState))
  ).length;
  const provisioningBots = rows.filter((item) =>
    PROVISIONING_STATES.has(normalizeState(item.machineState))
  ).length;
  const warningBots = rows.filter((item) =>
    WARNING_STATES.has(normalizeState(item.machineState))
  ).length;

  const runningRate = totalBots > 0 ? (runningBots / totalBots) * 100 : 0;
  const healthyRate =
    totalBots > 0 ? ((totalBots - warningBots) / totalBots) * 100 : 100;

  const telegramLinkedBots = rows.filter((item) =>
    Boolean(item.telegramBotToken?.trim())
  ).length;
  const telegramCoverage =
    totalBots > 0 ? (telegramLinkedBots / totalBots) * 100 : 0;

  const totalCpu = rows.reduce((sum, item) => sum + (item.machineCpus || 0), 0);
  const totalMemoryMb = rows.reduce(
    (sum, item) => sum + (item.machineMemoryMb || 0),
    0
  );

  const regionMap = new Map<string, number>();
  for (const item of rows) {
    const region = (item.region || 'unknown').trim();
    regionMap.set(region, (regionMap.get(region) || 0) + 1);
  }

  const topRegions: ChannelItem[] = Array.from(regionMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([name, count]) => ({
      name,
      status: `${count} bot${count > 1 ? 's' : ''}`,
      value: formatPercent(totalBots > 0 ? (count / totalBots) * 100 : 0),
      progress: totalBots > 0 ? Math.round((count / totalBots) * 100) : 0,
    }));

  const latestUpdated = rows
    .map((item) => toDate(item.updatedAt))
    .filter((item): item is Date => Boolean(item))
    .sort((a, b) => b.getTime() - a.getTime())[0];

  const recentBots: ActivityItem[] = [...rows]
    .sort(
      (a, b) =>
        (toDate(b.updatedAt)?.getTime() || 0) - (toDate(a.updatedAt)?.getTime() || 0)
    )
    .slice(0, 3)
    .map((item) => {
      const tone = getStatusTone(item.machineState);
      const normalized = normalizeState(item.machineState);

      return {
        title: item.appName,
        meta: formatDateTime(item.updatedAt, locale),
        description: `Machine state: ${normalized}. Region: ${item.region}.`,
        tone:
          tone === 'success' ? 'success' : tone === 'warning' ? 'warning' : 'info',
      };
    });

  const checklistItems = t.raw('sections.checklist.items') as string[];

  const heroChips = [
    `${totalBots} bot${totalBots > 1 ? 's' : ''}`,
    `${regionMap.size} region${regionMap.size > 1 ? 's' : ''}`,
    `${formatPercent(runningRate)} running`,
  ];

  const heroStats: HeroStat[] = [
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
  ];

  const metrics: MetricItem[] = [
    {
      title: 'Total bots',
      value: String(totalBots),
      description: 'All bot records tracked in the workspace.',
    },
    {
      title: 'Running now',
      value: String(runningBots),
      description: 'Bots currently in running/started state.',
    },
    {
      title: 'Telegram linked',
      value: String(telegramLinkedBots),
      description: `${formatPercent(telegramCoverage)} of bots have Telegram token configured.`,
    },
    {
      title: 'Health score',
      value: formatPercent(healthyRate),
      description: 'Share of bots not in warning state.',
    },
  ];

  const usageItems: UsageItem[] = [
    {
      label: 'Telegram coverage',
      value: formatPercent(telegramCoverage),
      progress: Math.round(telegramCoverage),
    },
    {
      label: 'Fleet running ratio',
      value: formatPercent(runningRate),
      progress: Math.round(runningRate),
    },
    {
      label: 'Healthy ratio',
      value: formatPercent(healthyRate),
      progress: Math.round(healthyRate),
    },
  ];

  const metricIcons: LucideIcon[] = [Bot, Activity, CheckCircle2, ShieldAlert];

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
                  {heroChips.map((chip) => (
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
                  <Button
                    asChild
                    className="bg-white text-slate-950 hover:bg-white/90"
                  >
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
                {heroStats.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-white/10 bg-white/6 p-4 backdrop-blur-sm"
                  >
                    <div className="text-sm text-slate-300">{item.label}</div>
                    <div className="mt-2 text-2xl font-semibold">
                      {item.value}
                    </div>
                    <div className="mt-1 text-sm text-cyan-200">{item.meta}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {metrics.map((item, index) => {
              const Icon = metricIcons[index] || Activity;
              return (
                <Card key={item.title} className="gap-0">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <CardDescription>{item.title}</CardDescription>
                        <CardTitle className="text-3xl">{item.value}</CardTitle>
                      </div>
                      <div className="rounded-xl bg-slate-950 p-2 text-white dark:bg-white dark:text-slate-950">
                        <Icon className="size-4" />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground text-sm">
                      {item.description}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
            <Card>
              <CardHeader>
                <CardDescription>
                  {t('sections.activity.eyebrow')}
                </CardDescription>
                <CardTitle>{t('sections.activity.title')}</CardTitle>
                <p className="text-muted-foreground text-sm">
                  {t('sections.activity.description')}
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {recentBots.length === 0 ? (
                  <div className="text-muted-foreground rounded-2xl border border-dashed px-4 py-6 text-sm">
                    No bot activity yet.
                  </div>
                ) : (
                  recentBots.map((item) => (
                    <div
                      key={`${item.title}-${item.meta}`}
                      className="flex gap-4 rounded-2xl border px-4 py-4"
                    >
                      <div
                        className={cn(
                          'mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full',
                          item.tone === 'success' &&
                            'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400',
                          item.tone === 'warning' &&
                            'bg-amber-500/12 text-amber-600 dark:text-amber-400',
                          item.tone === 'info' &&
                            'bg-sky-500/12 text-sky-600 dark:text-sky-400'
                        )}
                      >
                        {item.tone === 'success' ? (
                          <CheckCircle2 className="size-4" />
                        ) : item.tone === 'warning' ? (
                          <ShieldAlert className="size-4" />
                        ) : (
                          <LoaderCircle className="size-4" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="font-medium">{item.title}</div>
                          <div className="text-muted-foreground text-xs">
                            {item.meta}
                          </div>
                        </div>
                        <p className="text-muted-foreground text-sm leading-6">
                          {item.description}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <div className="grid gap-6">
              <Card>
                <CardHeader>
                  <CardDescription>
                    {t('sections.channels.eyebrow')}
                  </CardDescription>
                  <CardTitle>{t('sections.channels.title')}</CardTitle>
                  <p className="text-muted-foreground text-sm">
                    Top regions by bot count.
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {topRegions.length === 0 ? (
                    <div className="text-muted-foreground rounded-2xl border border-dashed px-4 py-6 text-sm">
                      No region data yet.
                    </div>
                  ) : (
                    topRegions.map((item) => (
                      <div key={item.name} className="space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="rounded-full bg-sky-500/10 p-2 text-sky-600 dark:text-sky-400">
                              <Globe2 className="size-4" />
                            </div>
                            <div>
                              <div className="font-medium">{item.name}</div>
                              <div className="text-muted-foreground text-xs">
                                {item.status}
                              </div>
                            </div>
                          </div>
                          <div className="text-sm font-medium">{item.value}</div>
                        </div>
                        <Progress value={item.progress} />
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardDescription>{t('sections.usage.eyebrow')}</CardDescription>
                  <CardTitle>{t('sections.usage.title')}</CardTitle>
                  <p className="text-muted-foreground text-sm">
                    Fleet configuration and readiness indicators.
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-2xl bg-muted/50 px-3 py-3">
                      <div className="text-muted-foreground flex items-center gap-1">
                        <Cpu className="size-3.5" /> CPU
                      </div>
                      <div className="mt-1 font-medium">{totalCpu} vCPU</div>
                    </div>
                    <div className="rounded-2xl bg-muted/50 px-3 py-3">
                      <div className="text-muted-foreground flex items-center gap-1">
                        <HardDrive className="size-3.5" /> Memory
                      </div>
                      <div className="mt-1 font-medium">{formatMemory(totalMemoryMb)}</div>
                    </div>
                  </div>

                  {usageItems.map((item, index) => (
                    <div key={item.label} className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          {index % 2 === 0 ? (
                            <Activity className="text-muted-foreground size-4" />
                          ) : (
                            <Clock3 className="text-muted-foreground size-4" />
                          )}
                          <span className="text-sm font-medium">{item.label}</span>
                        </div>
                        <span className="text-muted-foreground text-sm">
                          {item.value}
                        </span>
                      </div>
                      <Progress value={item.progress} />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardDescription>{t('sections.checklist.eyebrow')}</CardDescription>
              <CardTitle>{t('sections.checklist.title')}</CardTitle>
              <p className="text-muted-foreground text-sm">
                {t('sections.checklist.description')}
              </p>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {checklistItems.map((item) => (
                <div
                  key={item}
                  className="flex items-start gap-3 rounded-2xl border bg-slate-50/70 px-4 py-4 dark:bg-slate-950/30"
                >
                  <div className="rounded-full bg-emerald-500/10 p-2 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="size-4" />
                  </div>
                  <div className="text-sm leading-6">{item}</div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </Main>
    </>
  );
}
