'use client';

import { useState } from 'react';
import { RefreshCw, Rocket } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';

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

type ConfirmFormState = {
  botName: string;
  region: string;
  model: string;
  telegramBotToken: string;
  discordBotToken: string;
};

type ModelOptionKey =
  | 'gpt_41_mini'
  | 'gpt_54'
  | 'claude_sonnet_46'
  | 'claude_opus_46'
  | 'claude_haiku_45'
  | 'claude_35_haiku'
  | 'claude_3_haiku';

const REGION_GROUPS = [
  {
    labelKey: 'region_groups.africa',
    options: [{ value: 'jnb', labelKey: 'regions.jnb' }],
  },
  {
    labelKey: 'region_groups.apac',
    options: [
      { value: 'bom', labelKey: 'regions.bom' },
      { value: 'sin', labelKey: 'regions.sin' },
      { value: 'syd', labelKey: 'regions.syd' },
      { value: 'nrt', labelKey: 'regions.nrt' },
    ],
  },
  {
    labelKey: 'region_groups.europe',
    options: [
      { value: 'ams', labelKey: 'regions.ams' },
      { value: 'fra', labelKey: 'regions.fra' },
      { value: 'lhr', labelKey: 'regions.lhr' },
      { value: 'cdg', labelKey: 'regions.cdg' },
      { value: 'arn', labelKey: 'regions.arn' },
    ],
  },
  {
    labelKey: 'region_groups.na',
    options: [
      { value: 'iad', labelKey: 'regions.iad' },
      { value: 'ord', labelKey: 'regions.ord' },
      { value: 'dfw', labelKey: 'regions.dfw' },
      { value: 'lax', labelKey: 'regions.lax' },
      { value: 'sjc', labelKey: 'regions.sjc' },
      { value: 'ewr', labelKey: 'regions.ewr' },
      { value: 'yyz', labelKey: 'regions.yyz' },
    ],
  },
  {
    labelKey: 'region_groups.sa',
    options: [{ value: 'gru', labelKey: 'regions.gru' }],
  },
];

const MODEL_OPTIONS: Array<{
  key: ModelOptionKey;
  id: string;
}> = [
  { key: 'gpt_41_mini', id: 'newapi/openai/gpt-4.1-mini' },
  { key: 'gpt_54', id: 'newapi/openai/gpt-5.4' },
  { key: 'claude_sonnet_46', id: 'newapi/anthropic/claude-sonnet-4.6' },
  { key: 'claude_opus_46', id: 'newapi/anthropic/claude-opus-4.6' },
  { key: 'claude_haiku_45', id: 'newapi/anthropic/claude-haiku-4.5' },
  { key: 'claude_35_haiku', id: 'newapi/anthropic/claude-3.5-haiku' },
  { key: 'claude_3_haiku', id: 'newapi/anthropic/claude-3-haiku' },
];

const REGION_KEY_MAP: Record<string, string> = {
  jnb: 'regions.jnb',
  bom: 'regions.bom',
  sin: 'regions.sin',
  syd: 'regions.syd',
  nrt: 'regions.nrt',
  ams: 'regions.ams',
  fra: 'regions.fra',
  lhr: 'regions.lhr',
  cdg: 'regions.cdg',
  arn: 'regions.arn',
  iad: 'regions.iad',
  ord: 'regions.ord',
  dfw: 'regions.dfw',
  lax: 'regions.lax',
  sjc: 'regions.sjc',
  ewr: 'regions.ewr',
  yyz: 'regions.yyz',
  gru: 'regions.gru',
};

const MODEL_KEY_MAP: Record<string, string> = {
  'newapi/openai/gpt-4.1-mini': 'gpt_41_mini',
  'newapi/openai/gpt-5.4': 'gpt_54',
  'newapi/anthropic/claude-sonnet-4.6': 'claude_sonnet_46',
  'newapi/anthropic/claude-opus-4.6': 'claude_opus_46',
  'newapi/anthropic/claude-haiku-4.5': 'claude_haiku_45',
  'newapi/anthropic/claude-3.5-haiku': 'claude_35_haiku',
  'newapi/anthropic/claude-3-haiku': 'claude_3_haiku',
};

function formatDateTime(value: string | Date | number, locale: string) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function maskToken(token: string) {
  const raw = String(token || '').trim();
  if (!raw) return '-';
  if (raw.length <= 12) return `${raw.slice(0, 4)}****${raw.slice(-2)}`;
  return `${raw.slice(0, 6)}********${raw.slice(-4)}`;
}

