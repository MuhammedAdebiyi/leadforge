import axios from 'axios'
import { useAuthStore } from '../stores/auth'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000',
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  res => res,
  async (err) => {
    const original = err.config
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true
      try {
        const refreshToken = useAuthStore.getState().refreshToken
        const res = await axios.post(`${original.baseURL}/api/auth/refresh`, { refreshToken })
        const { accessToken } = res.data.data
        useAuthStore.getState().setTokens(accessToken, refreshToken)
        original.headers.Authorization = `Bearer ${accessToken}`
        return api(original)
      } catch {
        useAuthStore.getState().logout()
        window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  }
)

export default api

export const authApi = {
  register: (data: { email: string; password: string; name: string }) =>
    api.post('/api/auth/register', data),
  login: (data: { email: string; password: string }) =>
    api.post('/api/auth/login', data),
  me: () => api.get('/api/auth/me'),
  connectTelegram: (chatId: string) =>
    api.patch('/api/auth/telegram', { chatId }),
}

export const jobsApi = {
  dashboard: () => api.get('/api/jobs/dashboard'),
  list: (page = 1, limit = 20) =>
    api.get(`/api/jobs?page=${page}&limit=${limit}`),
  get: (id: string) => api.get(`/api/jobs/${id}`),
  create: (data: CreateJobInput) => api.post('/api/jobs', data),
  pause: (id: string) => api.post(`/api/jobs/${id}/pause`),
  resume: (id: string) => api.post(`/api/jobs/${id}/resume`),
  cancel: (id: string) => api.post(`/api/jobs/${id}/cancel`),
  delete: (id: string) => api.delete(`/api/jobs/${id}`),
}

export const businessApi = {
  list: (params: Record<string, any>) =>
    api.get('/api/businesses', { params }),
  get: (id: string) => api.get(`/api/businesses/${id}`),
  export: (jobId: string, format: 'csv' | 'excel') =>
    api.post('/api/businesses/export', { jobId, format }),
  retryTelegram: (id: string) =>
    api.post(`/api/businesses/${id}/retry-telegram`),
  updateStatus: (id: string, status: string, notes?: string) =>
    api.patch(`/api/businesses/${id}/status`, { status, notes }),
}

export interface CreateJobInput {
  keyword: string
  city: string
  country: string
  radius: number
  maxResults: number
  telegramDestination?: string
  useEmailEnrichment: boolean
  leadScoreThreshold: number
}
