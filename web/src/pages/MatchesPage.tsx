import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { LayoutGrid, Rows3 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Skeleton } from '../components/ui/skeleton'
import { Switch } from '../components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { fetchMatches, fetchMyProfile } from '../lib/api'
import type { Match } from '../lib/types'

type ViewMode = 'grid' | 'table'
type PeriodFilter = 'all' | 'today' | 'next7' | 'past7' | 'past30'

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

function getYouTubeId(urlString: string) {
  try {
    const url = new URL(urlString)

    if (url.hostname.includes('youtu.be')) {
      return url.pathname.split('/').filter(Boolean)[0] || null
    }

    if (url.hostname.includes('youtube.com')) {
      if (url.pathname.startsWith('/embed/')) {
        return url.pathname.split('/embed/')[1]?.split('/')[0] || null
      }

      const watchId = url.searchParams.get('v')
      if (watchId) return watchId

      const liveId = url.pathname.split('/live/')[1]
      if (liveId) return liveId.split('/')[0]
    }

    return null
  } catch {
    return null
  }
}

function getPreviewImage(urlString: string) {
  const youtubeId = getYouTubeId(urlString)
  if (youtubeId) {
    return `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`
  }
  return null
}

function isPastMatch(match: Match) {
  return dayjs(match.starts_at).isBefore(dayjs())
}

function matchesPeriod(match: Match, period: PeriodFilter) {
  const now = dayjs()
  const startsAt = dayjs(match.starts_at)

  if (period === 'all') return true
  if (period === 'today') return startsAt.isSame(now, 'day')
  if (period === 'next7') return startsAt.isAfter(now) && startsAt.isBefore(now.add(7, 'day'))
  if (period === 'past7') return startsAt.isBefore(now) && startsAt.isAfter(now.subtract(7, 'day'))
  if (period === 'past30') return startsAt.isBefore(now) && startsAt.isAfter(now.subtract(30, 'day'))

  return true
}

