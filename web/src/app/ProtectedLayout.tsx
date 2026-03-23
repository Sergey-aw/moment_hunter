import { Loader2 } from 'lucide-react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuthSession } from '../hooks/useAuthSession'

export function ProtectedLayout() {
  const { session, loading } = useAuthSession()

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/70 px-4 py-2 text-sm text-slate-200">
          <Loader2 className="h-4 w-4 animate-spin" />
          Authenticating...
        </div>
      </main>
    )
  }

  if (!session) {
    return <Navigate to="/auth" replace />
  }

  return <Outlet />
}
