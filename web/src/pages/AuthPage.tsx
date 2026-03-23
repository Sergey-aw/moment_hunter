import { useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowRight } from 'lucide-react'
import { Link, Navigate } from 'react-router-dom'
import { Alert, AlertDescription } from '../components/ui/alert'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { useAuthSession } from '../hooks/useAuthSession'
import { supabase } from '../lib/supabase'

export function AuthPage() {
  const { session, loading } = useAuthSession()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  if (!loading && session) {
    return <Navigate to="/" replace />
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError(null)
    setSuccess(null)

    const action =
      mode === 'sign-in'
        ? supabase.auth.signInWithPassword({ email, password })
        : supabase.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: `${window.location.origin}/onboarding?from=email-confirmation`,
            },
          })

    const { data, error: authError } = await action

    if (authError) {
      setError(authError.message)
    } else if (mode === 'sign-up' && !data.session) {
      setSuccess(`We emailed ${email}. Confirm your email to finish sign-up, then come back and sign in.`)
    } else if (mode === 'sign-up' && data.session) {
      setSuccess('Account created successfully.')
    }

    setPending(false)
  }

  async function onResendEmail() {
    setPending(true)
    setError(null)
    setSuccess(null)

    const { error: resendError } = await supabase.auth.resend({
      type: 'signup',
      email,
    })

    if (resendError) {
      setError(resendError.message)
    } else {
      setSuccess(`Confirmation email re-sent to ${email}.`)
    }

    setPending(false)
  }

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden px-4 py-6">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-20 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="absolute -right-16 bottom-0 h-80 w-80 rounded-full bg-cyan-500/15 blur-3xl" />
      </div>

      <div className="relative mx-auto grid w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-700/70 bg-slate-950/75 backdrop-blur xl:grid-cols-[1.1fr_1fr]">
        <section className="relative hidden border-r border-slate-700/60 xl:block">
          <img src="/cover.webp" alt="Moment Hunter cover" className="h-full w-full object-cover" />
          <img
            src="/logo.svg"
            alt="Moment Hunter logo"
            className="absolute left-8 top-8 h-8 w-auto object-contain [filter:brightness(0)_invert(1)]"
          />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent p-8">
            <h2 className="text-3xl font-semibold leading-tight">
              Predict the exact moment.
              <br />
              Beat everyone on timing.
            </h2>
            <p className="mt-3 max-w-md text-sm text-slate-300">
              Join live matches, call the next key event, and move up the leaderboard in real time.
            </p>
          </div>
        </section>

        <Card className="rounded-none border-0 bg-transparent shadow-none">
          <CardHeader className="pb-4">
            <p className="text-xs uppercase tracking-[0.24em] text-emerald-300">Your Access To Make a Bet</p>
            
            <CardDescription>Sign in to continue or create a new account.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 grid grid-cols-2 gap-2 rounded-lg border border-slate-700/80 bg-slate-900/70 p-1">
              <Button
                type="button"
                variant={mode === 'sign-in' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => {
                  setMode('sign-in')
                  setError(null)
                  setSuccess(null)
                }}
              >
                Sign in
              </Button>
              <Button
                type="button"
                variant={mode === 'sign-up' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => {
                  setMode('sign-up')
                  setError(null)
                  setSuccess(null)
                }}
              >
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

              {success ? (
                <Alert>
                  <AlertDescription>{success}</AlertDescription>
                </Alert>
              ) : null}

              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? 'Please wait...' : mode === 'sign-in' ? 'Continue' : 'Create account'}
                <ArrowRight className="h-4 w-4" />
              </Button>

              {mode === 'sign-up' ? (
                <Button type="button" variant="ghost" className="w-full" disabled={pending || !email} onClick={onResendEmail}>
                  Re-send confirmation email
                </Button>
              ) : null}
            </form>

            <p className="mt-4 text-xs text-slate-400">
              By continuing, you agree with our{' '}
              <Link to="/license" className="text-emerald-300 hover:text-emerald-200">
                License Agreement
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