function getRegionLabel(region: string, tDialog: ReturnType<typeof useTranslations>) {
  const key = String(region || '').trim().toLowerCase();
  const messageKey = REGION_KEY_MAP[key];
  if (!messageKey) return region || '-';
  return tDialog(messageKey);
}

function getModelLabel(model: string, tDialog: ReturnType<typeof useTranslations>) {
  const key = String(model || '').trim();
  const modelKey = MODEL_KEY_MAP[key];
  if (!modelKey) {
    return {
      name: key || '-',
      desc: '',
    };
  }
  return {
    name: tDialog(`models.${modelKey}.name`),
    desc: tDialog(`models.${modelKey}.description`),
  };
}

function getDeployStatusMeta(status: string, t: ReturnType<typeof useTranslations>) {
  if (status === 'pending_payment') {
    return { label: t('deploy_status.pending_payment'), dot: 'bg-amber-500' };
  }
  if (status === 'paid') {
    return { label: t('deploy_status.paid'), dot: 'bg-blue-500' };
  }
  if (status === 'deploying') {
    return { label: t('deploy_status.deploying'), dot: 'bg-indigo-500' };
  }
  if (status === 'deployed') {
    return { label: t('deploy_status.deployed'), dot: 'bg-emerald-500' };
  }
  if (status === 'deploy_failed') {
    return { label: t('deploy_status.deploy_failed'), dot: 'bg-rose-500' };
  }
  return { label: status, dot: 'bg-slate-400' };
}

function getPaymentStatusMeta(status: string, t: ReturnType<typeof useTranslations>) {
  if (status === 'pending') {
    return { label: t('payment_status.pending'), dot: 'bg-amber-500' };
  }
  if (status === 'paid') {
    return { label: t('payment_status.paid'), dot: 'bg-emerald-500' };
  }
  if (status === 'failed') {
    return { label: t('payment_status.failed'), dot: 'bg-rose-500' };
  }
  return { label: status || '-', dot: 'bg-slate-400' };
}

function StatusPill({
  label,
  dotClassName,
}: {
  label: string;
  dotClassName: string;
}) {
  return (
    <Badge variant="outline" className="inline-flex items-center gap-1.5">
      <span className={`size-2 rounded-full ${dotClassName}`} />
      {label}
    </Badge>
  );
}

