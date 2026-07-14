import { Outlet, Navigate } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { useAuthStore } from '../../stores/auth'

export function Layout() {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated())

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return (
    <div className="min-h-screen flex bg-paper">
      <Sidebar />

      <main className="flex-1 overflow-y-auto bg-paper">
        <Outlet />
      </main>
    </div>
  )
}