import { useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowRight, ShieldCheck, Target } from 'lucide-react'
import { Navigate } from 'react-router-dom'
import { Alert, AlertDescription } from '../components/ui/alert'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { useAuthSession } from '../hooks/useAuthSession'
import { supabase } from '../lib/supabase'

export function AuthPage() {
  const { session, loading } = useAuthSession()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  if (!loading && session) {
    return <Navigate to="/" replace />
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError(null)

    const action =
      mode === 'sign-in'
        ? supabase.auth.signInWithPassword({ email, password })
        : supabase.auth.signUp({ email, password })

    const { error: authError } = await action

    if (authError) {
      setError(authError.message)
    }

    setPending(false)
  }

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-20 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="absolute -right-16 bottom-0 h-80 w-80 rounded-full bg-cyan-500/15 blur-3xl" />
      </div>

      <div className="relative mx-auto grid w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-700/70 bg-slate-950/75 backdrop-blur xl:grid-cols-[1.1fr_1fr]">
        <section className="hidden border-r border-slate-700/60 bg-[linear-gradient(165deg,rgba(15,23,42,0.9),rgba(15,23,42,0.7))] p-8 xl:flex xl:flex-col xl:justify-between">
          <div>
            <Badge variant="secondary" className="mb-4">
              Prediction MVP
            </Badge>
            <h1 className="text-3xl font-semibold leading-tight">Predict the exact moment. Beat everyone on timing.</h1>
            <p className="mt-3 max-w-md text-sm text-slate-300">
              Join live matches, call the next key event, and move up the leaderboard in real time.
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-start gap-3 rounded-lg border border-slate-700/70 bg-slate-900/60 p-3">
              <Target className="mt-0.5 h-4 w-4 text-emerald-300" />
              <div>
                <p className="text-sm font-medium">Precision scoring</p>
                <p className="text-xs text-slate-400">Higher points for tighter event timing.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg border border-slate-700/70 bg-slate-900/60 p-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 text-emerald-300" />
              <div>
                <p className="text-sm font-medium">Fair by design</p>
                <p className="text-xs text-slate-400">Server-side timestamps and scoring logic.</p>
              </div>
            </div>
          </div>
        </section>

        <Card className="rounded-none border-0 bg-transparent shadow-none">
          <CardHeader className="pb-4">
            <p className="text-xs uppercase tracking-[0.24em] text-emerald-300">MVP Access</p>
            <CardTitle className="text-2xl">Enter Moment Hunter</CardTitle>
            <CardDescription>Sign in to continue or create a new account.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 grid grid-cols-2 gap-2 rounded-lg border border-slate-700/80 bg-slate-900/70 p-1">
              <Button type="button" variant={mode === 'sign-in' ? 'default' : 'ghost'} size="sm" onClick={() => setMode('sign-in')}>
                Sign in
              </Button>
              <Button type="button" variant={mode === 'sign-up' ? 'default' : 'ghost'} size="sm" onClick={() => setMode('sign-up')}>
                Sign up
              </Button>
            </div>

            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm text-slate-300" htmlFor="email">
                  Email
                </label>
                <Input id="email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm text-slate-300" htmlFor="password">
                  Password
                </label>
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>

              {error ? (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}

              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? 'Please wait...' : mode === 'sign-in' ? 'Continue' : 'Create account'}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </form>

            <p className="mt-4 text-xs text-slate-400">By continuing, you agree to use this MVP for testing.</p>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
