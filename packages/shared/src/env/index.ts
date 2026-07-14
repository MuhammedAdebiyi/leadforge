import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string(),
  DIRECT_URL: z.string(),
  UPSTASH_REDIS_REST_URL: z.string(),
  UPSTASH_REDIS_REST_TOKEN: z.string(),
  CLOUDAMQP_URL: z.string(),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  HUNTER_API_KEY: z.string().optional(),
  BROWSER_POOL_SIZE: z.coerce.number().default(3),
  SCRAPE_DELAY_MIN_MS: z.coerce.number().default(1500),
  SCRAPE_DELAY_MAX_MS: z.coerce.number().default(4000),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('Invalid environment variables:')
  console.error(parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const env = parsed.data
export type Env = typeof env