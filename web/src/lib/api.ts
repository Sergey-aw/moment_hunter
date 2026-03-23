import { supabase } from './supabase'
import type {
  EventType,
  GlobalLeaderboardRow,
  Match,
  MatchLeaderboardRow,
  NotificationPref,
  Profile,
  Room,
  RoomLeaderboardRow,
  RoomVisibility,
} from './types'

async function getUserOrThrow() {
  const user = (await supabase.auth.getUser()).data.user
  if (!user) throw new Error('You need to be signed in.')
  return user
}

export async function fetchMatches() {
  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .neq('status', 'draft')
    .order('starts_at', { ascending: false })

  if (error) throw error
  return (data || []) as Match[]
}

export async function fetchMatchById(matchId: string) {
  const { data, error } = await supabase.from('matches').select('*').eq('id', matchId).maybeSingle()

  if (error) throw error
  return (data as Match | null) || null
}

export async function fetchEventTypes(matchId: string) {
  const { data, error } = await supabase
    .from('match_event_types')
    .select('*')
    .eq('match_id', matchId)
    .order('prediction_window_sec', { ascending: true })

  if (error) throw error
  return (data || []) as EventType[]
}

export async function submitPrediction(matchId: string, eventTypeId: string) {
  const user = await getUserOrThrow()

  const { error } = await supabase.from('predictions').insert({
    user_id: user.id,
    match_id: matchId,
    event_type_id: eventTypeId,
  })

  if (error) throw error
}

export async function simulateEvent(matchId: string, eventTypeId: string, offsetSec = 0) {
  const { data, error } = await supabase.rpc('simulate_event', {
    p_match_id: matchId,
    p_event_type_id: eventTypeId,
    p_offset_sec: offsetSec,
  })

  if (error) throw error
  return data as string
}

export async function fetchGlobalLeaderboard() {
  const { data, error } = await supabase.from('global_leaderboard_view').select('*').order('rank', { ascending: true }).limit(100)

  if (error) throw error
  return (data || []) as GlobalLeaderboardRow[]
}

export async function fetchMatchLeaderboard(matchId: string) {
  const { data, error } = await supabase
    .from('match_leaderboard_view')
    .select('*')
    .eq('match_id', matchId)
    .order('rank', { ascending: true })
    .limit(100)

  if (error) throw error
  return (data || []) as MatchLeaderboardRow[]
}

export async function fetchMyProfile() {
  const user = (await supabase.auth.getUser()).data.user
  if (!user) return null

  const { data, error } = await supabase.from('profiles').select('*').eq('user_id', user.id).maybeSingle()
  if (error) throw error

  return (data as Profile | null) || null
}

export async function completeOnboarding(input: {
  username: string
  favoriteCategories: string[]
  onboardingGoal: 'casual' | 'competitive' | 'creator'
}) {
  const user = await getUserOrThrow()

  const payload = {
    user_id: user.id,
    username: input.username.trim(),
    favorite_categories: input.favoriteCategories,
    onboarding_goal: input.onboardingGoal,
    onboarding_completed: true,
    onboarding_completed_at: new Date().toISOString(),
    welcome_tour_completed: false,
    welcome_tour_completed_at: null,
  }

  const { data, error } = await supabase.from('profiles').upsert(payload, { onConflict: 'user_id' }).select('*').single()
  if (error) throw error
  return data as Profile
}

export async function completeWelcomeTour() {
  const user = await getUserOrThrow()
  const { data, error } = await supabase
    .from('profiles')
    .update({
      welcome_tour_completed: true,
      welcome_tour_completed_at: new Date().toISOString(),
    })
    .eq('user_id', user.id)
    .select('*')
    .single()

  if (error) throw error
  return data as Profile
}

export async function fetchMyRooms() {
  const user = await getUserOrThrow()

  const { data, error } = await supabase
    .from('room_members')
    .select('room_id, role, joined_at, rooms:rooms!inner(*)')
    .eq('user_id', user.id)
    .order('joined_at', { ascending: false })

  if (error) throw error
  return (data || []).map((row) => {
    const room = Array.isArray(row.rooms) ? row.rooms[0] : row.rooms
    return {
      room: room as Room,
      role: row.role as 'owner' | 'member',
      joined_at: row.joined_at as string,
    }
  })
}

export async function createRoom(input: { name: string; matchId: string; visibility: RoomVisibility }) {
  const user = await getUserOrThrow()

  const { data, error } = await supabase
    .from('rooms')
    .insert({
      name: input.name,
      match_id: input.matchId,
      owner_user_id: user.id,
      visibility: input.visibility,
    })
    .select('*')
    .single()

  if (error) throw error
  return data as Room
}

export async function joinRoom(inviteCode: string) {
  const { data, error } = await supabase.rpc('join_room', { p_invite_code: inviteCode })
  if (error) throw error
  return data as string
}

export async function fetchRoomById(roomId: string) {
  const { data, error } = await supabase.from('rooms').select('*').eq('id', roomId).maybeSingle()
  if (error) throw error
  return (data as Room | null) || null
}

export async function fetchRoomLeaderboard(roomId: string) {
  const { data, error } = await supabase
    .from('room_leaderboard_view')
    .select('*')
    .eq('room_id', roomId)
    .order('rank', { ascending: true })
    .limit(100)

  if (error) throw error
  return (data || []) as RoomLeaderboardRow[]
}

export async function submitRoomPrediction(roomId: string, matchId: string, eventTypeId: string) {
  const user = await getUserOrThrow()
  const { error } = await supabase.from('room_predictions').insert({
    room_id: roomId,
    user_id: user.id,
    match_id: matchId,
    event_type_id: eventTypeId,
  })
  if (error) throw error
}

export async function fetchNotificationPrefs(matchId: string) {
  const user = await getUserOrThrow()
  const { data, error } = await supabase
    .from('notification_prefs')
    .select('*')
    .eq('user_id', user.id)
    .eq('match_id', matchId)
    .eq('channel', 'in_app')

  if (error) throw error
  return (data || []) as NotificationPref[]
}

export async function setNotificationPref(matchId: string, eventTypeId: string, enabled: boolean) {
  const user = await getUserOrThrow()
  const { error } = await supabase.from('notification_prefs').upsert(
    {
      user_id: user.id,
      match_id: matchId,
      event_type_id: eventTypeId,
      channel: 'in_app',
      enabled,
    },
    {
      onConflict: 'user_id,match_id,event_type_id,channel',
    },
  )
  if (error) throw error
}
