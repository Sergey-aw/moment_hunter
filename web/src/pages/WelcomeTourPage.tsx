import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, ChevronRight, Clock3, Trophy, UsersRound } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Alert, AlertDescription } from '../components/ui/alert'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { completeWelcomeTour, fetchMyProfile } from '../lib/api'

const slides = [
  {
    title: 'Predict Exact Moments',
    description: 'Open any live match, pick an event type, and submit your timing prediction in one tap.',
    icon: Clock3,
  },
  {
    title: 'Compete On Leaderboards',
    description: 'Points are calculated by timing accuracy. Smaller delta means higher score and better rank.',
    icon: Trophy,
  },
  {
    title: 'Play Together In Rooms',
    description: 'Create private/public rooms, invite friends, and battle for room leaderboard positions.',
    icon: UsersRound,
  },
]

export function WelcomeTourPage() {
  const queryClient = useQueryClient()
  const [index, setIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const profileQuery = useQuery({
    queryKey: ['my-profile'],
    queryFn: fetchMyProfile,
  })

  const completeMutation = useMutation({
    mutationFn: completeWelcomeTour,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['my-profile'] })
      window.location.assign('/')
    },
    onError: (mutationError: Error) => setError(mutationError.message),
  })

  const slide = slides[index]
  const isLast = index === slides.length - 1
  const canSkip = useMemo(() => Boolean(profileQuery.data), [profileQuery.data])
  const Icon = slide.icon

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
            <Badge variant="secondary">
              {index + 1}/{slides.length}
            </Badge>
          </div>
          <CardDescription>Quick walkthrough of how the game works.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-xl border border-slate-700/70 bg-slate-900/60 p-5">
            <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-200">
              <Icon className="h-5 w-5" />
            </div>
            <h3 className="text-xl font-semibold">{slide.title}</h3>
            <p className="mt-2 text-sm text-slate-300">{slide.description}</p>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            {slides.map((item, idx) => (
              <button
                key={item.title}
                type="button"
                className={`rounded-lg border px-3 py-2 text-left text-xs transition ${
                  idx === index ? 'border-emerald-400/70 bg-emerald-500/10 text-emerald-100' : 'border-slate-700/80 bg-slate-900/40 text-slate-300'
                }`}
                onClick={() => setIndex(idx)}
              >
                {item.title}
              </button>
            ))}
          </div>

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="flex items-center justify-between">
            <Button type="button" variant="outline" disabled={!canSkip || completeMutation.isPending} onClick={() => completeMutation.mutate()}>
              Skip tour
            </Button>

            {isLast ? (
              <Button type="button" disabled={completeMutation.isPending} onClick={() => completeMutation.mutate()}>
                {completeMutation.isPending ? 'Saving...' : 'Start playing'}
                <CheckCircle2 className="h-4 w-4" />
              </Button>
            ) : (
              <Button type="button" onClick={() => setIndex((value) => Math.min(value + 1, slides.length - 1))}>
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
