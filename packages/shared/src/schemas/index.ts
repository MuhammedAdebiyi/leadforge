import { z } from 'zod'

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(2),
})

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export const createJobSchema = z.object({
  keyword: z.string().min(1, 'Keyword is required'),
  city: z.string().min(1, 'City is required'),
  country: z.string().min(2).default('NG'),
  radius: z.number().min(1).max(50).default(10),
  maxResults: z.number().min(10).max(500).default(100),
  telegramDestination: z.string().nullable().optional(),
  useEmailEnrichment: z.boolean().default(false),
  leadScoreThreshold: z.number().min(0).max(100).default(50),
})

export const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
})

export const exportSchema = z.object({
  format: z.enum(['csv', 'excel']).default('csv'),
})

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type CreateJobInput = z.infer<typeof createJobSchema>
export type PaginationInput = z.infer<typeof paginationSchema>
export type ExportInput = z.infer<typeof exportSchema>
