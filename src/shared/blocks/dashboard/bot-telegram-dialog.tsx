'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button } from '@/shared/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/components/ui/dialog';
import { Input } from '@/shared/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';

type BotTelegramDialogProps = {
  botId: string;
  appName: string;
  initialToken: string;
};

type PairingRequestItem = {
  id: string;
  code: string;
  createdAt?: string;
  lastSeenAt?: string;
  meta?: {
    username?: string;
    firstName?: string;
    accountId?: string;
  };
};

export function BotTelegramDialog({
  botId,
  appName,
  initialToken,
}: BotTelegramDialogProps) {
  const t = useTranslations('dashboard.bots');
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('token');
  const [savedToken, setSavedToken] = useState(initialToken);
  const [token, setToken] = useState(initialToken);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingPairing, setIsLoadingPairing] = useState(false);
  const [approvingCode, setApprovingCode] = useState<string | null>(null);
  const [pairingRequests, setPairingRequests] = useState<PairingRequestItem[]>([]);

  async function handleSave() {
    const trimmed = token.trim();
    if (!trimmed) {
      toast.error(t('telegram_modal.token_required'));
      return;
    }

    try {
      setIsSaving(true);

      const resp = await fetch('/api/bot/telegram-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          botId,
          token: trimmed,
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
      setSavedToken(trimmed);
      setToken(trimmed);
      setOpen(false);
    } catch (e: any) {
      toast.error(e.message || t('telegram_modal.save_failed'));
    } finally {
      setIsSaving(false);
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

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) {
          setToken(savedToken);
          setActiveTab('token');
        }
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline">
          {t('labels.telegram_config')}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{t('telegram_modal.title', { app: appName })}</DialogTitle>
        </DialogHeader>
        <Tabs
          value={activeTab}
          onValueChange={(value) => {
            setActiveTab(value);
            if (value === 'pairing') {
              void loadPairingRequests();
            }
          }}
          className="space-y-3"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="token">{t('telegram_modal.tabs.token')}</TabsTrigger>
            <TabsTrigger value="pairing">
              {t('telegram_modal.tabs.pairing')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="token" className="space-y-4">
            <div className="space-y-2">
              <label
                htmlFor={`telegram-token-${botId}`}
                className="text-sm font-medium"
              >
                {t('telegram_modal.token_label')}
              </label>
              <Input
                id={`telegram-token-${botId}`}
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder={t('telegram_modal.token_placeholder')}
                autoComplete="off"
                disabled={isSaving}
              />
            </div>
            <div className="flex justify-end gap-2">
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={isSaving}>
                  {t('telegram_modal.cancel')}
                </Button>
              </DialogClose>
              <Button type="button" onClick={handleSave} disabled={isSaving}>
                {isSaving ? t('telegram_modal.saving') : t('telegram_modal.confirm')}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="pairing" className="space-y-4">
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
              {t('telegram_modal.pairing_description')}
            </div>
            {isLoadingPairing ? (
              <div className="text-muted-foreground text-sm">
                {t('telegram_modal.pairing_loading')}
              </div>
            ) : pairingRequests.length === 0 ? (
              <div className="text-muted-foreground text-sm">
                {t('telegram_modal.pairing_empty')}
              </div>
            ) : (
              <div className="max-h-64 space-y-2 overflow-auto pr-1">
                {pairingRequests.map((item) => (
                  <div
                    key={`${item.id}-${item.code}`}
                    className="flex items-start justify-between gap-3 rounded-md border p-3"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium">
                        {t('telegram_modal.pairing_item_id')}: {item.id}
                      </div>
                      <div className="text-sm">
                        {t('telegram_modal.pairing_item_code')}: {item.code}
                      </div>
                      <div className="text-muted-foreground text-xs">
                        {t('telegram_modal.pairing_item_user')}:{' '}
                        {item.meta?.username || '-'}
                      </div>
                      <div className="text-muted-foreground text-xs">
                        {t('telegram_modal.pairing_item_name')}:{' '}
                        {item.meta?.firstName || '-'}
                      </div>
                      <div className="text-muted-foreground text-xs">
                        {t('telegram_modal.pairing_item_created_at')}:{' '}
                        {item.createdAt || '-'}
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      disabled={approvingCode === item.code}
                      onClick={() => approvePairing(item.code)}
                    >
                      {approvingCode === item.code
                        ? t('telegram_modal.pairing_approving')
                        : t('telegram_modal.pairing_approve')}
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  {t('telegram_modal.cancel')}
                </Button>
              </DialogClose>
              <Button type="button" onClick={loadPairingRequests} disabled={isLoadingPairing}>
                {t('telegram_modal.pairing_action')}
              </Button>
            </div>
          </TabsContent>

        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
