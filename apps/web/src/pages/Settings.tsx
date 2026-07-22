import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { CheckCircle, Send, Lock } from 'lucide-react'
import { authApi } from '../lib/api'
import { useAuthStore } from '../stores/auth'
import toast from 'react-hot-toast'
import { Spinner } from '../components/ui'

export function Settings() {
  const user = useAuthStore(s => s.user)
  const setAuth = useAuthStore(s => s.setAuth)
  const logout = useAuthStore(s => s.logout)
  const accessToken = useAuthStore(s => s.accessToken)
  const refreshToken = useAuthStore(s => s.refreshToken)

  const [chatId, setChatId] = useState(user?.telegramChatId ?? '')
  const isLocked = !!user?.telegramChatId

  const mutation = useMutation({
    mutationFn: () => authApi.connectTelegram(chatId),
    onSuccess: () => {
      toast.success('Telegram connected — leads will be sent here from now on')
      if (user) {
        setAuth(
          { ...user, telegramChatId: chatId },
          accessToken!,
          refreshToken!
        )
      }
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Failed'),
  })

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div>
        <p className="label mb-1">Settings</p>
        <h1 className="text-2xl font-bold text-chalk tracking-tight">Account Settings</h1>
      </div>

      {/* Profile */}
      <div className="card p-6 space-y-4">
        <p className="text-xs font-semibold text-chalk-muted uppercase tracking-widest">Profile</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Name</label>
            <input className="input opacity-60" value={user?.name ?? ''} readOnly />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input opacity-60" value={user?.email ?? ''} readOnly />
          </div>
        </div>
      </div>

      {/* Telegram */}
      <div className="card p-6">
        <p className="text-xs font-semibold text-chalk-muted uppercase tracking-widest mb-1">Telegram</p>

        {isLocked ? (
          <>
            <p className="text-sm text-chalk-muted mb-4 leading-relaxed">
              Your leads are sent to this Telegram chat permanently. This can't be changed —
              contact support if you need it updated.
            </p>
            <div className="flex items-center gap-2 text-xs text-signal mb-2 bg-signal/5 border border-signal/20 rounded-lg px-3 py-2.5">
              <CheckCircle size={13} />
              Connected · {user!.telegramChatId}
            </div>
            <div className="flex items-center gap-2 text-xs text-chalk-muted">
              <Lock size={12} />
              Locked
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-chalk-muted mb-4 leading-relaxed">
              Connect your Telegram to receive qualified leads instantly. This can only be set
              once, so make sure it's the right chat before saving.{' '}
              <a>
                href="https://t.me/userinfobot"
                target="_blank"
                rel="noopener noreferrer"
                className="text-chalk hover:text-signal transition-colors underline underline-offset-2"
                Get your chat ID ↗
              </a>
            </p>

            <div className="flex gap-2">
              <input
                className="input"
                placeholder="Your Telegram chat ID"
                value={chatId}
                onChange={e => setChatId(e.target.value)}
              />
              <button
                onClick={() => {
                  if (window.confirm(`Set your Telegram to ${chatId}? This cannot be changed later.`)) {
                    mutation.mutate()
                  }
                }}
                disabled={!chatId || mutation.isPending}
                className="btn-primary shrink-0"
              >
                {mutation.isPending ? <Spinner size={14} /> : <><Send size={13} /> Save</>}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Danger */}
      <div className="card p-6">
        <p className="text-xs font-semibold text-chalk-muted uppercase tracking-widest mb-4">Danger Zone</p>
        <button
          onClick={() => { logout(); window.location.href = '/login' }}
          className="btn-danger"
        >
          Sign out of LeadForge
        </button>
      </div>
    </div>
  )
}
