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
  category: string
  name: string
  prediction_window_sec: number
}

export type RoomVisibility = 'public' | 'private'
export type RoomStatus = 'open' | 'closed'

export type Room = {
  id: string
  name: string
  owner_user_id: string
  match_id: string
  visibility: RoomVisibility
  invite_code: string
  status: RoomStatus
  created_at: string
}

export type RoomMembership = {
  room_id: string
  user_id: string
  role: 'owner' | 'member'
  joined_at: string
}

export type RoomLeaderboardRow = {
  room_id: string
  user_id: string
  username: string | null
  avatar_url: string | null
  points: number
  rank: number
}

export type NotificationPref = {
  id: string
  user_id: string
  match_id: string
  event_type_id: string
  channel: 'in_app' | 'email' | 'push'
  enabled: boolean
  updated_at: string
}

export type Profile = {
  user_id: string
  username: string | null
  avatar_url: string | null
  total_points: number
  onboarding_completed: boolean
  onboarding_completed_at: string | null
  favorite_categories: string[]
  onboarding_goal: 'casual' | 'competitive' | 'creator' | null
  welcome_tour_completed: boolean
  welcome_tour_completed_at: string | null
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

export type MyMatchBet = {
  id: string
  match_id: string
  event_type_id: string
  predicted_ts: string
  created_at: string
}
