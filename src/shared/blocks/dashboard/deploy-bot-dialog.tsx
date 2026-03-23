'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, Circle, Coins, LoaderCircle } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Link } from '@/core/i18n/navigation';
import {
  BOT_DEPLOY_PLAN_KEYS,
  BOT_DEPLOY_PLANS,
  type DeployPlan,
} from '@/shared/config/bot-deploy-plans';
import { SmartIcon } from '@/shared/blocks/common';
import { Button } from '@/shared/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/components/ui/dialog';
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
import { cn } from '@/shared/lib/utils';
import { Button as ButtonType } from '@/shared/types/blocks/common';

type PlanKey = DeployPlan;
type BillingCycle = 'monthly' | 'yearly';
type ModelOptionKey =
  | 'gpt_41_mini'
  | 'gpt_54'
  | 'claude_sonnet_46'
  | 'claude_opus_46'
  | 'claude_haiku_45'
  | 'claude_35_haiku'
  | 'claude_3_haiku';

type DeployResult = {
  id: string;
  appName: string;
  status: string;
  region: string;
  model?: string;
};

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
  {
    key: 'gpt_41_mini',
    id: 'newapi/openai/gpt-4.1-mini',
  },
  {
    key: 'gpt_54',
    id: 'newapi/openai/gpt-5.4',
  },
  {
    key: 'claude_sonnet_46',
    id: 'newapi/anthropic/claude-sonnet-4.6',
  },
  {
    key: 'claude_opus_46',
    id: 'newapi/anthropic/claude-opus-4.6',
  },
  {
    key: 'claude_haiku_45',
    id: 'newapi/anthropic/claude-haiku-4.5',
  },
  {
    key: 'claude_35_haiku',
    id: 'newapi/anthropic/claude-3.5-haiku',
  },
  {
    key: 'claude_3_haiku',
    id: 'newapi/anthropic/claude-3-haiku',
  },
];
const DEFAULT_MODEL_ID = 'newapi/anthropic/claude-sonnet-4.6';

function formatMemory(memoryMb: number) {
  if (memoryMb % 1024 === 0) {
    return {
      amount: memoryMb / 1024,
      unit: 'GB',
    }
  }

  return {
    amount: memoryMb,
    unit: 'MB',
  }
}

function formatCredits(value: number) {
  if (!Number.isFinite(value)) return '0';
  if (value >= 1000) {
    const k = value / 1000;
    return Number.isInteger(k) ? `${k}k` : `${k.toFixed(1)}k`;
  }
  return String(value);
}

