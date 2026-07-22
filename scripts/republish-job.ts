import dotenv from 'dotenv'
dotenv.config({ path: '/Users/macbook/projects/leadforge/apps/api/.env' })

const JOB_ID = process.argv[2]
if (!JOB_ID) {
  console.error('Usage: npx tsx scripts/republish-job.ts <jobId>')
  process.exit(1)
}

async function main() {
  const { prisma, publish, QUEUES, connectRabbitMQ, closeRabbitMQ, createLogger } = await import('@leadforge/shared')
  const logger = createLogger('republish-job')

  await connectRabbitMQ(logger)

  const job = await prisma.job.findUnique({ where: { id: JOB_ID }, select: { telegramDestination: true } })
  if (!job?.telegramDestination) {
    console.error('Job not found or no telegramDestination set')
    process.exit(1)
  }

  const businesses = await prisma.business.findMany({
    where: { jobId: JOB_ID, status: 'READY_FOR_OUTREACH' },
  })

  let sent = 0
  for (const b of businesses) {
    publish(QUEUES.TELEGRAM, { businessId: b.id, chatId: job.telegramDestination, retryCount: 0 }, b.id)
    sent++
  }
  console.log(`✅ Republished ${sent} businesses to telegram.queue for chat ${job.telegramDestination}`)

  await closeRabbitMQ()
  process.exit(0)
}

main()
