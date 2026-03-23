import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { ExternalLink } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Alert, AlertDescription } from '../components/ui/alert'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Switch } from '../components/ui/switch'
import { fetchEventTypes, fetchMatchById, fetchMatchLeaderboard, fetchMyMatchBets, fetchNotificationPrefs, setNotificationPref, simulateEvent, submitPrediction } from '../lib/api'
import type { MatchStatus } from '../lib/types'

type GameFlowToast = {
  id: string
  eventName: string
  offsetSec: number
}

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
  const [isFlowTestRunning, setIsFlowTestRunning] = useState(false)
  const [flowToasts, setFlowToasts] = useState<GameFlowToast[]>([])
  const flowIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const flowTickInProgressRef = useRef(false)
  const flowToastIdRef = useRef(0)

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

  const myBetsQuery = useQuery({
    queryKey: ['my-match-bets', matchId],
    queryFn: () => fetchMyMatchBets(matchId || ''),
    enabled: Boolean(matchId),
    refetchInterval: 5000,
  })

  const notificationPrefsQuery = useQuery({
    queryKey: ['notification-prefs', matchId],
    queryFn: () => fetchNotificationPrefs(matchId || ''),
    enabled: Boolean(matchId),
  })

  const predictMutation = useMutation({
    mutationFn: ({ eventTypeId }: { eventTypeId: string }) => submitPrediction(matchId || '', eventTypeId),
    onSuccess: async () => {
      setMessage('Prediction accepted. Wait for event confirmation and score update.')
      await queryClient.invalidateQueries({ queryKey: ['match-leaderboard', matchId] })
      await queryClient.invalidateQueries({ queryKey: ['my-match-bets', matchId] })
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

  const notificationMutation = useMutation({
    mutationFn: ({ eventTypeId, enabled }: { eventTypeId: string; enabled: boolean }) =>
      setNotificationPref(matchId || '', eventTypeId, enabled),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['notification-prefs', matchId] })
    },
    onError: (error: Error) => {
      setMessage(error.message)
    },
  })

  const canPredict = useMemo(() => matchQuery.data?.status === 'live', [matchQuery.data?.status])

  const lockReason = useMemo(() => {
    const status = matchQuery.data?.status
    return predictionLockReason(status)
  }, [matchQuery.data?.status])

  const enabledByEventType = useMemo(() => {
    const map = new Map<string, boolean>()
    for (const pref of notificationPrefsQuery.data || []) {
      map.set(pref.event_type_id, pref.enabled)
    }
    return map
  }, [notificationPrefsQuery.data])

  const eventNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const eventType of eventTypesQuery.data || []) {
      map.set(eventType.id, eventType.name)
    }
    return map
  }, [eventTypesQuery.data])

  useEffect(() => {
    return () => {
      if (flowIntervalRef.current) clearInterval(flowIntervalRef.current)
    }
  }, [])

  const canRunFlowTest = matchQuery.data?.status === 'live' && (eventTypesQuery.data || []).length > 0
  const relatedVideos = useMemo(() => {
    const eventNames = (eventTypesQuery.data || []).map((eventType) => eventType.name)
    return buildRelatedYouTubeLinks(matchQuery.data?.category || '', eventNames)
  }, [eventTypesQuery.data, matchQuery.data?.category])

  useEffect(() => {
    if (!canRunFlowTest && isFlowTestRunning) {
      setIsFlowTestRunning(false)
      if (flowIntervalRef.current) {
        clearInterval(flowIntervalRef.current)
        flowIntervalRef.current = null
      }
    }
  }, [canRunFlowTest, isFlowTestRunning])

  if (matchQuery.isLoading) {
    return <p className="text-sm text-slate-300">Loading match...</p>
  }

  if (!matchQuery.data) {
    return <p className="text-sm text-slate-300">Match not found.</p>
  }

  const match = matchQuery.data
  const embedUrl = toEmbedUrl(match.stream_url)

  const stopFlowTest = () => {
    setIsFlowTestRunning(false)
    if (flowIntervalRef.current) {
      clearInterval(flowIntervalRef.current)
      flowIntervalRef.current = null
    }
  }

  const runFlowTick = async () => {
    if (!matchId) return
    if (flowTickInProgressRef.current) return

    const eventTypes = eventTypesQuery.data || []
    if (!eventTypes.length) return

    flowTickInProgressRef.current = true
    try {
      const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)]
      const offsetSec = Math.floor(Math.random() * 9)
      await simulateEvent(matchId, eventType.id, offsetSec)
      await queryClient.invalidateQueries({ queryKey: ['match-leaderboard', matchId] })

      flowToastIdRef.current += 1
      setFlowToasts((prev) =>
        [
          {
            id: `flow-${flowToastIdRef.current}`,
            eventName: eventType.name,
            offsetSec,
          },
          ...prev,
        ].slice(0, 6),
      )
      setMessage(`Live flow test: simulated "${eventType.name}" (+${offsetSec}s).`)
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Failed to simulate event'
      setMessage(reason)
      stopFlowTest()
    } finally {
      flowTickInProgressRef.current = false
    }
  }

  const startFlowTest = async () => {
    if (!canRunFlowTest) return
    if (flowIntervalRef.current) return

    setFlowToasts([])
    setIsFlowTestRunning(true)
    await runFlowTick()
    flowIntervalRef.current = setInterval(() => {
      void runFlowTick()
    }, 2500)
  }

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

          <Card className="border-slate-700/80 bg-slate-950/40">
            <CardHeader>
              <CardTitle className="text-base">Relevant YouTube Videos</CardTitle>
              <CardDescription>
                Suggestions based on category <span className="font-medium text-slate-200">{formatCategoryLabel(match.category)}</span> and current
                event types.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2">
              {relatedVideos.map((video) => (
                <Button key={video.url} variant="outline" asChild className="h-auto justify-start px-4 py-3 text-left">
                  <a href={video.url} target="_blank" rel="noreferrer">
                    {video.label}
                    <ExternalLink className="ml-2 h-4 w-4 shrink-0" />
                  </a>
                </Button>
              ))}
            </CardContent>
          </Card>

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
                  <AlertDescription>{lockReason}</AlertDescription>
                </Alert>
              ) : null}
            </CardContent>
          </Card>

          <Card className="border-slate-700/80 bg-slate-950/40">
            <CardHeader>
              <CardTitle className="text-base">Match Notifications</CardTitle>
              <CardDescription>Toggle in-app alerts per event type for this match.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {(eventTypesQuery.data || []).map((eventType) => {
                const enabled = enabledByEventType.get(eventType.id) ?? false
                return (
                  <label
                    key={`notif-${eventType.id}`}
                    className="flex items-center justify-between rounded-lg border border-slate-700/70 bg-slate-800/40 px-3 py-2 text-sm"
                  >
                    <span>{eventType.name}</span>
                    <Switch
                      checked={enabled}
                      onCheckedChange={(nextEnabled) => notificationMutation.mutate({ eventTypeId: eventType.id, enabled: nextEnabled })}
                      disabled={notificationMutation.isPending}
                      aria-label={`Toggle ${eventType.name} notifications`}
                    />
                  </label>
                )
              })}
            </CardContent>
          </Card>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:col-start-2 lg:grid-rows-2">
        <Card className="min-h-0">
          <CardHeader>
            <CardTitle>Match Leaderboard</CardTitle>
            <CardDescription>Top 20 for this match.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 overflow-y-auto">
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

        <Card className="min-h-0">
          <CardHeader>
            <CardTitle>My Bets</CardTitle>
            <CardDescription>Your latest predictions with timestamps.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 overflow-y-auto">
            {myBetsQuery.isLoading ? <p className="text-sm text-slate-300">Loading your bets...</p> : null}
            {myBetsQuery.isError ? <p className="text-sm text-rose-300">Failed to load your bets.</p> : null}
            {(myBetsQuery.data || []).map((bet) => (
              <div key={bet.id} className="rounded-lg border border-slate-700/80 bg-slate-800/60 px-3 py-2 text-sm">
                <p className="font-semibold text-emerald-100">{eventNameById.get(bet.event_type_id) || 'Unknown event'}</p>
                <p className="text-xs text-slate-300">Placed: {dayjs(bet.created_at).format('MMM D, HH:mm:ss')}</p>
                <p className="text-xs text-slate-400">Predicted TS: {dayjs(bet.predicted_ts).format('MMM D, HH:mm:ss')}</p>
              </div>
            ))}
            {!myBetsQuery.isLoading && !myBetsQuery.isError && !myBetsQuery.data?.length ? (
              <p className="text-sm text-slate-300">No bets yet for this match.</p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card className="lg:col-span-2">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>Testing Controls</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant={isFlowTestRunning ? 'live' : 'secondary'}>
                {isFlowTestRunning ? 'Flow test ON' : 'Flow test OFF'}
              </Badge>
              {isFlowTestRunning ? (
                <Button size="sm" variant="secondary" onClick={stopFlowTest}>
                  Stop Live Flow Test
                </Button>
              ) : (
                <Button size="sm" onClick={() => void startFlowTest()} disabled={!canRunFlowTest}>
                  Run Live Flow Test
                </Button>
              )}
            </div>
          </div>
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

      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[24rem] max-w-[calc(100vw-2rem)] flex-col gap-2">
        {flowToasts.map((toast) => (
          <div key={toast.id} className="rounded-lg border border-cyan-300/30 bg-slate-900/95 px-3 py-2 shadow-lg">
            <p className="text-sm font-semibold text-slate-100">Live event simulated</p>
            <p className="text-xs text-slate-300">
              {toast.eventName} at +{toast.offsetSec}s
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}

function predictionLockReason(status?: MatchStatus) {
  if (!status) return 'Predictions are temporarily unavailable.'
  if (status === 'live') return ''
  if (status === 'upcoming') return 'Predictions are locked: this match has not started yet.'
  if (status === 'completed' || status === 'cancelled') return `Predictions are locked: match is ${status}.`
  if (status === 'draft') return 'Predictions are locked: match is still in draft mode.'
  return 'Predictions are locked for this match.'
}

function formatCategoryLabel(category: string) {
  if (!category) return 'General'
  return category
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function buildYouTubeSearchUrl(query: string) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`
}

function buildRelatedYouTubeLinks(category: string, eventNames: string[]) {
  const categoryLabel = formatCategoryLabel(category)
  const directLinksByCategory: Record<string, { label: string; url: string }[]> = {
    football: [
      { label: 'Premier League channel', url: 'https://www.youtube.com/@premierleague/videos' },
      { label: 'UEFA channel', url: 'https://www.youtube.com/@UEFA/videos' },
    ],
    basketball: [
      { label: 'NBA channel', url: 'https://www.youtube.com/@NBA/videos' },
      { label: 'NBA highlights', url: 'https://www.youtube.com/@NBA/playlists' },
    ],
    hockey: [
      { label: 'NHL channel', url: 'https://www.youtube.com/@NHL/videos' },
      { label: 'NHL highlights', url: 'https://www.youtube.com/@NHL/playlists' },
    ],
    mma: [
      { label: 'UFC channel', url: 'https://www.youtube.com/@ufc/videos' },
      { label: 'UFC highlights', url: 'https://www.youtube.com/@ufc/playlists' },
    ],
    'motorsport-f1': [
      { label: 'Formula 1 channel', url: 'https://www.youtube.com/@Formula1/videos' },
      { label: 'F1 highlights', url: 'https://www.youtube.com/@Formula1/playlists' },
    ],
    tennis: [
      { label: 'Tennis TV channel', url: 'https://www.youtube.com/@TennisTV/videos' },
      { label: 'Tennis TV highlights', url: 'https://www.youtube.com/@TennisTV/playlists' },
    ],
    volleyball: [
      { label: 'Volleyball World channel', url: 'https://www.youtube.com/@volleyballworld/videos' },
      { label: 'Volleyball highlights', url: 'https://www.youtube.com/@volleyballworld/playlists' },
    ],
    handball: [
      { label: 'IHF competitions channel', url: 'https://www.youtube.com/@IHFCompetitions/videos' },
      { label: 'Handball highlights', url: 'https://www.youtube.com/@IHFCompetitions/playlists' },
    ],
    esports: [
      { label: 'ESL esports channel', url: 'https://www.youtube.com/@ESL/videos' },
      { label: 'Valorant esports channel', url: 'https://www.youtube.com/@ValorantEsports/videos' },
    ],
    'esports-dota2': [
      { label: 'Dota 2 channel', url: 'https://www.youtube.com/@dota2/videos' },
      { label: 'ESL Dota 2 channel', url: 'https://www.youtube.com/@ESLDota2/videos' },
    ],
    'esports-lol': [
      { label: 'LoL Esports channel', url: 'https://www.youtube.com/@lolesports/videos' },
      { label: 'LCK Global channel', url: 'https://www.youtube.com/@LCKglobal/videos' },
    ],
    'esports-valorant': [
      { label: 'Valorant Esports channel', url: 'https://www.youtube.com/@ValorantEsports/videos' },
      { label: 'VCT live stream archive', url: 'https://www.youtube.com/watch?v=e_E9W2vsRbQ' },
    ],
    'esports-cs2': [
      { label: 'ESL Counter-Strike channel', url: 'https://www.youtube.com/@ESLCS/videos' },
      { label: 'CS2 live stream archive', url: 'https://www.youtube.com/watch?v=ExZtISgOxEQ' },
    ],
  }

  const directLinks = directLinksByCategory[category]
  if (directLinks?.length) return directLinks

  return eventNames.slice(0, 3).map((eventName) => ({
    label: `${eventName} videos`,
    url: buildYouTubeSearchUrl(`${categoryLabel} ${eventName} moments`),
  }))
}
