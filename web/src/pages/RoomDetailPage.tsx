import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Alert, AlertDescription } from '../components/ui/alert'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { fetchEventTypes, fetchMatchById, fetchRoomById, fetchRoomLeaderboard, submitRoomPrediction } from '../lib/api'

export function RoomDetailPage() {
  const { roomId } = useParams<{ roomId: string }>()
  const queryClient = useQueryClient()
  const [message, setMessage] = useState<string | null>(null)

  const roomQuery = useQuery({
    queryKey: ['room', roomId],
    queryFn: () => fetchRoomById(roomId || ''),
    enabled: Boolean(roomId),
  })

  const matchQuery = useQuery({
    queryKey: ['room-match', roomQuery.data?.match_id],
    queryFn: () => fetchMatchById(roomQuery.data?.match_id || ''),
    enabled: Boolean(roomQuery.data?.match_id),
  })

  const eventTypesQuery = useQuery({
    queryKey: ['room-event-types', roomQuery.data?.match_id],
    queryFn: () => fetchEventTypes(roomQuery.data?.match_id || ''),
    enabled: Boolean(roomQuery.data?.match_id),
  })

  const leaderboardQuery = useQuery({
    queryKey: ['room-leaderboard', roomId],
    queryFn: () => fetchRoomLeaderboard(roomId || ''),
    enabled: Boolean(roomId),
    refetchInterval: 5000,
  })

  const predictMutation = useMutation({
    mutationFn: ({ eventTypeId }: { eventTypeId: string }) => submitRoomPrediction(roomId || '', roomQuery.data?.match_id || '', eventTypeId),
    onSuccess: async () => {
      setMessage('Room prediction accepted.')
      await queryClient.invalidateQueries({ queryKey: ['room-leaderboard', roomId] })
    },
    onError: (error: Error) => setMessage(error.message),
  })

  const canPredict = useMemo(() => {
    const roomOpen = roomQuery.data?.status === 'open'
    const matchLive = matchQuery.data?.status === 'live'
    return roomOpen && matchLive
  }, [matchQuery.data?.status, roomQuery.data?.status])

  if (roomQuery.isLoading) {
    return <p className="text-sm text-slate-300">Loading room...</p>
  }

  if (!roomQuery.data) {
    return <p className="text-sm text-slate-300">Room not found or not accessible.</p>
  }

  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)]">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>{roomQuery.data.name}</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant={roomQuery.data.status === 'open' ? 'live' : 'muted'}>{roomQuery.data.status}</Badge>
              <Badge variant="secondary">{roomQuery.data.visibility}</Badge>
            </div>
          </div>
          <CardDescription>
            Invite code: <span className="font-mono">{roomQuery.data.invite_code}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-slate-700/70 bg-slate-900/60 p-3 text-sm text-slate-200">
            <p className="font-semibold">Match</p>
            <p>{matchQuery.data?.title || 'Loading...'}</p>
            {roomQuery.data.match_id ? (
              <Button asChild size="sm" variant="outline" className="mt-3">
                <Link to={`/match/${roomQuery.data.match_id}`}>Open match page</Link>
              </Button>
            ) : null}
          </div>

          <Card className="border-emerald-400/20 bg-slate-950/40">
            <CardHeader>
              <CardTitle className="text-base">Room Predictions</CardTitle>
              <CardDescription>Predictions here are scored for this room leaderboard.</CardDescription>
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
                  <AlertDescription>Room predictions are open only when room is `open` and match is `live`.</AlertDescription>
                </Alert>
              ) : null}
            </CardContent>
          </Card>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Room Leaderboard</CardTitle>
          <CardDescription>Top participants in this room.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {(leaderboardQuery.data || []).map((row) => (
            <div key={row.user_id} className="flex items-center justify-between rounded-lg border border-slate-700/80 bg-slate-800/60 px-3 py-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="inline-grid h-6 w-6 place-items-center rounded-full bg-slate-700 text-xs">{row.rank}</span>
                <span>{row.username || 'Anonymous'}</span>
              </div>
              <span className="font-semibold text-emerald-200">{row.points}</span>
            </div>
          ))}
          {!leaderboardQuery.data?.length ? <p className="text-sm text-slate-300">No room scores yet.</p> : null}
        </CardContent>
      </Card>
    </section>
  )
}