export function MatchesPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all')
  const [liveOnly, setLiveOnly] = useState(false)

  const matchesQuery = useQuery({
    queryKey: ['matches', 'all'],
    queryFn: fetchMatches,
    refetchInterval: 15000,
  })

  const profileQuery = useQuery({
    queryKey: ['my-profile'],
    queryFn: fetchMyProfile,
  })

  const categories = useMemo(() => {
    const all = (matchesQuery.data || []).map((match) => match.category)
    return ['all', ...Array.from(new Set(all)).sort()]
  }, [matchesQuery.data])

  const filteredMatches = useMemo(() => {
    return (matchesQuery.data || []).filter((match) => {
      const categoryOk = categoryFilter === 'all' || match.category === categoryFilter
      const periodOk = matchesPeriod(match, periodFilter)
      const liveOnlyOk = !liveOnly || match.status === 'live'
      return categoryOk && periodOk && liveOnlyOk
    })
  }, [matchesQuery.data, categoryFilter, periodFilter, liveOnly])

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Matches</h2>
          <p className="mt-1 text-sm text-slate-300">Browse live, upcoming, and past events. Open any match to predict moments.</p>
        </div>

        <div className="inline-flex rounded-lg border border-slate-700/80 bg-slate-900/70 p-1">
          <Button type="button" size="sm" variant={viewMode === 'grid' ? 'default' : 'ghost'} onClick={() => setViewMode('grid')}>
            <LayoutGrid className="h-4 w-4" /> Grid
          </Button>
          <Button type="button" size="sm" variant={viewMode === 'table' ? 'default' : 'ghost'} onClick={() => setViewMode('table')}>
            <Rows3 className="h-4 w-4" /> Table
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="space-y-1 text-sm">
              <span className="text-slate-300">Category</span>
              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                className="h-10 w-full rounded-md border border-slate-700 bg-slate-900/70 px-3 text-sm"
              >
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category === 'all' ? 'All categories' : category}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-sm">
              <span className="text-slate-300">Period</span>
              <select
                value={periodFilter}
                onChange={(event) => setPeriodFilter(event.target.value as PeriodFilter)}
                className="h-10 w-full rounded-md border border-slate-700 bg-slate-900/70 px-3 text-sm"
              >
                <option value="all">All time</option>
                <option value="today">Today</option>
                <option value="next7">Next 7 days</option>
                <option value="past7">Past 7 days</option>
                <option value="past30">Past 30 days</option>
              </select>
            </label>

            <div className="flex items-end">
              <label className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-700 bg-slate-900/70 px-3 text-sm">
                <Switch checked={liveOnly} onCheckedChange={setLiveOnly} aria-label="Live only" />
                <span className="text-slate-200">Live only</span>
              </label>
            </div>

            <div className="flex items-end">
              <Badge variant="secondary">{filteredMatches.length} results</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {matchesQuery.isError ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load matches</AlertTitle>
          <AlertDescription>Check Supabase credentials and RLS policies.</AlertDescription>
        </Alert>
      ) : null}

      {!profileQuery.isLoading && (!profileQuery.data || !profileQuery.data.onboarding_completed) ? (
        <Alert className="border-emerald-400/30 bg-emerald-500/10">
          <AlertTitle>Finish onboarding</AlertTitle>
          <AlertDescription className="mt-1 flex flex-wrap items-center justify-between gap-3">
            <span>Complete your setup to personalize categories and leaderboard identity.</span>
            <Button asChild size="sm">
              <Link to="/onboarding">Continue onboarding</Link>
            </Button>
          </AlertDescription>
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
                <Skeleton className="h-40 w-full" />
                <Skeleton className="mt-4 h-10 w-28" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {!matchesQuery.isLoading && viewMode === 'grid' ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredMatches.map((match) => {
            const preview = getPreviewImage(match.stream_url)
            const past = isPastMatch(match)

            return (
              <Card key={match.id} className={`overflow-hidden ${match.status === 'live' ? 'border-emerald-400/70' : 'border-slate-700/80'}`}>
                <div className="aspect-video bg-slate-900/80">
                  {preview ? (
                    <img src={preview} alt={`${match.title} preview`} className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="grid h-full place-items-center bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.35),transparent_45%),#0f172a] px-4 text-center text-sm text-slate-300">
                      No preview image
                    </div>
                  )}
                </div>

                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant={statusVariant(match.status)}>{match.status}</Badge>
                    <span className="text-xs text-slate-300">{match.category}</span>
                  </div>
                  <CardTitle className="text-lg leading-snug">{match.title}</CardTitle>
                  <CardDescription>
                    Starts {dayjs(match.starts_at).format('MMM D, HH:mm')} {past ? '· Past event' : ''}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-between gap-2">
                  {past ? <Badge variant="muted">Past</Badge> : <span className="text-xs text-slate-400">Active for prediction/testing</span>}
                  <Button asChild size="sm">
                    <Link to={`/match/${match.id}`}>Open match</Link>
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : null}

      {!matchesQuery.isLoading && viewMode === 'table' ? (
        <Card>
          <CardContent className="pt-5">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Match</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>Past</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMatches.map((match) => (
                  <TableRow key={`row-${match.id}`}>
                    <TableCell className="font-medium">{match.title}</TableCell>
                    <TableCell>{match.category}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(match.status)}>{match.status}</Badge>
                    </TableCell>
                    <TableCell>{dayjs(match.starts_at).format('MMM D, HH:mm')}</TableCell>
                    <TableCell>{isPastMatch(match) ? <Badge variant="muted">Past</Badge> : '-'}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm">
                        <Link to={`/match/${match.id}`}>Open</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      {!matchesQuery.isLoading && filteredMatches.length === 0 ? (
        <Card>
          <CardContent className="pt-5 text-sm text-slate-300">No matches found for selected filters.</CardContent>
        </Card>
      ) : null}
    </section>
  )
}
