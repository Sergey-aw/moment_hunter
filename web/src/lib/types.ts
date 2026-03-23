export type MatchStatus = 'draft' | 'upcoming' | 'live' | 'completed' | 'cancelled'

export type Match = {
  id: string
  title: string
  category: string
  stream_url: string
  status: MatchStatus
  starts_at: string
  ends_at: string | null
}

export type EventType = {
  id: string
  match_id: string
  name: string
  prediction_window_sec: number
}

export type Profile = {
  user_id: string
  username: string | null
  avatar_url: string | null
  total_points: number
}

export type MatchLeaderboardRow = {
  match_id: string
  user_id: string
  username: string | null
  avatar_url: string | null
  points: number
  rank: number
}

export type GlobalLeaderboardRow = {
  user_id: string
  username: string | null
  avatar_url: string | null
  total_points: number
  rank: number
}
