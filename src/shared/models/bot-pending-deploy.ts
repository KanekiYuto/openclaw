import { and, desc, eq } from 'drizzle-orm';

import { botPendingDeploy, order, subscription } from '@/config/db/schema';
import { db } from '@/core/db';

export const BOT_PENDING_DEPLOY_STATUS = {
  PENDING_PAYMENT: 'pending_payment',
  PAID: 'paid',
  DEPLOYING: 'deploying',
  DEPLOYED: 'deployed',
  DEPLOY_FAILED: 'deploy_failed',
} as const;

export type BotPendingDeployStatus =
  (typeof BOT_PENDING_DEPLOY_STATUS)[keyof typeof BOT_PENDING_DEPLOY_STATUS];

export const BOT_PENDING_DEPLOY_PAYMENT_STATUS = {
  PENDING: 'pending',
  PAID: 'paid',
  FAILED: 'failed',
} as const;

export type BotPendingDeployPaymentStatus =
  (typeof BOT_PENDING_DEPLOY_PAYMENT_STATUS)[keyof typeof BOT_PENDING_DEPLOY_PAYMENT_STATUS];

export type BotPendingDeploy = typeof botPendingDeploy.$inferSelect;
export type BotPendingDeployListItem = BotPendingDeploy & {
  periodStartAt: unknown;
  periodEndAt: unknown;
};
export type NewBotPendingDeploy = typeof botPendingDeploy.$inferInsert;
export type UpdateBotPendingDeploy = Partial<
  Omit<NewBotPendingDeploy, 'id' | 'userId' | 'createdAt'>
>;

export async function createBotPendingDeploy(input: NewBotPendingDeploy) {
  const [result] = await db().insert(botPendingDeploy).values(input).returning();
  return result;
}

export async function getBotPendingDeployById(id: string, userId: string) {
  const [result] = await db()
    .select()
    .from(botPendingDeploy)
    .where(and(eq(botPendingDeploy.id, id), eq(botPendingDeploy.userId, userId)))
    .limit(1);
  return result || null;
}

export async function listBotPendingDeploysByUser(userId: string, limit = 20) {
  const rows = await db()
    .select({
      pending: botPendingDeploy,
      periodStartAt: subscription.currentPeriodStart,
      periodEndAt: subscription.currentPeriodEnd,
    })
    .from(botPendingDeploy)
    .leftJoin(order, eq(order.orderNo, botPendingDeploy.paymentOrderNo))
    .leftJoin(subscription, eq(subscription.subscriptionNo, order.subscriptionNo))
    .where(eq(botPendingDeploy.userId, userId))
    .orderBy(desc(botPendingDeploy.createdAt))
    .limit(limit);

  return rows.map((row: {
    pending: BotPendingDeploy;
    periodStartAt: unknown;
    periodEndAt: unknown;
  }) => ({
    ...row.pending,
    periodStartAt: row.periodStartAt,
    periodEndAt: row.periodEndAt,
  })) as BotPendingDeployListItem[];
}

export async function updateBotPendingDeployById(
  id: string,
  userId: string,
  updateData: UpdateBotPendingDeploy
) {
  const [result] = await db()
    .update(botPendingDeploy)
    .set(updateData)
    .where(and(eq(botPendingDeploy.id, id), eq(botPendingDeploy.userId, userId)))
    .returning();
  return result;
}
