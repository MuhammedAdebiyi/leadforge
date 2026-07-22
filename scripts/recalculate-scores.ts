import dotenv from 'dotenv'
dotenv.config({ path: '/Users/macbook/projects/leadforge/apps/api/.env' })

async function main() {
  const { prisma, publish, QUEUES, connectRabbitMQ, closeRabbitMQ, createLogger } = await import('@leadforge/shared')
  const { scoreLead } = await import('../workers/website-worker/src/scorer')
  const logger = createLogger('recalculate-scores')

  await connectRabbitMQ(logger)

  // Only businesses that were validated as no-website but scored 0 —
  // that 0 is the bug signature, since a real no-website business
  // always scores >= 25 (the base score) per the current scorer.
  const affected = await prisma.business.findMany({
    where: {
      hasWebsite: false,
      leadScore: 0,
      status: { in: ['ARCHIVED', 'VALIDATED'] },
    },
    include: { job: { select: { leadScoreThreshold: true, telegramDestination: true, useEmailEnrichment: true, id: true } } },
  })

  console.log(`Found ${affected.length} businesses with wrongly-zeroed scores`)

  let recalculated = 0
  let promoted = 0

  for (const b of affected) {
    const newScore = scoreLead({
      hasWebsite: false,
      phone: b.phone,
      reviewCount: b.reviewCount,
      rating: b.rating,
      address: b.address,
      category: b.category,
      name: b.name,
    } as any)

    recalculated++

    const meetsThreshold = newScore >= (b.job.leadScoreThreshold ?? 50)

    if (meetsThreshold) {
      await prisma.business.update({
        where: { id: b.id },
        data: { leadScore: newScore, status: 'QUALIFIED' },
      })
      await prisma.job.update({
        where: { id: b.job.id },
        data: { qualifiedBusinesses: { increment: 1 } },
      })

      if (b.job.useEmailEnrichment) {
        publish(QUEUES.EMAIL, { businessId: b.id, jobId: b.job.id }, b.id)
      } else {
        await prisma.business.update({
          where: { id: b.id },
          data: { status: 'READY_FOR_OUTREACH' },
        })
        if (b.job.telegramDestination) {
          publish(QUEUES.TELEGRAM, { businessId: b.id, chatId: b.job.telegramDestination }, b.id)
        }
      }
      promoted++
      console.log(`  ✅ Promoted: ${b.name} (new score: ${newScore})`)
    } else {
      // Still update the score even if it doesn't clear the bar —
      // fixes the data even for ones that stay archived.
      await prisma.business.update({
        where: { id: b.id },
        data: { leadScore: newScore },
      })
      console.log(`  ⚪ Rescored (still below threshold): ${b.name} (new score: ${newScore})`)
    }
  }

  console.log(`\n✅ Recalculated ${recalculated} businesses, promoted ${promoted} to QUALIFIED and queued for delivery`)

  await closeRabbitMQ()
  process.exit(0)
}

main()
