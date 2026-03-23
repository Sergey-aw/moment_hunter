import { supabase } from './supabase'
import type { EventType, GlobalLeaderboardRow, Match, MatchLeaderboardRow, Profile } from './types'

export async function fetchLiveAndUpcomingMatches() {
  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .in('status', ['live', 'upcoming'])
    .order('starts_at', { ascending: true })

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
    .from('event_types')
    .select('*')
    .eq('match_id', matchId)
    .order('prediction_window_sec', { ascending: true })

  if (error) throw error
  return (data || []) as EventType[]
}

export async function submitPrediction(matchId: string, eventTypeId: string) {
  const user = (await supabase.auth.getUser()).data.user
  if (!user) throw new Error('You need to be signed in.')

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
