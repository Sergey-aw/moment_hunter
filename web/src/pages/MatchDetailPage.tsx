import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ExternalLink } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Alert, AlertDescription } from '../components/ui/alert'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { fetchEventTypes, fetchMatchById, fetchMatchLeaderboard, simulateEvent, submitPrediction } from '../lib/api'

function toEmbedUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl)

    if (url.hostname.includes('youtu.be')) {
      const id = url.pathname.split('/').filter(Boolean)[0]
      return id ? `https://www.youtube.com/embed/${id}` : null
    }

    if (url.hostname.includes('youtube.com')) {
      if (url.pathname.startsWith('/embed/')) return rawUrl

      const watchId = url.searchParams.get('v')
      if (watchId) return `https://www.youtube.com/embed/${watchId}`

      const liveId = url.pathname.split('/live/')[1]
      if (liveId) return `https://www.youtube.com/embed/${liveId}`
    }

    return null
  } catch {
    return null
  }
}

export function MatchDetailPage() {
  const { matchId } = useParams<{ matchId: string }>()
  const queryClient = useQueryClient()
  const [message, setMessage] = useState<string | null>(null)

  const matchQuery = useQuery({
    queryKey: ['match', matchId],
    queryFn: () => fetchMatchById(matchId || ''),
    enabled: Boolean(matchId),
  })

  const eventTypesQuery = useQuery({
    queryKey: ['event-types', matchId],
    queryFn: () => fetchEventTypes(matchId || ''),
    enabled: Boolean(matchId),
    refetchInterval: 30000,
  })

  const leaderboardQuery = useQuery({
    queryKey: ['match-leaderboard', matchId],
    queryFn: () => fetchMatchLeaderboard(matchId || ''),
    enabled: Boolean(matchId),
    refetchInterval: 5000,
  })

  const predictMutation = useMutation({
    mutationFn: ({ eventTypeId }: { eventTypeId: string }) => submitPrediction(matchId || '', eventTypeId),
    onSuccess: async () => {
      setMessage('Prediction accepted. Wait for event confirmation and score update.')
      await queryClient.invalidateQueries({ queryKey: ['match-leaderboard', matchId] })
    },
    onError: (error: Error) => {
      setMessage(error.message)
    },
  })

  const simulateMutation = useMutation({
    mutationFn: ({ eventTypeId, offsetSec }: { eventTypeId: string; offsetSec: number }) =>
      simulateEvent(matchId || '', eventTypeId, offsetSec),
    onSuccess: async () => {
      setMessage('Simulated event created. Scores will settle automatically.')
      await queryClient.invalidateQueries({ queryKey: ['match-leaderboard', matchId] })
    },
    onError: (error: Error) => {
      setMessage(error.message)
    },
  })

  const canPredict = useMemo(() => matchQuery.data?.status === 'live', [matchQuery.data?.status])

  if (matchQuery.isLoading) {
    return <p className="text-sm text-slate-300">Loading match...</p>
  }

  if (!matchQuery.data) {
    return <p className="text-sm text-slate-300">Match not found.</p>
  }

  const match = matchQuery.data
  const embedUrl = toEmbedUrl(match.stream_url)

  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,1.8fr)_minmax(340px,1fr)]">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-xl">{match.title}</CardTitle>
            <Badge variant={match.status === 'live' ? 'live' : 'upcoming'}>{match.status}</Badge>
          </div>
          <CardDescription>Submit prediction right before expected event timing.</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {embedUrl ? (
            <div className="aspect-video overflow-hidden rounded-xl border border-slate-700 bg-slate-950">
              <iframe
                title="match-stream"
                src={embedUrl}
                className="h-full w-full"
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            <div className="grid aspect-video place-items-center rounded-xl border border-slate-700 bg-slate-950 p-4 text-center">
              <div>
                <p className="text-sm text-slate-300">This source cannot be embedded directly.</p>
                <Button asChild className="mt-3">
                  <a href={match.stream_url} target="_blank" rel="noreferrer">
                    Open stream <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </div>
            </div>
          )}

          <Card className="border-emerald-400/20 bg-slate-950/40">
            <CardHeader>
              <CardTitle className="text-base">Predict Event Moment</CardTitle>
              <CardDescription>Choose event type and submit when you expect it to happen.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-2">
                {(eventTypesQuery.data || []).map((eventType) => (
                  <Button
                    key={eventType.id}
                    variant="outline"
                    className="h-auto flex-col items-start gap-1 px-4 py-3 text-left"
                    disabled={!canPredict || predictMutation.isPending}
                    onClick={() => predictMutation.mutate({ eventTypeId: eventType.id })}
                  >
                    <span className="font-semibold text-emerald-100">{eventType.name}</span>
                    <span className="text-xs text-slate-300">Window: {eventType.prediction_window_sec}s</span>
                  </Button>
                ))}
              </div>

              {message ? (
                <Alert className="mt-3">
                  <AlertDescription>{message}</AlertDescription>
                </Alert>
              ) : null}

              {!canPredict ? (
                <Alert className="mt-3 border-amber-400/30 bg-amber-500/10 text-amber-100">
                  <AlertDescription>Predictions are open only when match status is `live`.</AlertDescription>
                </Alert>
              ) : null}
            </CardContent>
          </Card>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Match Leaderboard</CardTitle>
          <CardDescription>Top 20 for this match.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {(leaderboardQuery.data || []).slice(0, 20).map((row) => (
            <div key={row.user_id} className="flex items-center justify-between rounded-lg border border-slate-700/80 bg-slate-800/60 px-3 py-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="inline-grid h-6 w-6 place-items-center rounded-full bg-slate-700 text-xs">{row.rank}</span>
                <span>{row.username || 'Anonymous'}</span>
              </div>
              <span className="font-semibold text-emerald-200">{row.points}</span>
            </div>
          ))}
          {!leaderboardQuery.data?.length ? <p className="text-sm text-slate-300">No scores yet.</p> : null}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Testing Controls</CardTitle>
          <CardDescription>
            For QA: simulate official events and verify prediction scoring. Requires DB access to `simulate_event` RPC.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {(eventTypesQuery.data || []).map((eventType) => (
            <div key={`simulate-${eventType.id}`} className="rounded-lg border border-slate-700/80 bg-slate-800/40 p-3">
              <p className="text-sm font-semibold">{eventType.name}</p>
              <p className="text-xs text-slate-300">Prediction window: {eventType.prediction_window_sec}s</p>
              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={simulateMutation.isPending}
                  onClick={() => simulateMutation.mutate({ eventTypeId: eventType.id, offsetSec: 0 })}
                >
                  Simulate now
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={simulateMutation.isPending}
                  onClick={() => simulateMutation.mutate({ eventTypeId: eventType.id, offsetSec: 5 })}
                >
                  +5s
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </section>
  )
}
