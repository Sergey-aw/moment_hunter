import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { Link } from 'react-router-dom'
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Skeleton } from '../components/ui/skeleton'
import { fetchLiveAndUpcomingMatches } from '../lib/api'
import type { Match } from '../lib/types'

function statusVariant(status: Match['status']) {
  switch (status) {
    case 'live':
      return 'live'
    case 'upcoming':
      return 'upcoming'
    default:
      return 'muted'
  }
}

export function MatchesPage() {
  const matchesQuery = useQuery({
    queryKey: ['matches', 'live-upcoming'],
    queryFn: fetchLiveAndUpcomingMatches,
    refetchInterval: 15000,
  })

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold">Live & Upcoming Matches</h2>
        <p className="mt-1 text-sm text-slate-300">Pick a match, open stream, and submit your event timing prediction.</p>
      </div>

      {matchesQuery.isError ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load matches</AlertTitle>
          <AlertDescription>Check Supabase credentials and RLS policies.</AlertDescription>
        </Alert>
      ) : null}

      {matchesQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, idx) => (
            <Card key={idx}>
              <CardHeader>
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-6 w-2/3" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="mt-4 h-10 w-28" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {(matchesQuery.data || []).map((match) => (
          <Card key={match.id} className="border-slate-700/80">
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <Badge variant={statusVariant(match.status)}>{match.status}</Badge>
                <span className="text-xs text-slate-300">{match.category}</span>
              </div>
              <CardTitle className="text-lg leading-snug">{match.title}</CardTitle>
              <CardDescription>Starts {dayjs(match.starts_at).format('MMM D, HH:mm')}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link to={`/match/${match.id}`}>Open match</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}
