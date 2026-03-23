import { desc, eq } from 'drizzle-orm';

import { bot, botApp, botMachine, botVolume } from '@/config/db/schema';
import { db } from '@/core/db';

export type BotRecord = {
  id: string;
  appName: string;
  network: string;
  region: string;
  volumeName: string;
  volumeSizeGb: number;
  machineCpuKind: string;
  machineCpus: number;
  machineMemoryMb: number;
  machineId: string;
  botName: string;
  machineState: string;
  gatewayToken: string;
  apiToken: string;
  telegramBotToken: string;
  discordBotToken: string;
  createdAt: unknown;
  updatedAt: unknown;
};

export type NewBotRecord = {
  bot: {
    id: string;
    botName: string;
    gatewayToken: string;
    apiToken: string;
    channelTelegramBotToken: string;
    channelDiscordBotToken: string;
  };
  app: {
    id: string;
    appName: string;
    network: string;
    region: string;
    ip: string;
  };
  machine: {
    id: string;
    machineId: string;
    cpuKind: string;
    cpus: number;
    memoryMb: number;
    machineState: string;
  };
  volume: {
    id: string;
    volumeName: string;
    volumeId: string;
    region: string;
    sizeGb: number;
  };
};

export async function createBot(newBot: NewBotRecord) {
  return db().transaction(async (tx: any) => {
    const [createdBot] = await tx
      .insert(bot)
      .values({
        id: newBot.bot.id,
        botName: newBot.bot.botName,
        gatewayToken: newBot.bot.gatewayToken,
        apiToken: newBot.bot.apiToken,
        channelTelegramBotToken: newBot.bot.channelTelegramBotToken,
        channelDiscordBotToken: newBot.bot.channelDiscordBotToken,
      })
      .returning();

    const [createdApp] = await tx
      .insert(botApp)
      .values({
        id: newBot.app.id,
        botId: newBot.bot.id,
        appName: newBot.app.appName,
        network: newBot.app.network,
        region: newBot.app.region,
        ip: newBot.app.ip,
      })
      .returning();

    const [createdMachine] = await tx
      .insert(botMachine)
      .values({
        id: newBot.machine.id,
        botAppId: newBot.app.id,
        machineId: newBot.machine.machineId,
        cpuKind: newBot.machine.cpuKind,
        cpus: newBot.machine.cpus,
        memoryMb: newBot.machine.memoryMb,
        machineState: newBot.machine.machineState,
      })
      .returning();

    const [createdVolume] = await tx
      .insert(botVolume)
      .values({
        id: newBot.volume.id,
        botMachineId: newBot.machine.id,
        volumeName: newBot.volume.volumeName,
        volumeId: newBot.volume.volumeId,
        region: newBot.volume.region,
        sizeGb: newBot.volume.sizeGb,
      })
      .returning();

    return {
      bot: createdBot,
      app: createdApp,
      machine: createdMachine,
      volume: createdVolume,
    };
  });
}

function listBotsQuery() {
  return db()
    .select({
      id: bot.id,
      appName: botApp.appName,
      network: botApp.network,
      region: botApp.region,
      volumeName: botVolume.volumeName,
      volumeSizeGb: botVolume.sizeGb,
      machineCpuKind: botMachine.cpuKind,
      machineCpus: botMachine.cpus,
      machineMemoryMb: botMachine.memoryMb,
      machineId: botMachine.machineId,
      botName: bot.botName,
      machineState: botMachine.machineState,
      gatewayToken: bot.gatewayToken,
      apiToken: bot.apiToken,
      telegramBotToken: bot.channelTelegramBotToken,
      discordBotToken: bot.channelDiscordBotToken,
      createdAt: bot.createdAt,
      updatedAt: bot.updatedAt,
    })
    .from(bot)
    .innerJoin(botApp, eq(botApp.botId, bot.id))
    .innerJoin(botMachine, eq(botMachine.botAppId, botApp.id))
    .innerJoin(botVolume, eq(botVolume.botMachineId, botMachine.id));
}

export async function getBots(limit = 50): Promise<BotRecord[]> {
  const rows = await listBotsQuery()
    .orderBy(desc(bot.createdAt))
    .limit(limit);
  return rows as BotRecord[];
}

export async function getBotById(botId: string): Promise<BotRecord | null> {
  const [record] = await listBotsQuery().where(eq(bot.id, botId)).limit(1);
  return (record as BotRecord) || null;
}

export async function updateBotTelegramToken(botId: string, token: string) {
  await db()
    .update(bot)
    .set({
      channelTelegramBotToken: token,
      updatedAt: new Date(),
    })
    .where(eq(bot.id, botId));
}

export async function updateBotDiscordToken(botId: string, token: string) {
  await db()
    .update(bot)
    .set({
      channelDiscordBotToken: token,
      updatedAt: new Date(),
    })
    .where(eq(bot.id, botId));
}

export async function updateBotMachineState(botId: string, machineState: string) {
  const [target] = await db()
    .select({
      machineRowId: botMachine.id,
    })
    .from(bot)
    .innerJoin(botApp, eq(botApp.botId, bot.id))
    .innerJoin(botMachine, eq(botMachine.botAppId, botApp.id))
    .where(eq(bot.id, botId))
    .limit(1);

  if (!target?.machineRowId) {
    return;
  }

  await db()
    .update(botMachine)
    .set({
      machineState,
      updatedAt: new Date(),
    })
    .where(eq(botMachine.id, target.machineRowId));

  await db()
    .update(bot)
    .set({
      updatedAt: new Date(),
    })
    .where(eq(bot.id, botId));
}
