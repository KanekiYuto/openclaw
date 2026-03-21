import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { BotConfigForm } from '@/app/[locale]/(dashboard)/dashboard/bots/[botId]/config/bot-config-form';
import { Header, Main, MainHeader } from '@/shared/blocks/dashboard';
import { getBotById } from '@/shared/models/bots';
import { getFlyMachineEnv } from '@/shared/services/fly';
import { Button as ButtonType, Crumb } from '@/shared/types/blocks/common';

export default async function BotConfigPage({
  params,
}: {
  params: Promise<{ locale: string; botId: string }>;
}) {
  const { locale, botId } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('dashboard.bots');
  const bot = await getBotById(botId);

  if (!bot) {
    notFound();
  }

  let initialTelegramEnabled = Boolean(bot.telegramBotToken || '');
  let initialDiscordEnabled = Boolean(bot.discordBotToken || '');
  try {
    const { env } = await getFlyMachineEnv(bot.appName, bot.machineId);
    initialTelegramEnabled = String(env.TELEGRAM_ENABLED || '').toLowerCase() === 'true';
    initialDiscordEnabled = String(env.DISCORD_ENABLED || '').toLowerCase() === 'true';
  } catch (e) {
    console.log('get fly machine env failed, fallback to token-based flags:', e);
  }

  const crumbs: Crumb[] = [
    { title: t('page.crumbs.dashboard'), url: '/dashboard' },
    { title: t('page.crumbs.bots'), url: '/dashboard/bots' },
    { title: t('labels.configure'), is_active: true },
  ];

  const actions: ButtonType[] = [
    {
      title: t('config_page.back_to_bots'),
      url: '/dashboard/bots',
      icon: 'Bot',
      variant: 'outline',
    },
  ];

  return (
    <>
      <Header crumbs={crumbs} show_locale={false} show_theme />
      <Main>
        <MainHeader
          title={`${bot.appName} · ${t('config_page.title')}`}
          description={t('config_page.description')}
          actions={actions}
        />
        <BotConfigForm
          botId={bot.id}
          initialTelegramToken={bot.telegramBotToken || ''}
          initialDiscordToken={bot.discordBotToken || ''}
          initialTelegramEnabled={initialTelegramEnabled}
          initialDiscordEnabled={initialDiscordEnabled}
        />
      </Main>
    </>
  );
}
