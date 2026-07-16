import dotenv from 'dotenv'
dotenv.config({ path: '/Users/macbook/projects/leadforge/apps/api/.env' })

async function main() {
  const { prisma, publish, QUEUES, connectRabbitMQ, closeRabbitMQ, createLogger } = await import('@leadforge/shared')
  const logger = createLogger('republish-script')

  await connectRabbitMQ(logger)

  const businesses = await prisma.business.findMany({
    where: { status: 'EMAIL_ENRICHED' },
    include: { job: { select: { telegramDestination: true } } },
  })

  let sent = 0
  for (const b of businesses) {
    if (!b.job.telegramDestination) continue
    publish(QUEUES.TELEGRAM, { businessId: b.id, chatId: b.job.telegramDestination, retryCount: 0 }, b.id)
    sent++
  }
  console.log(`✅ Republished ${sent} businesses to telegram.queue`)

  await closeRabbitMQ()
  process.exit(0)
}

main()
