import { z } from 'zod'

// API-specific vars on top of shared env (which covers NODE_ENV, PORT, FRONTEND_URL etc.)
const apiEnvSchema = z.object({
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
})

const parsed = apiEnvSchema.safeParse(process.env)
if (!parsed.success) {
  console.error('❌ Invalid API environment variables:')
  console.error(parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const config = parsed.data

// Re-export shared env so app.ts can import both from one place
export { env } from '@leadforge/shared'
