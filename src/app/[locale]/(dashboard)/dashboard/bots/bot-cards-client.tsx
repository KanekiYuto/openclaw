'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Bot,
  Cpu,
  ExternalLink,
  HardDrive,
  LoaderCircle,
  MapPin,
  Settings2,
  MemoryStick,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Link } from '@/core/i18n/navigation';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardTitle } from '@/shared/components/ui/card';
import { cn } from '@/shared/lib/utils';

type StatusTone = 'success' | 'warning' | 'neutral';

export type BotCardView = {
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

type Labels = {
  createdAt: string;
  updatedAt: string;
  config: string;
  openclawPanel: string;
  emptyTitle: string;
  emptyDescription: string;
};

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

function formatMemory(memoryMb: number) {
  if (memoryMb >= 1024) {
    const memoryGb = memoryMb / 1024;
    return Number.isInteger(memoryGb)
      ? `${memoryGb} GB`
      : `${memoryGb.toFixed(1)} GB`;
  }
  return `${memoryMb} MB`;
}

function getOpenClawPanelUrl(appName: string, gatewayToken: string) {
  const token = encodeURIComponent(gatewayToken || '');
  return `https://${appName}.fly.dev/dashboard#token=${token}`;
}

export function BotCardsClient({
  initialCards,
  labels,
}: {
  initialCards: BotCardView[];
  labels: Labels;
}) {
  const tRegion = useTranslations('dashboard.sidebar.sidebar.deploy_dialog');
  const [cards, setCards] = useState<BotCardView[]>(initialCards);
  const botIds = useMemo(() => initialCards.map((item) => item.id), [initialCards]);

  const resolveRegionLabel = (region: string) => {
    const code = (region || '').trim().toLowerCase();
    if (!code) return '-';
    try {
      return tRegion(`regions.${code}`);
    } catch {
      return region;
    }
  };

  const formatCardTitle = (item: BotCardView) => {
    const botName = (item.botName || '').trim() || item.appName;
    return `${botName}(${item.appName})`;
  };

  useEffect(() => {
    if (botIds.length === 0) return;

    let stopped = false;

    async function syncStatus() {
      try {
        const resp = await fetch('/api/bot/sync-status', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            botIds,
          }),
        });

        if (!resp.ok) return;
        const result = await resp.json();
        if (result.code !== 0 || !result.data?.items) return;

        const nextById = new Map<string, string>();
        for (const row of result.data.items as Array<{ id: string; machineState: string }>) {
          if (row?.id) {
            nextById.set(row.id, row.machineState || 'unknown');
          }
        }

        if (stopped || nextById.size === 0) return;

        setCards((prev) =>
          prev.map((item) => {
            const nextState = nextById.get(item.id);
            if (!nextState || nextState === item.machineState) {
              return item;
            }
            return {
              ...item,
              machineState: nextState,
              statusTone: getStatusTone(nextState),
            };
          })
        );
      } catch {
        // Ignore polling errors; keep current state on UI.
      }
    }

    void syncStatus();
    const timer = setInterval(() => {
      void syncStatus();
    }, 5000);

    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [botIds]);

  const isEmpty = useMemo(() => cards.length === 0, [cards.length]);

  if (isEmpty) {
    return (
      <div className="rounded-2xl border border-dashed px-5 py-10 text-center">
        <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-slate-950 text-white dark:bg-white dark:text-slate-950">
          <Bot className="size-5" />
        </div>
        <div className="text-base font-medium">{labels.emptyTitle}</div>
        <p className="text-muted-foreground mx-auto mt-2 max-w-md text-sm leading-6">
          {labels.emptyDescription}
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {cards.map((item) => (
        <Card key={item.id} className="gap-0 overflow-hidden border shadow-none">
          <div className="px-6 pb-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-xl">{formatCardTitle(item)}</CardTitle>
                <Badge
                  variant="outline"
                  className={cn(
                    'flex items-center gap-1',
                    item.statusTone === 'success' &&
                      'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
                    item.statusTone === 'warning' &&
                      'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400',
                    item.statusTone === 'neutral' &&
                      'border-slate-400/30 bg-slate-500/10 text-slate-700 dark:text-slate-300'
                  )}
                >
                  {item.machineState.toLowerCase() === 'created' && (
                    <LoaderCircle className="size-3.5 animate-spin" />
                  )}
                  {item.machineState}
                </Badge>
              </div>
              <div className="flex shrink-0 gap-2">
                {item.gatewayToken ? (
                  <Button asChild size="sm" variant="outline">
                    <a
                      href={getOpenClawPanelUrl(item.appName, item.gatewayToken)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="mr-1.5 size-3.5" />
                      {labels.openclawPanel}
                    </a>
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" disabled>
                    <ExternalLink className="mr-1.5 size-3.5" />
                    {labels.openclawPanel}
                  </Button>
                )}
                <Button asChild size="sm" variant="outline">
                  <Link href={`/dashboard/bots/${item.id}/config`}>
                    <Settings2 className="mr-1.5 size-3.5" />
                    {labels.config}
                  </Link>
                </Button>
              </div>
            </div>
          </div>

          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="px-2.5">
                <MapPin className="mr-1 size-3.5" />
                {resolveRegionLabel(item.region)}
              </Badge>
              <Badge variant="outline" className="px-2.5">
                <HardDrive className="mr-1 size-3.5" />
                {item.volumeSizeGb} GB
              </Badge>
              <Badge variant="outline" className="px-2.5">
                <Cpu className="mr-1 size-3.5" />
                {item.machineCpus} vCPU
              </Badge>
              <Badge variant="outline" className="px-2.5">
                <MemoryStick className="mr-1 size-3.5" />
                {formatMemory(item.machineMemoryMb)}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-2xl bg-muted/50 px-3 py-3">
                <div className="text-muted-foreground">{labels.createdAt}</div>
                <div className="mt-1 font-medium">{item.createdLabel}</div>
              </div>
              <div className="rounded-2xl bg-muted/50 px-3 py-3">
                <div className="text-muted-foreground">{labels.updatedAt}</div>
                <div className="mt-1 font-medium">{item.updatedLabel}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
