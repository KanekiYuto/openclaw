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

type BotNewApiKeyDialogProps = {
  botId: string;
  appName: string;
};

export function BotNewApiKeyDialog({ botId, appName }: BotNewApiKeyDialogProps) {
  const t = useTranslations('dashboard.bots');
  const [open, setOpen] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  async function handleSave() {
    const trimmed = apiKey.trim();
    if (!trimmed) {
      toast.error(t('newapi_modal.key_required'));
      return;
    }

    try {
      setIsSaving(true);

      const resp = await fetch('/api/bot/newapi-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          botId,
          apiKey: trimmed,
        }),
      });

      if (!resp.ok) {
        throw new Error(`request failed with status: ${resp.status}`);
      }

      const result = await resp.json();
      if (result.code !== 0) {
        throw new Error(result.message || t('newapi_modal.save_failed'));
      }

      toast.success(t('newapi_modal.save_success'));
      setApiKey('');
      setOpen(false);
    } catch (e: any) {
      toast.error(e.message || t('newapi_modal.save_failed'));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setApiKey('');
        }
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline">
          {t('labels.newapi_config')}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{t('newapi_modal.title', { app: appName })}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor={`newapi-key-${botId}`} className="text-sm font-medium">
              {t('newapi_modal.key_label')}
            </label>
            <Input
              id={`newapi-key-${botId}`}
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={t('newapi_modal.key_placeholder')}
              autoComplete="off"
              disabled={isSaving}
            />
          </div>
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isSaving}>
                {t('newapi_modal.cancel')}
              </Button>
            </DialogClose>
            <Button type="button" onClick={handleSave} disabled={isSaving}>
              {isSaving ? t('newapi_modal.saving') : t('newapi_modal.confirm')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

