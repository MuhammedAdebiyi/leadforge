import type { JobStatus, LeadStatus } from '../constants/status'

export interface User {
  id: string
  email: string
  telegramChatId: string | null
  createdAt: Date
}

export interface Job {
  id: string
  userId: string
  keyword: string
  city: string
  country: string
  radius: number
  maxResults: number
  status: JobStatus
  progress: number
  totalBusinesses: number
  qualifiedBusinesses: number
  leadScoreThreshold: number
  useEmailEnrichment: boolean
  telegramDestination: string | null
  createdAt: Date
  completedAt: Date | null
}

export interface Business {
  id: string
  placeId: string
  jobId: string
  name: string
  phone: string | null
  whatsapp: string | null
  email: string | null
  address: string | null
  latitude: number | null
  longitude: number | null
  website: string | null
  hasWebsite: boolean
  category: string | null
  rating: number | null
  reviewCount: number | null
  mapsUrl: string | null
  leadScore: number
  status: LeadStatus
  createdAt: Date
}

export interface JobMessage {
  jobId: string
  userId: string
  keyword: string
  city: string
  country: string
  radius: number
  maxResults: number
}

export interface BusinessMessage {
  jobId: string
  businessId: string
  placeId: string
}

export interface TelegramMessage {
  businessId: string
  chatId: string
  retryCount?: number
}

export interface ExportMessage {
  jobId: string
  userId: string
  format: 'csv' | 'excel'
}
