import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { fetchGlobalLeaderboard } from '../lib/api'
import type { GlobalLeaderboardRow } from '../lib/types'

type MockBetToast = {
  id: string
  playerName: string
  eventName: string
  stake: number
  pointsDelta: number
}

const MOCK_PLAYERS: Array<{ user_id: string; username: string; basePoints: number }> = [
  { user_id: 'mock-1', username: 'AceArtem', basePoints: 1240 },
  { user_id: 'mock-2', username: 'NoraNova', basePoints: 1212 },
  { user_id: 'mock-3', username: 'VoltVanya', basePoints: 1164 },
  { user_id: 'mock-4', username: 'RexRush', basePoints: 1128 },
  { user_id: 'mock-5', username: 'MilaMint', basePoints: 1098 },
  { user_id: 'mock-6', username: 'PixelPasha', basePoints: 1062 },
  { user_id: 'mock-7', username: 'DimaDash', basePoints: 1024 },
  { user_id: 'mock-8', username: 'IvyIra', basePoints: 992 },
]

const MOCK_EVENTS = ['Next Goal', 'Corner in 60s', 'Yellow Card', 'First Blood', 'Ace Serve', 'Takedown']

function rankRows(rows: GlobalLeaderboardRow[]) {
  return [...rows]
    .sort((a, b) => b.total_points - a.total_points)
    .map((row, index) => ({ ...row, rank: index + 1 }))
}

function createMockLeaderboardRows(sourceRows: GlobalLeaderboardRow[]) {
  const byId = new Map<string, GlobalLeaderboardRow>()
  for (const row of sourceRows) byId.set(row.user_id, row)

  for (const player of MOCK_PLAYERS) {
    if (!byId.has(player.user_id)) {
      byId.set(player.user_id, {
        user_id: player.user_id,
        username: player.username,
        avatar_url: null,
        total_points: player.basePoints,
        rank: 0,
      })
    }
  }

  return rankRows(Array.from(byId.values()))
}

export function LeaderboardPage() {
  const leaderboardQuery = useQuery({
    queryKey: ['global-leaderboard'],
    queryFn: fetchGlobalLeaderboard,
    refetchInterval: 10000,
  })
  const [isLiveTestRunning, setIsLiveTestRunning] = useState(false)
  const [simulatedRows, setSimulatedRows] = useState<GlobalLeaderboardRow[] | null>(null)
  const [toasts, setToasts] = useState<MockBetToast[]>([])
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const toastIdRef = useRef(0)

  const displayedRows = useMemo(() => {
    if (simulatedRows) return simulatedRows
    return leaderboardQuery.data || []
  }, [leaderboardQuery.data, simulatedRows])

  const stopLiveTest = () => {
    setIsLiveTestRunning(false)
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  const startLiveTest = () => {
    if (intervalRef.current) return

    const sourceRows = leaderboardQuery.data || []
    setSimulatedRows(createMockLeaderboardRows(sourceRows))
    setToasts([])
    setIsLiveTestRunning(true)

    intervalRef.current = setInterval(() => {
      const chosenPlayer = MOCK_PLAYERS[Math.floor(Math.random() * MOCK_PLAYERS.length)]
      const eventName = MOCK_EVENTS[Math.floor(Math.random() * MOCK_EVENTS.length)]
      const stake = Math.floor(Math.random() * 120) + 10
      const pointsDelta = Math.floor(Math.random() * 80) - 12

      setSimulatedRows((prevRows) => {
        const current = prevRows || createMockLeaderboardRows(sourceRows)
        const nextRows = current.map((row) =>
          row.user_id === chosenPlayer.user_id
            ? { ...row, total_points: Math.max(0, row.total_points + pointsDelta) }
            : row,
        )
        return rankRows(nextRows)
      })

      toastIdRef.current += 1
      const toast: MockBetToast = {
        id: `mock-bet-${toastIdRef.current}`,
        playerName: chosenPlayer.username,
        eventName,
        stake,
        pointsDelta,
      }

      setToasts((prev) => [toast, ...prev].slice(0, 5))
    }, 1200)
  }

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-2xl">Global Leaderboard</CardTitle>
              <CardDescription>Top players across all matches.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={isLiveTestRunning ? 'live' : 'secondary'}>
                {isLiveTestRunning ? 'Live test ON' : 'Live test OFF'}
              </Badge>
              {isLiveTestRunning ? (
                <Button variant="secondary" onClick={stopLiveTest}>
                  Stop Test
                </Button>
              ) : (
                <Button onClick={startLiveTest}>Run Live Test</Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rank</TableHead>
                <TableHead>Player</TableHead>
                <TableHead className="text-right">Points</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayedRows.map((row) => (
                <TableRow key={row.user_id}>
                  <TableCell>
                    <Badge variant={row.rank <= 3 ? 'default' : 'secondary'}>#{row.rank}</Badge>
                  </TableCell>
                  <TableCell>{row.username || 'Anonymous'}</TableCell>
                  <TableCell className="text-right font-semibold text-emerald-200">{row.total_points}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[22rem] max-w-[calc(100vw-2rem)] flex-col gap-2">
        {toasts.map((toast) => (
          <div key={toast.id} className="rounded-lg border border-emerald-300/30 bg-slate-900/95 px-3 py-2 shadow-lg">
            <p className="text-sm font-semibold text-slate-100">{toast.playerName} placed a bet</p>
            <p className="text-xs text-slate-300">
              {toast.eventName} · stake {toast.stake} ·{' '}
              <span className={toast.pointsDelta >= 0 ? 'text-emerald-300' : 'text-rose-300'}>
                {toast.pointsDelta >= 0 ? `+${toast.pointsDelta}` : toast.pointsDelta} pts
              </span>
            </p>
          </div>
        ))}
      </div>
    </>
  )
}
