'use client';

import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/shared/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Switch } from '@/shared/components/ui/switch';
import { useTranslations } from 'next-intl';

type PairingRequestItem = {
  id: string;
  code: string;
  createdAt?: string;
  lastSeenAt?: string;
  meta?: {
    username?: string;
    firstName?: string;
    tag?: string;
    name?: string;
    accountId?: string;
  };
};

export function BotConfigForm({
  botId,
  initialTelegramToken,
  initialDiscordToken,
  initialTelegramEnabled,
  initialDiscordEnabled,
}: {
  botId: string;
  initialTelegramToken: string;
  initialDiscordToken: string;
  initialTelegramEnabled: boolean;
  initialDiscordEnabled: boolean;
}) {
  const t = useTranslations('dashboard.bots');

  const [telegramToken, setTelegramToken] = useState(initialTelegramToken);
  const [discordToken, setDiscordToken] = useState(initialDiscordToken);
  const [telegramEnabled, setTelegramEnabled] = useState(initialTelegramEnabled);
  const [discordEnabled, setDiscordEnabled] = useState(initialDiscordEnabled);
  const [isSavingTelegram, setIsSavingTelegram] = useState(false);
  const [isSavingDiscord, setIsSavingDiscord] = useState(false);
  const [isLoadingPairing, setIsLoadingPairing] = useState(false);
  const [isLoadingDiscordPairing, setIsLoadingDiscordPairing] = useState(false);
  const [approvingCode, setApprovingCode] = useState<string | null>(null);
  const [approvingDiscordCode, setApprovingDiscordCode] = useState<string | null>(
    null
  );
  const [pairingRequests, setPairingRequests] = useState<PairingRequestItem[]>([]);
  const [discordPairingRequests, setDiscordPairingRequests] = useState<
    PairingRequestItem[]
  >([]);

  async function saveTelegramToken() {
    const token = telegramToken.trim();
    if (telegramEnabled && !token) {
      toast.error(t('telegram_modal.token_required'));
      return;
    }

    try {
      setIsSavingTelegram(true);
      const resp = await fetch('/api/bot/telegram-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          botId,
          token,
          enabled: telegramEnabled,
        }),
      });

      if (!resp.ok) {
        throw new Error(`request failed with status: ${resp.status}`);
      }

      const result = await resp.json();
      if (result.code !== 0) {
        throw new Error(result.message || t('telegram_modal.save_failed'));
      }

      toast.success(t('telegram_modal.save_success'));
    } catch (e: any) {
      toast.error(e.message || t('telegram_modal.save_failed'));
    } finally {
      setIsSavingTelegram(false);
    }
  }

  async function saveDiscordToken() {
    const token = discordToken.trim();
    if (discordEnabled && !token) {
      toast.error(t('discord_modal.token_required'));
      return;
    }

    try {
      setIsSavingDiscord(true);
      const resp = await fetch('/api/bot/discord-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          botId,
          token,
          enabled: discordEnabled,
        }),
      });

      if (!resp.ok) {
        throw new Error(`request failed with status: ${resp.status}`);
      }

      const result = await resp.json();
      if (result.code !== 0) {
        throw new Error(result.message || t('discord_modal.save_failed'));
      }

      toast.success(t('discord_modal.save_success'));
    } catch (e: any) {
      toast.error(e.message || t('discord_modal.save_failed'));
    } finally {
      setIsSavingDiscord(false);
    }
  }

  async function loadPairingRequests() {
    try {
      setIsLoadingPairing(true);
      const resp = await fetch('/api/bot/telegram-pairing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ botId }),
      });

      if (!resp.ok) {
        throw new Error(`request failed with status: ${resp.status}`);
      }

      const result = await resp.json();
      if (result.code !== 0) {
        throw new Error(result.message || t('telegram_modal.pairing_load_failed'));
      }

      const rows = Array.isArray(result.data?.requests) ? result.data.requests : [];
      setPairingRequests(rows);
    } catch (e: any) {
      toast.error(e.message || t('telegram_modal.pairing_load_failed'));
    } finally {
      setIsLoadingPairing(false);
    }
  }

  async function approvePairing(code: string) {
    try {
      setApprovingCode(code);
      const resp = await fetch('/api/bot/telegram-pairing/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ botId, code }),
      });

      if (!resp.ok) {
        throw new Error(`request failed with status: ${resp.status}`);
      }

      const result = await resp.json();
      if (result.code !== 0) {
        throw new Error(result.message || t('telegram_modal.pairing_approve_failed'));
      }

      toast.success(t('telegram_modal.pairing_approve_success'));
      await loadPairingRequests();
    } catch (e: any) {
      toast.error(e.message || t('telegram_modal.pairing_approve_failed'));
    } finally {
      setApprovingCode(null);
    }
  }

  async function loadDiscordPairingRequests() {
    try {
      setIsLoadingDiscordPairing(true);
      const resp = await fetch('/api/bot/discord-pairing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ botId }),
      });

      if (!resp.ok) {
        throw new Error(`request failed with status: ${resp.status}`);
      }

      const result = await resp.json();
      if (result.code !== 0) {
        throw new Error(result.message || t('discord_modal.pairing_load_failed'));
      }

      const rows = Array.isArray(result.data?.requests) ? result.data.requests : [];
      setDiscordPairingRequests(rows);
    } catch (e: any) {
      toast.error(e.message || t('discord_modal.pairing_load_failed'));
    } finally {
      setIsLoadingDiscordPairing(false);
    }
  }

  async function approveDiscordPairing(code: string) {
    try {
      setApprovingDiscordCode(code);
      const resp = await fetch('/api/bot/discord-pairing/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ botId, code }),
      });

      if (!resp.ok) {
        throw new Error(`request failed with status: ${resp.status}`);
      }

      const result = await resp.json();
      if (result.code !== 0) {
        throw new Error(result.message || t('discord_modal.pairing_approve_failed'));
      }

      toast.success(t('discord_modal.pairing_approve_success'));
      await loadDiscordPairingRequests();
    } catch (e: any) {
      toast.error(e.message || t('discord_modal.pairing_approve_failed'));
    } finally {
      setApprovingDiscordCode(null);
    }
  }

  return (
    <div className="grid gap-5">
      <Card className="overflow-hidden border shadow-none">
        <CardHeader className="border-b bg-muted/20">
          <CardTitle>{t('config_page.telegram_section')}</CardTitle>
          <CardDescription>{t('telegram_modal.pairing_description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="flex items-center justify-between rounded-md border bg-background px-3 py-2">
            <label className="text-sm font-medium" htmlFor={`telegram-enabled-${botId}`}>
              {t('telegram_modal.enabled_label')}
            </label>
            <Switch
              id={`telegram-enabled-${botId}`}
              checked={telegramEnabled}
              onCheckedChange={setTelegramEnabled}
              disabled={isSavingTelegram}
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
            <div className="space-y-2">
              <label htmlFor={`telegram-token-page-${botId}`} className="text-sm font-medium">
                {t('telegram_modal.token_label')}
              </label>
              <Input
                id={`telegram-token-page-${botId}`}
                type="password"
                value={telegramToken}
                onChange={(e) => setTelegramToken(e.target.value)}
                placeholder={t('telegram_modal.token_placeholder')}
                autoComplete="off"
                disabled={isSavingTelegram}
              />
              <a
                href="https://docs.openclaw.ai/channels/telegram"
                target="_blank"
                rel="noreferrer noopener"
                className="text-primary block text-xs underline-offset-2 hover:underline"
              >
                {t('config_page.telegram_docs')}
              </a>
            </div>
            <Button
              type="button"
              className="shadow-none"
              onClick={saveTelegramToken}
              disabled={isSavingTelegram}
            >
              {isSavingTelegram ? t('telegram_modal.saving') : t('telegram_modal.confirm')}
            </Button>
          </div>

          <div className="rounded-lg border bg-muted/20 p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="text-sm font-medium">{t('telegram_modal.tabs.pairing')}</div>
              <Button
                type="button"
                variant="outline"
                className="shadow-none"
                onClick={loadPairingRequests}
                disabled={isLoadingPairing}
              >
                {t('telegram_modal.pairing_action')}
              </Button>
            </div>

            <div>
              {isLoadingPairing ? (
                <div className="text-muted-foreground rounded-md border bg-background px-3 py-2 text-sm">
                  {t('telegram_modal.pairing_loading')}
                </div>
              ) : pairingRequests.length === 0 ? (
                <div className="text-muted-foreground rounded-md border bg-background px-3 py-2 text-sm">
                  {t('telegram_modal.pairing_empty')}
                </div>
              ) : (
                <div className="max-h-64 space-y-2 overflow-auto pr-1">
                  {pairingRequests.map((item) => (
                    <div
                      key={`${item.id}-${item.code}`}
                      className="grid gap-3 rounded-md border bg-background p-3 sm:grid-cols-[1fr_auto]"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium">{item.id}</div>
                        <div className="text-muted-foreground text-xs">{item.code}</div>
                        <div className="text-muted-foreground mt-1 text-xs">
                          {t('telegram_modal.pairing_item_user')}: {item.meta?.username || '-'}
                        </div>
                        <div className="text-muted-foreground text-xs">
                          {t('telegram_modal.pairing_item_name')}: {item.meta?.firstName || '-'}
                        </div>
                        <div className="text-muted-foreground text-xs">
                          {t('telegram_modal.pairing_item_created_at')}: {item.createdAt || '-'}
                        </div>
                      </div>
                      <div className="sm:justify-self-end">
                        <Button
                          type="button"
                          size="sm"
                          className="shadow-none"
                          disabled={approvingCode === item.code}
                          onClick={() => approvePairing(item.code)}
                        >
                          {approvingCode === item.code
                            ? t('telegram_modal.pairing_approving')
                            : t('telegram_modal.pairing_approve')}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border shadow-none">
        <CardHeader className="border-b bg-muted/20">
          <CardTitle>{t('config_page.discord_section')}</CardTitle>
          <CardDescription>{t('discord_modal.pairing_description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="flex items-center justify-between rounded-md border bg-background px-3 py-2">
            <label className="text-sm font-medium" htmlFor={`discord-enabled-${botId}`}>
              {t('discord_modal.enabled_label')}
            </label>
            <Switch
              id={`discord-enabled-${botId}`}
              checked={discordEnabled}
              onCheckedChange={setDiscordEnabled}
              disabled={isSavingDiscord}
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
            <div className="space-y-2">
              <label htmlFor={`discord-token-page-${botId}`} className="text-sm font-medium">
                {t('discord_modal.token_label')}
              </label>
              <Input
                id={`discord-token-page-${botId}`}
                type="password"
                value={discordToken}
                onChange={(e) => setDiscordToken(e.target.value)}
                placeholder={t('discord_modal.token_placeholder')}
                autoComplete="off"
                disabled={isSavingDiscord}
              />
              <a
                href="https://docs.openclaw.ai/channels/discord"
                target="_blank"
                rel="noreferrer noopener"
                className="text-primary block text-xs underline-offset-2 hover:underline"
              >
                {t('config_page.discord_docs')}
              </a>
            </div>
            <Button
              type="button"
              className="shadow-none"
              onClick={saveDiscordToken}
              disabled={isSavingDiscord}
            >
              {isSavingDiscord ? t('discord_modal.saving') : t('discord_modal.confirm')}
            </Button>
          </div>

          <div className="rounded-lg border bg-muted/20 p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="text-sm font-medium">{t('telegram_modal.tabs.pairing')}</div>
              <Button
                type="button"
                variant="outline"
                className="shadow-none"
                onClick={loadDiscordPairingRequests}
                disabled={isLoadingDiscordPairing}
              >
                {t('discord_modal.pairing_action')}
              </Button>
            </div>

            <div>
              {isLoadingDiscordPairing ? (
                <div className="text-muted-foreground rounded-md border bg-background px-3 py-2 text-sm">
                  {t('discord_modal.pairing_loading')}
                </div>
              ) : discordPairingRequests.length === 0 ? (
                <div className="text-muted-foreground rounded-md border bg-background px-3 py-2 text-sm">
                  {t('discord_modal.pairing_empty')}
                </div>
              ) : (
                <div className="max-h-64 space-y-2 overflow-auto pr-1">
                  {discordPairingRequests.map((item) => (
                    <div
                      key={`${item.id}-${item.code}`}
                      className="grid gap-3 rounded-md border bg-background p-3 sm:grid-cols-[1fr_auto]"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium">{item.id}</div>
                        <div className="text-muted-foreground text-xs">{item.code}</div>
                        <div className="text-muted-foreground mt-1 text-xs">
                          {t('discord_modal.pairing_item_tag')}: {item.meta?.tag || '-'}
                        </div>
                        <div className="text-muted-foreground text-xs">
                          {t('discord_modal.pairing_item_name')}: {item.meta?.name || '-'}
                        </div>
                        <div className="text-muted-foreground text-xs">
                          {t('discord_modal.pairing_item_account_id')}:{' '}
                          {item.meta?.accountId || '-'}
                        </div>
                        <div className="text-muted-foreground text-xs">
                          {t('discord_modal.pairing_item_created_at')}: {item.createdAt || '-'}
                        </div>
                        <div className="text-muted-foreground text-xs">
                          {t('discord_modal.pairing_item_last_seen_at')}:{' '}
                          {item.lastSeenAt || '-'}
                        </div>
                      </div>
                      <div className="sm:justify-self-end">
                        <Button
                          type="button"
                          size="sm"
                          className="shadow-none"
                          disabled={approvingDiscordCode === item.code}
                          onClick={() => approveDiscordPairing(item.code)}
                        >
                          {approvingDiscordCode === item.code
                            ? t('discord_modal.pairing_approving')
                            : t('discord_modal.pairing_approve')}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
