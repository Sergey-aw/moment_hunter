import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { createRoom, fetchMatches, fetchMyRooms, joinRoom } from '../lib/api'
import type { RoomVisibility } from '../lib/types'

export function RoomsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [name, setName] = useState('')
  const [matchId, setMatchId] = useState('')
  const [visibility, setVisibility] = useState<RoomVisibility>('public')
  const [inviteCode, setInviteCode] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  const myRoomsQuery = useQuery({
    queryKey: ['rooms', 'mine'],
    queryFn: fetchMyRooms,
    refetchInterval: 10000,
  })

  const matchesQuery = useQuery({
    queryKey: ['matches', 'for-rooms'],
    queryFn: fetchMatches,
  })

  const createRoomMutation = useMutation({
    mutationFn: createRoom,
    onSuccess: async (room) => {
      setMessage(`Room created. Invite code: ${room.invite_code}`)
      setName('')
      await queryClient.invalidateQueries({ queryKey: ['rooms', 'mine'] })
      navigate(`/rooms/${room.id}`)
    },
    onError: (error: Error) => setMessage(error.message),
  })

  const joinRoomMutation = useMutation({
    mutationFn: joinRoom,
    onSuccess: async (roomId) => {
      setMessage('Joined room successfully.')
      setInviteCode('')
      await queryClient.invalidateQueries({ queryKey: ['rooms', 'mine'] })
      navigate(`/rooms/${roomId}`)
    },
    onError: (error: Error) => setMessage(error.message),
  })

  async function onCreateRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!name.trim() || !matchId) {
      setMessage('Please set room name and target match.')
      return
    }

    createRoomMutation.mutate({ name: name.trim(), matchId, visibility })
  }

  async function onJoinRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!inviteCode.trim()) {
      setMessage('Enter invite code first.')
      return
    }

    joinRoomMutation.mutate(inviteCode.trim())
  }

  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Create Room</CardTitle>
          <CardDescription>Start a shared prediction room for a specific match.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={onCreateRoom}>
            <div className="space-y-1">
              <label htmlFor="room-name" className="text-sm text-slate-300">
                Room name
              </label>
              <Input id="room-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Evening football crew" />
            </div>

            <div className="space-y-1">
              <label htmlFor="room-match" className="text-sm text-slate-300">
                Match
              </label>
              <select
                id="room-match"
                value={matchId}
                onChange={(event) => setMatchId(event.target.value)}
                className="h-10 w-full rounded-md border border-slate-700 bg-slate-900/70 px-3 text-sm"
              >
                <option value="">Select match</option>
                {(matchesQuery.data || [])
                  .filter((match) => match.status === 'live' || match.status === 'upcoming')
                  .map((match) => (
                    <option key={match.id} value={match.id}>
                      {match.title} ({match.status})
                    </option>
                  ))}
              </select>
            </div>

            <div className="space-y-1">
              <label htmlFor="room-visibility" className="text-sm text-slate-300">
                Visibility
              </label>
              <select
                id="room-visibility"
                value={visibility}
                onChange={(event) => setVisibility(event.target.value as RoomVisibility)}
                className="h-10 w-full rounded-md border border-slate-700 bg-slate-900/70 px-3 text-sm"
              >
                <option value="public">Public</option>
                <option value="private">Private</option>
              </select>
            </div>

            <Button type="submit" disabled={createRoomMutation.isPending}>
              {createRoomMutation.isPending ? 'Creating...' : 'Create room'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Join Room</CardTitle>
          <CardDescription>Enter a room invite code to join instantly.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={onJoinRoom}>
            <div className="space-y-1">
              <label htmlFor="invite-code" className="text-sm text-slate-300">
                Invite code
              </label>
              <Input
                id="invite-code"
                value={inviteCode}
                onChange={(event) => setInviteCode(event.target.value.toUpperCase())}
                placeholder="AB12CD34"
              />
            </div>
            <Button type="submit" variant="secondary" disabled={joinRoomMutation.isPending}>
              {joinRoomMutation.isPending ? 'Joining...' : 'Join room'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {message ? (
        <Alert className="lg:col-span-2">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>My Rooms</CardTitle>
          <CardDescription>Rooms where you can place room predictions.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {myRoomsQuery.isError ? (
            <Alert variant="destructive">
              <AlertTitle>Could not load rooms</AlertTitle>
              <AlertDescription>Check migration status and room RLS policies.</AlertDescription>
            </Alert>
          ) : null}

          {(myRoomsQuery.data || []).map(({ room, role }) => (
            <div key={room.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-700/70 bg-slate-800/50 px-3 py-2 text-sm">
              <div>
                <p className="font-semibold text-slate-100">{room.name}</p>
                <p className="text-xs text-slate-300">
                  Invite: <span className="font-mono">{room.invite_code}</span>
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Badge variant={room.status === 'open' ? 'live' : 'muted'}>{room.status}</Badge>
                <Badge variant="secondary">{role}</Badge>
                <Button asChild size="sm">
                  <Link to={`/rooms/${room.id}`}>Open room</Link>
                </Button>
              </div>
            </div>
          ))}

          {!myRoomsQuery.isLoading && !myRoomsQuery.data?.length ? <p className="text-sm text-slate-300">No rooms yet.</p> : null}
        </CardContent>
      </Card>
    </section>
  )
}
