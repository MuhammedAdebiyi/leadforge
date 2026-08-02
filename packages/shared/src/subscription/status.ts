import { prisma } from '../database/prisma'

export type EffectiveSubStatus = 'NONE' | 'ACTIVE' | 'EXPIRED'

export async function ensureSubscriptionStatus(userId: string): Promise<EffectiveSubStatus> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { subscriptionStatus: true, subscriptionExpiresAt: true },
  })
  if (!user) return 'NONE'

  if (user.subscriptionStatus === 'ACTIVE' && user.subscriptionExpiresAt && user.subscriptionExpiresAt < new Date()) {
    await prisma.user.update({ where: { id: userId }, data: { subscriptionStatus: 'EXPIRED' } })
    return 'EXPIRED'
  }

  return user.subscriptionStatus
}

export async function ensureSubscriptionStatusByChatId(chatId: string): Promise<{ status: EffectiveSubStatus; userId: string | null }> {
  const user = await prisma.user.findUnique({
    where: { telegramChatId: chatId },
    select: { id: true },
  })
  if (!user) return { status: 'NONE', userId: null }

  const status = await ensureSubscriptionStatus(user.id)
  return { status, userId: user.id }
}
