import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, ChevronRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Alert, AlertDescription } from '../components/ui/alert'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { completeOnboarding, fetchMyProfile } from '../lib/api'

const ONBOARDING_DRAFT_KEY = 'moment-hunter:onboarding-draft:v1'

type OnboardingDraft = {
  step: number
  username: string
  favoriteCategories: string[]
  goal: 'casual' | 'competitive' | 'creator' | null
}

const categoryOptions = [
  'football',
  'basketball',
  'hockey',
  'mma',
  'esports-cs2',
  'esports-valorant',
  'esports-lol',
  'esports-dota2',
  'tennis',
  'motorsport-f1',
]

const goalOptions = [
  {
    value: 'casual' as const,
    title: 'Casual Fun',
    description: 'I want quick predictions and light competition.',
  },
  {
    value: 'competitive' as const,
    title: 'Competitive Climb',
    description: 'I want to optimize picks and push leaderboard rank.',
  },
  {
    value: 'creator' as const,
    title: 'Host Rooms',
    description: 'I want to invite friends and run private room battles.',
  },
]

export function OnboardingPage() {
  const queryClient = useQueryClient()
  const [step, setStep] = useState(1)
  const [username, setUsername] = useState('')
  const [favoriteCategories, setFavoriteCategories] = useState<string[]>([])
  const [goal, setGoal] = useState<'casual' | 'competitive' | 'creator' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const profileQuery = useQuery({
    queryKey: ['my-profile'],
    queryFn: fetchMyProfile,
  })

  const completeMutation = useMutation({
    mutationFn: completeOnboarding,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['my-profile'] })
      localStorage.removeItem(ONBOARDING_DRAFT_KEY)
      window.location.assign('/')
    },
    onError: (mutationError: Error) => setError(mutationError.message),
  })

  useEffect(() => {
    try {
      const raw = localStorage.getItem(ONBOARDING_DRAFT_KEY)
      if (!raw) return

      const draft = JSON.parse(raw) as OnboardingDraft
      if (draft.username) setUsername(draft.username)
      if (Array.isArray(draft.favoriteCategories)) setFavoriteCategories(draft.favoriteCategories)
      if (draft.goal) setGoal(draft.goal)
      if (typeof draft.step === 'number') setStep(Math.min(Math.max(draft.step, 1), 3))
    } catch {
      localStorage.removeItem(ONBOARDING_DRAFT_KEY)
    }
  }, [])

  useEffect(() => {
    const payload: OnboardingDraft = {
      step,
      username,
      favoriteCategories,
      goal,
    }

    localStorage.setItem(ONBOARDING_DRAFT_KEY, JSON.stringify(payload))
  }, [step, username, favoriteCategories, goal])

  useEffect(() => {
    if (!profileQuery.data) return
    if (!username && profileQuery.data.username) setUsername(profileQuery.data.username)
    if (!favoriteCategories.length && profileQuery.data.favorite_categories?.length) {
      setFavoriteCategories(profileQuery.data.favorite_categories)
    }
    if (!goal && profileQuery.data.onboarding_goal) setGoal(profileQuery.data.onboarding_goal)
    if (profileQuery.data.onboarding_completed) {
      localStorage.removeItem(ONBOARDING_DRAFT_KEY)
    }
  }, [profileQuery.data, username, favoriteCategories.length, goal])

  function nextStep() {
    setError(null)

    if (step === 1) {
      if (username.trim().length < 3) {
        setError('Username must be at least 3 characters.')
        return
      }
      setStep(2)
      return
    }

    if (step === 2) {
      setStep(3)
    }
  }

  function prevStep() {
    setError(null)
    setStep((current) => Math.max(1, current - 1))
  }

  async function onFinish() {
    setError(null)
    if (!goal) {
      setError('Pick one goal so we can personalize your experience.')
      return
    }

    completeMutation.mutate({
      username: username.trim(),
      favoriteCategories,
      onboardingGoal: goal,
    })
  }

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden px-4 py-6">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-20 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="absolute -right-16 bottom-0 h-80 w-80 rounded-full bg-cyan-500/15 blur-3xl" />
      </div>

      <Card className="relative w-full max-w-2xl border-slate-700/70 bg-slate-950/75 backdrop-blur">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Welcome to Moment Hunter</CardTitle>
            <Badge variant="secondary">Step {step}/3</Badge>
          </div>
          <CardDescription>Quick onboarding. Less than a minute.</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {step === 1 ? (
            <section className="space-y-3">
              <h3 className="text-lg font-semibold">What should players call you?</h3>
              <p className="text-sm text-slate-300">Choose your display name for leaderboards and rooms.</p>
              <Input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Sharpshooter_23" />
            </section>
          ) : null}

          {step === 2 ? (
            <section className="space-y-3">
              <h3 className="text-lg font-semibold">Which categories do you want to follow first?</h3>
              <p className="text-sm text-slate-300">Pick any that interest you. You can change this later.</p>
              <div className="flex flex-wrap gap-2">
                {categoryOptions.map((category) => {
                  const active = favoriteCategories.includes(category)
                  return (
                    <Button
                      key={category}
                      type="button"
                      variant={active ? 'default' : 'outline'}
                      size="sm"
                      className="capitalize"
                      onClick={() =>
                        setFavoriteCategories((prev) => (prev.includes(category) ? prev.filter((item) => item !== category) : [...prev, category]))
                      }
                    >
                      {active ? <Check className="h-4 w-4" /> : null}
                      {category}
                    </Button>
                  )
                })}
              </div>
            </section>
          ) : null}

          {step === 3 ? (
            <section className="space-y-3">
              <h3 className="text-lg font-semibold">What brings you here most?</h3>
              <p className="text-sm text-slate-300">This tunes your default experience.</p>
              <div className="grid gap-2">
                {goalOptions.map((option) => {
                  const active = goal === option.value
                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={`rounded-lg border px-4 py-3 text-left transition ${
                        active ? 'border-emerald-400/70 bg-emerald-500/10' : 'border-slate-700/80 bg-slate-900/50 hover:border-slate-600'
                      }`}
                      onClick={() => setGoal(option.value)}
                    >
                      <p className="font-semibold">{option.title}</p>
                      <p className="text-sm text-slate-300">{option.description}</p>
                    </button>
                  )
                })}
              </div>
            </section>
          ) : null}

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="flex items-center justify-between pt-2">
            <Button type="button" variant="outline" disabled={step === 1 || completeMutation.isPending} onClick={prevStep}>
              Back
            </Button>

            {step < 3 ? (
              <Button type="button" onClick={nextStep}>
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button type="button" onClick={onFinish} disabled={completeMutation.isPending}>
                {completeMutation.isPending ? 'Saving...' : 'Finish onboarding'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
