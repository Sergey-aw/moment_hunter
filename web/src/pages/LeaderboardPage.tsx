import { useQuery } from '@tanstack/react-query'
import { Badge } from '../components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { fetchGlobalLeaderboard } from '../lib/api'

export function LeaderboardPage() {
  const leaderboardQuery = useQuery({
    queryKey: ['global-leaderboard'],
    queryFn: fetchGlobalLeaderboard,
    refetchInterval: 10000,
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Global Leaderboard</CardTitle>
        <CardDescription>Top players across all matches.</CardDescription>
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
            {(leaderboardQuery.data || []).map((row) => (
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
  )
}
