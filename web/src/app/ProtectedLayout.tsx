import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthSession } from '../hooks/useAuthSession'
import { supabase } from '../lib/supabase'

export function ProtectedLayout() {
  const { session, loading } = useAuthSession()
  const location = useLocation()
  const [checkingProfile, setCheckingProfile] = useState(true)
  const [onboardingCompleted, setOnboardingCompleted] = useState(false)

  useEffect(() => {
    let active = true

    async function loadOnboardingState() {
      if (loading) return
      if (!session) {
        if (active) {
          setCheckingProfile(false)
          setOnboardingCompleted(false)
        }
        return
      }

      setCheckingProfile(true)

      const { data } = await supabase.from('profiles').select('onboarding_completed').eq('user_id', session.user.id).maybeSingle()

      if (active) {
        setOnboardingCompleted(Boolean(data?.onboarding_completed))
        setCheckingProfile(false)
      }
    }

    void loadOnboardingState()

    return () => {
      active = false
    }
  }, [loading, session])

  if (loading || checkingProfile) {
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

  const isOnboardingRoute = location.pathname.startsWith('/onboarding')

  if (onboardingCompleted && isOnboardingRoute) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