export function DeployBotDialog({
  button,
  isCollapsed,
}: {
  button: ButtonType;
  isCollapsed: boolean;
}) {
  const t = useTranslations('dashboard.sidebar.sidebar.deploy_dialog');
  const locale = useLocale();

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [plan, setPlan] = useState<PlanKey>('pro');
  const [region, setRegion] = useState('nrt');
  const [model, setModel] = useState<string>(DEFAULT_MODEL_ID);
  const [botName, setBotName] = useState('');
  const [telegramToken, setTelegramToken] = useState('');
  const [discordToken, setDiscordToken] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [deployResult, setDeployResult] = useState<DeployResult | null>(null);

  const selectedPlan = useMemo(
    () => BOT_DEPLOY_PLANS[plan],
    [plan]
  );
  const selectedModel = useMemo(
    () =>
      MODEL_OPTIONS.find((item) => item.id === model) ||
      MODEL_OPTIONS.find((item) => item.id === DEFAULT_MODEL_ID) ||
      MODEL_OPTIONS[0],
    [model]
  );
  const stepTitles = [t('steps.plan'), t('steps.configure'), t('steps.connect')];

  function resetState() {
    setStep(1);
    setBillingCycle('monthly');
    setPlan('pro');
    setRegion('nrt');
    setModel(DEFAULT_MODEL_ID);
    setBotName('');
    setTelegramToken('');
    setDiscordToken('');
    setIsSubmitting(false);
    setSubmitError('');
    setDeployResult(null);
  }

  async function handleDeploy() {
    const token = telegramToken.trim();
    const discord = discordToken.trim();
    const name = botName.trim();

    if (!name) {
      toast.error(t('errors.bot_name_required'));
      return;
    }

    try {
      setSubmitError('');
      setIsSubmitting(true);
      setStep(3);

      const resp = await fetch('/api/bot/pending-deploy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          plan,
          billingCycle,
          region,
          model,
          botName: name,
          telegramBotToken: token,
          discordBotToken: discord,
          locale,
        }),
      });

      if (!resp.ok) {
        throw new Error(`request failed with status: ${resp.status}`);
      }

      const result = await resp.json();
      if (result.code !== 0) {
        throw new Error(result.message || t('errors.deploy_failed'));
      }

      const checkoutUrl = String(result?.data?.checkoutUrl || '').trim();
      if (!checkoutUrl) {
        throw new Error('checkout url is empty');
      }

      setDeployResult(result.data || null);
      toast.success('Pending deploy created', {
        description: 'Redirecting to payment checkout...',
      });
      window.location.href = checkoutUrl;
    } catch (e: any) {
      const message = e.message || t('errors.deploy_failed');
      setSubmitError(message);
      toast.error(button.title || 'Deploy Bot', {
        description: message,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          resetState();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button
          type="button"
          variant={button.variant || 'outline'}
          size={button.size || 'default'}
          className={cn(
            isCollapsed
              ? 'h-6 w-6 justify-center p-0 [&_svg]:size-4 [&_svg]:shrink-0'
              : undefined
          )}
          aria-label={button.title || undefined}
          title={button.title || undefined}
        >
          {button.icon && (
            <SmartIcon name={button.icon as string} className="size-4 shrink-0" />
          )}
          {button.title && !isCollapsed && (
            <span className="whitespace-nowrap">{button.title}</span>
          )}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[760px]">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('step_desc', { step })}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {stepTitles.map((item, index) => {
              const stepIndex = index + 1;
              const active = step === stepIndex;
              const done = step > stepIndex;

              return (
                <div
                  key={item}
                  className={cn(
                    'flex items-center gap-2 rounded-md border px-2.5 py-2 text-xs sm:px-3 sm:text-sm',
                    active && 'border-primary bg-primary/5 text-primary',
                    !active && !done && 'text-muted-foreground',
                    done &&
                      'border-emerald-500/40 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400'
                  )}
                >
                  {done ? (
                    <CheckCircle2 className="size-4" />
                  ) : (
                    <Circle className="size-4" />
                  )}
                  <span className="truncate">{item}</span>
                </div>
              );
            })}
          </div>

          <div className="rounded-xl border bg-muted/10 p-4 sm:p-5">
            {step === 1 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="text-sm font-medium">{t('sections.billing')}</div>
                  <div className="inline-flex w-full rounded-md border p-1 sm:w-auto">
                    <button
                      type="button"
                      onClick={() => setBillingCycle('monthly')}
                      className={cn(
                        'flex-1 rounded-sm px-3 py-1.5 text-sm sm:flex-none',
                        billingCycle === 'monthly'
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground'
                      )}
                    >
                      {t('billing.monthly')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setBillingCycle('yearly')}
                      className={cn(
                        'flex-1 rounded-sm px-3 py-1.5 text-sm sm:flex-none',
                        billingCycle === 'yearly'
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground'
                      )}
                    >
                      {t('billing.yearly')}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium">{t('sections.package')}</div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {BOT_DEPLOY_PLAN_KEYS.map((planKey) => {
                      const item = BOT_DEPLOY_PLANS[planKey];
                      return (
                      <button
                        key={planKey}
                        type="button"
                        className={cn(
                          'rounded-xl border p-0 text-left transition-colors',
                          plan === planKey
                            ? 'border-primary bg-primary/5'
                            : 'hover:bg-muted/30'
                        )}
                        onClick={() => setPlan(planKey)}
                      >
                        <div className="border-b px-3 py-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="font-medium">{t(`plans.${planKey}.title`)}</div>
                            {item.recommended && (
                              <div className="rounded-md border border-primary/40 px-1.5 py-0.5 text-[10px] text-primary">
                                {t('plans.recommended')}
                              </div>
                            )}
                          </div>
                          <div className="text-muted-foreground mt-1 text-xs leading-5">
                            {t(`plans.${planKey}.description`)}
                          </div>
                        </div>
                        <div className="px-3 py-3">
                          <div className="flex items-end gap-1">
                            <div className="text-2xl font-semibold tabular-nums">
                              ${billingCycle === 'monthly' ? item.monthlyPrice : item.yearlyPrice}
                            </div>
                            <div className="text-muted-foreground pb-0.5 text-xs">
                              {billingCycle === 'monthly'
                                ? t('billing.monthly_suffix')
                                : t('billing.yearly_suffix')}
                            </div>
                          </div>
                          <div className="mt-2">
                            <div className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                              <Coins className="size-3.5" />
                              <span className="tabular-nums">
                                {t('labels.token_rate', {
                                  credits:
                                    billingCycle === 'monthly'
                                      ? formatCredits(item.monthlyCredits)
                                      : formatCredits(item.yearlyCredits),
                                })}
                              </span>
                            </div>
                          </div>
                          <div className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
                            <div className="rounded-md border bg-background/60 px-2.5 py-2">
                              <div className="text-muted-foreground">{t('labels.cpu')}</div>
                              <div className="mt-1 flex items-center justify-between gap-1 sm:justify-start">
                                <div className="font-medium tabular-nums">{item.cpus}</div>
                                <div>vCPU</div>
                              </div>
                            </div>
                            <div className="rounded-md border bg-background/60 px-2.5 py-2">
                              <div className="text-muted-foreground">{t('labels.memory')}</div>
                              <div className="mt-1 flex items-center justify-between gap-1 sm:justify-start">
                                <div className="font-medium tabular-nums">
                                  {formatMemory(item.memoryMb).amount}
                                </div>
                                <div>{formatMemory(item.memoryMb).unit}</div>
                              </div>
                            </div>
                            <div className="rounded-md border bg-background/60 px-2.5 py-2">
                              <div className="text-muted-foreground">{t('labels.disk')}</div>
                              <div className="mt-1 flex items-center justify-between gap-1 sm:justify-start">
                                <div className="font-medium tabular-nums">{item.volumeGb}</div>
                                <div>GB</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div className="rounded-lg border bg-background p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium">
                        {t('selected_plan', {
                          plan: t(`plans.${plan}.title`),
                        })}
                      </div>
                      <div className="text-muted-foreground mt-1 text-xs">
                        {t(`plans.${plan}.description`)}
                      </div>
                    </div>
                    <div className="rounded-full border px-2.5 py-1 text-xs">
                      {billingCycle === 'monthly'
                        ? t('billing.monthly')
                        : t('billing.yearly')}
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <div className="rounded-md border bg-muted/20 px-3 py-2">
                      <div className="text-muted-foreground text-xs">{t('labels.cpu')}</div>
                      <div className="mt-1 text-sm font-medium tabular-nums">
                        {selectedPlan.cpus} vCPU
                      </div>
                    </div>
                    <div className="rounded-md border bg-muted/20 px-3 py-2">
                      <div className="text-muted-foreground text-xs">
                        {t('labels.memory')}
                      </div>
                      <div className="mt-1 text-sm font-medium tabular-nums">
                        {formatMemory(selectedPlan.memoryMb).amount}{' '}
                        {formatMemory(selectedPlan.memoryMb).unit}
                      </div>
                    </div>
                    <div className="rounded-md border bg-muted/20 px-3 py-2">
                      <div className="text-muted-foreground text-xs">{t('labels.disk')}</div>
                      <div className="mt-1 text-sm font-medium tabular-nums">
                        {selectedPlan.volumeGb} GB
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-lg border bg-background p-4">
                    <div className="mb-3 text-sm font-medium">{t('groups.basic')}</div>
                    <div className="space-y-2">
                      <label htmlFor="deploy-bot-name" className="text-sm font-medium">
                        {t('labels.bot_name')} *
                      </label>
                      <Input
                        id="deploy-bot-name"
                        value={botName}
                        onChange={(e) => setBotName(e.target.value)}
                        placeholder={t('placeholders.bot_name')}
                        required
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>

                  <div className="rounded-lg border bg-background p-4">
                    <div className="mb-3 text-sm font-medium">{t('groups.channels')}</div>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label
                          htmlFor="deploy-telegram-token"
                          className="text-sm font-medium"
                        >
                          {t('labels.telegram')}
                        </label>
                        <Input
                          id="deploy-telegram-token"
                          type="password"
                          value={telegramToken}
                          onChange={(e) => setTelegramToken(e.target.value)}
                          placeholder={t('placeholders.telegram')}
                          autoComplete="off"
                          disabled={isSubmitting}
                        />
                        <p className="text-muted-foreground text-xs leading-5">
                          {t('hints.telegram_setup')}{' '}
                          <a
                            href="https://docs.openclaw.ai/channels/telegram"
                            target="_blank"
                            rel="noreferrer noopener"
                            className="text-primary underline-offset-2 hover:underline"
                          >
                            {t('hints.telegram_docs')}
                          </a>
                        </p>
                      </div>
                      <div className="space-y-2">
                        <label
                          htmlFor="deploy-discord-token"
                          className="text-sm font-medium"
                        >
                          {t('labels.discord')}
                        </label>
                        <Input
                          id="deploy-discord-token"
                          type="password"
                          value={discordToken}
                          onChange={(e) => setDiscordToken(e.target.value)}
                          placeholder={t('placeholders.discord')}
                          autoComplete="off"
                          disabled={isSubmitting}
                        />
                        <p className="text-muted-foreground text-xs leading-5">
                          {t('hints.discord_setup')}{' '}
                          <a
                            href="https://docs.openclaw.ai/channels/discord"
                            target="_blank"
                            rel="noreferrer noopener"
                            className="text-primary underline-offset-2 hover:underline"
                          >
                            {t('hints.discord_docs')}
                          </a>
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border bg-background p-4">
                    <div className="mb-3 text-sm font-medium">{t('groups.deployment')}</div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">{t('labels.region')}</label>
                      <Select value={region} onValueChange={setRegion}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={t('placeholders.select_region')} />
                        </SelectTrigger>
                        <SelectContent>
                          {REGION_GROUPS.map((group) => (
                            <SelectGroup key={group.labelKey}>
                              <SelectLabel>{t(group.labelKey)}</SelectLabel>
                              {group.options.map((item) => (
                                <SelectItem key={item.value} value={item.value}>
                                  {t(item.labelKey)}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="mt-4 space-y-2">
                      <label className="text-sm font-medium">{t('labels.default_model')}</label>
                      <Select value={model} onValueChange={setModel}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={t('placeholders.select_model')} />
                        </SelectTrigger>
                        <SelectContent>
                          {MODEL_OPTIONS.map((item) => (
                            <SelectItem key={item.id} value={item.id}>
                              {t(`models.${item.key}.name`)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="rounded-md border bg-muted/20 px-3 py-2">
                        <p className="text-sm font-medium">
                          {t(`models.${selectedModel.key}.name`)}
                        </p>
                        <p className="text-muted-foreground mt-1 text-xs leading-5">
                          {t(`models.${selectedModel.key}.description`)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                {isSubmitting ? (
                  <div className="rounded-md border bg-background px-4 py-5">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <LoaderCircle className="size-4 animate-spin" />
                      {t('status.deploying')}
                    </div>
                    <p className="text-muted-foreground mt-2 text-sm">
                      {t('status.deploying_desc')}
                    </p>
                  </div>
                ) : submitError ? (
                  <div className="rounded-md border border-red-300 bg-red-50 px-4 py-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                    {submitError}
                  </div>
                ) : (
                  <div className="rounded-md border bg-background px-4 py-5">
                    <div className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 className="size-4" />
                      {t('status.success')}
                    </div>
                    <div className="text-muted-foreground mt-3 grid gap-1 text-sm">
                      <div>
                        {t('result.deployment_id')}: {deployResult?.id || '-'}
                      </div>
                      <div>
                        {t('result.app')}: {deployResult?.appName || '-'}
                      </div>
                      <div>
                        {t('result.region')}: {deployResult?.region || region}
                      </div>
                      <div>
                        {t('labels.default_model')}: {t(`models.${selectedModel.key}.name`)}
                      </div>
                      <div>
                        {t('result.status')}: {deployResult?.status || t('result.queued')}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:justify-between">
            {step === 1 ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                className="w-full sm:w-auto"
              >
                {t('actions.cancel')}
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => {
                  if (step === 3 && submitError) {
                    setStep(2);
                  } else if (step > 1 && !isSubmitting) {
                    setStep((prev) => {
                      if (prev === 3) return 2;
                      return 1;
                    });
                  }
                }}
                disabled={isSubmitting}
              >
                {step === 3 && submitError
                  ? t('actions.back_to_config')
                  : t('actions.back')}
              </Button>
            )}

            {step === 1 && (
              <Button type="button" onClick={() => setStep(2)} className="w-full sm:w-auto">
                {t('actions.next')}
              </Button>
            )}

            {step === 2 && (
              <Button
                type="button"
                onClick={handleDeploy}
                disabled={isSubmitting}
                className="w-full sm:w-auto"
              >
                {t('actions.deploy')}
              </Button>
            )}

            {step === 3 && !isSubmitting && !submitError && (
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                  className="w-full sm:w-auto"
                >
                  {t('actions.close')}
                </Button>
                <Button asChild className="w-full sm:w-auto">
                  <Link href="/dashboard/bots">{t('actions.go_to_bots')}</Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