export function PendingDeployCard({
  items,
  locale,
}: {
  items: PendingDeployItem[];
  locale: string;
}) {
  const t = useTranslations('dashboard.pending_deploy');
  const tDialog = useTranslations('dashboard.sidebar.sidebar.deploy_dialog');
  const isZh = locale.startsWith('zh');
  const router = useRouter();
  const [loadingId, setLoadingId] = useState('');
  const [loadingAction, setLoadingAction] = useState<'repay' | 'deploy' | ''>('');
  const [confirmItem, setConfirmItem] = useState<PendingDeployItem | null>(null);
  const [confirmForm, setConfirmForm] = useState<ConfirmFormState>({
    botName: '',
    region: '',
    model: '',
    telegramBotToken: '',
    discordBotToken: '',
  });

  const pendingPaymentItems = items.filter((item) => item.status === 'pending_payment');
  const paidItems = items.filter(
    (item) => item.status === 'paid' || item.status === 'deploy_failed' || item.status === 'deploying'
  );
  const deployedItems = items.filter((item) => item.status === 'deployed');

  async function handleRepay(id: string) {
    try {
      setLoadingId(id);
      setLoadingAction('repay');

      const resp = await fetch(`/api/bot/pending-deploy/${id}/repay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ locale }),
      });
      const result = await resp.json();
      if (!resp.ok || result.code !== 0) {
        throw new Error(result.message || 'repay failed');
      }

      const checkoutUrl = String(result?.data?.checkoutUrl || '').trim();
      if (!checkoutUrl) {
        throw new Error('checkout url is empty');
      }

      toast.success(t('toast.redirecting_payment'));
      window.location.href = checkoutUrl;
    } catch (e: any) {
      toast.error(e?.message || 'repay failed');
    } finally {
      setLoadingId('');
      setLoadingAction('');
    }
  }

  async function handleDeploy(id: string) {
    try {
      setLoadingId(id);
      setLoadingAction('deploy');

      const resp = await fetch(`/api/bot/pending-deploy/${id}/deploy`, {
        method: 'POST',
      });
      const result = await resp.json();
      if (!resp.ok || result.code !== 0) {
        throw new Error(result.message || 'deploy failed');
      }

      toast.success(t('toast.deploy_submitted'));
      router.refresh();
    } catch (e: any) {
      toast.error(e?.message || 'deploy failed');
    } finally {
      setLoadingId('');
      setLoadingAction('');
    }
  }

  function openDeployConfirm(item: PendingDeployItem) {
    setConfirmItem(item);
    setConfirmForm({
      botName: item.botName,
      region: item.region,
      model: item.model,
      telegramBotToken: item.telegramBotToken,
      discordBotToken: item.discordBotToken,
    });
  }

  async function confirmDeploy() {
    if (!confirmItem) return;
    const botName = confirmForm.botName.trim();
    if (!botName) {
      toast.error(t('toast.bot_name_required'));
      return;
    }

    const region = confirmForm.region.trim();
    const model = confirmForm.model.trim();
    const telegramBotToken = confirmForm.telegramBotToken.trim();
    const discordBotToken = confirmForm.discordBotToken.trim();

    const updateResp = await fetch(`/api/bot/pending-deploy/${confirmItem.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        botName,
        region,
        model,
        telegramBotToken,
        discordBotToken,
      }),
    });
    const updateResult = await updateResp.json();
    if (!updateResp.ok || updateResult.code !== 0) {
      toast.error(updateResult?.message || 'update pending deploy failed');
      return;
    }

    await handleDeploy(confirmItem.id);
    setConfirmItem(null);
  }

  function renderSection(title: string, sectionItems: PendingDeployItem[]) {
    return (
      <div className="space-y-2">
        <div className="text-sm font-medium">{title} ({sectionItems.length})</div>
        {sectionItems.length === 0 ? (
          <div className="text-muted-foreground rounded-xl border border-dashed px-3 py-3 text-xs">
            {t('empty.section')}
          </div>
        ) : (
          sectionItems.map((item) => {
            const deployStatusMeta = getDeployStatusMeta(item.status, t);
            const paymentStatusMeta = getPaymentStatusMeta(item.paymentStatus, t);
            const modelMeta = getModelLabel(item.model, tDialog);

            return (
              <div key={item.id} className="rounded-2xl border px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium">{item.botName}</div>
                  <StatusPill
                    label={deployStatusMeta.label}
                    dotClassName={deployStatusMeta.dot}
                  />
                </div>

                <div className="text-muted-foreground mt-2 grid gap-2 text-xs sm:grid-cols-2">
                  <div>{t('fields.id')}: {item.id}</div>
                  <div>{t('fields.plan')}: {item.plan} / {item.billingCycle}</div>
                  <div>{t('fields.region')}: {getRegionLabel(item.region, tDialog)}</div>
                  <div>{t('fields.telegram_bot_token')}: {maskToken(item.telegramBotToken)}</div>
                  <div>{t('fields.discord_bot_token')}: {maskToken(item.discordBotToken)}</div>
                  <div className="flex items-center gap-2">
                    <span>{t('fields.payment_status')}:</span>
                    <StatusPill
                      label={paymentStatusMeta.label}
                      dotClassName={paymentStatusMeta.dot}
                    />
                  </div>
                  <div>{t('fields.created_at')}: {formatDateTime(item.createdAt, locale)}</div>
                  {item.paymentStatus === 'paid' ? (
                    <>
                      <div>
                        {t('fields.period_start')}: {formatDateTime(item.periodStartAt || '', locale)}
                      </div>
                      <div>
                        {t('fields.period_end')}: {formatDateTime(item.periodEndAt || '', locale)}
                      </div>
                    </>
                  ) : null}
                  <div className="sm:col-span-2 rounded-lg border bg-muted/30 px-3 py-2.5">
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground/90">
                      {t('fields.default_model')}
                    </div>
                    <div className="mt-1 text-sm font-medium text-foreground">
                      {modelMeta.name}
                    </div>
                    {modelMeta.desc ? (
                      <div className="mt-1 text-[12px] leading-5 text-muted-foreground">
                        {modelMeta.desc}
                      </div>
                    ) : null}
                  </div>
                </div>

                {item.errorMessage ? (
                  <div className="mt-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                    {item.errorMessage}
                  </div>
                ) : null}

                <div className="mt-3 flex flex-wrap gap-2">
                  {item.status === 'pending_payment' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRepay(item.id)}
                      disabled={loadingId === item.id}
                    >
                      <RefreshCw className="mr-1.5 size-3.5" />
                      {loadingId === item.id && loadingAction === 'repay'
                        ? t('actions.repay_loading')
                        : t('actions.repay')}
                    </Button>
                  )}

                  {(item.status === 'paid' || item.status === 'deploy_failed') && (
                    <Button
                      size="sm"
                      onClick={() => openDeployConfirm(item)}
                      disabled={loadingId === item.id}
                    >
                      <Rocket className="mr-1.5 size-3.5" />
                      {loadingId === item.id && loadingAction === 'deploy'
                        ? t('actions.deploy_loading')
                        : t('actions.deploy')}
                    </Button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardDescription>{t('card.description')}</CardDescription>
        <CardTitle>{t('card.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.length === 0 ? (
          <div className="text-muted-foreground rounded-2xl border border-dashed px-4 py-6 text-sm">
            {t('empty.all')}
          </div>
        ) : (
          <>
            {renderSection(t('sections.pending_payment'), pendingPaymentItems)}
            {renderSection(t('sections.paid_waiting'), paidItems)}
            {renderSection(t('sections.deployed'), deployedItems)}
          </>
        )}
      </CardContent>

      <Dialog
        open={Boolean(confirmItem)}
        onOpenChange={(open) => {
          if (!open) setConfirmItem(null);
        }}
      >
        <DialogContent className="sm:max-w-[620px]">
          <DialogHeader>
            <DialogTitle>{t('confirm.title')}</DialogTitle>
            <DialogDescription>{t('confirm.description')}</DialogDescription>
          </DialogHeader>

          {confirmItem ? (
            <div className="grid gap-2 text-sm">
              <div className="rounded-md border bg-muted/30 px-3 py-2">
                <span className="text-muted-foreground">{t('confirm.plan')}: </span>
                <span className="font-medium">
                  {confirmItem.plan} / {confirmItem.billingCycle}
                </span>
              </div>

              <div className="grid gap-1.5">
                <div className="text-muted-foreground text-xs">{t('confirm.bot_name')}</div>
                <Input
                  value={confirmForm.botName}
                  onChange={(e) =>
                    setConfirmForm((prev) => ({ ...prev, botName: e.target.value }))
                  }
                />
              </div>

              <div className="grid gap-1.5">
                <div className="text-muted-foreground text-xs">{t('confirm.region')}</div>
                <Select
                  value={confirmForm.region}
                  onValueChange={(value) =>
                    setConfirmForm((prev) => ({ ...prev, region: value }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REGION_GROUPS.map((group) => (
                      <SelectGroup key={group.labelKey}>
                        <SelectLabel>{tDialog(group.labelKey)}</SelectLabel>
                        {group.options.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {tDialog(option.labelKey)}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-1.5">
                <div className="text-muted-foreground text-xs">{t('confirm.default_model')}</div>
                <Select
                  value={confirmForm.model}
                  onValueChange={(value) =>
                    setConfirmForm((prev) => ({ ...prev, model: value }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MODEL_OPTIONS.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {tDialog(`models.${option.key}.name`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {getModelLabel(confirmForm.model, tDialog).desc ? (
                  <div className="text-muted-foreground text-xs leading-5">
                    {getModelLabel(confirmForm.model, tDialog).desc}
                  </div>
                ) : null}
              </div>

              <div className="grid gap-1.5">
                <div className="text-muted-foreground text-xs">{t('confirm.telegram_bot_token')}</div>
                <Input
                  value={confirmForm.telegramBotToken}
                  onChange={(e) =>
                    setConfirmForm((prev) => ({
                      ...prev,
                      telegramBotToken: e.target.value,
                    }))
                  }
                />
                <p className="text-muted-foreground text-xs leading-5">
                  {tDialog('hints.telegram_setup')}{' '}
                  <a
                    href="https://docs.openclaw.ai/channels/telegram"
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-primary underline-offset-2 hover:underline"
                  >
                    {tDialog('hints.telegram_docs')}
                  </a>
                </p>
              </div>

              <div className="grid gap-1.5">
                <div className="text-muted-foreground text-xs">{t('confirm.discord_bot_token')}</div>
                <Input
                  value={confirmForm.discordBotToken}
                  onChange={(e) =>
                    setConfirmForm((prev) => ({
                      ...prev,
                      discordBotToken: e.target.value,
                    }))
                  }
                />
                <p className="text-muted-foreground text-xs leading-5">
                  {tDialog('hints.discord_setup')}{' '}
                  <a
                    href="https://docs.openclaw.ai/channels/discord"
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-primary underline-offset-2 hover:underline"
                  >
                    {tDialog('hints.discord_docs')}
                  </a>
                </p>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmItem(null)}
            >
              {t('confirm.cancel')}
            </Button>
            <Button
              type="button"
              onClick={confirmDeploy}
              disabled={
                !confirmItem ||
                (loadingId === confirmItem.id && loadingAction === 'deploy')
              }
            >
              {confirmItem && loadingId === confirmItem.id && loadingAction === 'deploy'
                ? t('actions.deploy_loading')
                : t('confirm.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
