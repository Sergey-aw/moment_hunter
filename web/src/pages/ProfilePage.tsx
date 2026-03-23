import { useQuery } from '@tanstack/react-query'
import { Badge } from '../components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { fetchMyProfile } from '../lib/api'

export function ProfilePage() {
  const profileQuery = useQuery({
    queryKey: ['my-profile'],
    queryFn: fetchMyProfile,
  })

  if (profileQuery.isLoading) {
    return <p className="text-sm text-slate-300">Loading profile...</p>
  }

  if (!profileQuery.data) {
    return <p className="text-sm text-slate-300">Profile not found yet. Complete sign-up to initialize your profile.</p>
  }

  const profile = profileQuery.data

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle className="text-xl">Profile</CardTitle>
        <CardDescription>Basic account and ranking state.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex items-center justify-between rounded-lg border border-slate-700/80 bg-slate-800/50 px-4 py-3">
          <span className="text-slate-300">Username</span>
          <span className="font-medium">{profile.username || 'Anonymous'}</span>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-slate-700/80 bg-slate-800/50 px-4 py-3">
          <span className="text-slate-300">Total points</span>
          <Badge>{profile.total_points}</Badge>
        </div>
      </CardContent>
    </Card>
  )
}
