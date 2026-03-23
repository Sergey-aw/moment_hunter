-- Fix circular RLS dependencies between rooms and room_members.
-- Use a security-definer helper so membership checks don't invoke room_members RLS.

create or replace function public.is_room_member(p_room_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.room_members rm
    where rm.room_id = p_room_id
      and rm.user_id = coalesce(p_user_id, auth.uid())
  );
$$;

grant execute on function public.is_room_member(uuid, uuid) to authenticated;

drop policy if exists "rooms_select_member_or_public" on public.rooms;
drop policy if exists "room_members_select_room_members" on public.room_members;
drop policy if exists "room_predictions_select_room_members" on public.room_predictions;
drop policy if exists "room_predictions_insert_own_for_room_member" on public.room_predictions;
drop policy if exists "room_points_log_select_room_members" on public.room_points_log;

create policy "rooms_select_member_or_public"
on public.rooms
for select
to authenticated
using (
  visibility = 'public'
  or owner_user_id = auth.uid()
  or public.is_room_member(id, auth.uid())
  or public.is_admin()
);

create policy "room_members_select_room_members"
on public.room_members
for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.rooms r
    where r.id = public.room_members.room_id
      and r.owner_user_id = auth.uid()
  )
  or public.is_admin()
);

create policy "room_predictions_select_room_members"
on public.room_predictions
for select
to authenticated
using (
  public.is_room_member(public.room_predictions.room_id, auth.uid())
  or public.is_admin()
);

create policy "room_predictions_insert_own_for_room_member"
on public.room_predictions
for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.is_room_member(public.room_predictions.room_id, auth.uid())
  and exists (
    select 1
    from public.rooms r
    join public.matches m
      on m.id = r.match_id
    where r.id = public.room_predictions.room_id
      and r.status = 'open'
      and r.match_id = public.room_predictions.match_id
      and m.status = 'live'
  )
);

create policy "room_points_log_select_room_members"
on public.room_points_log
for select
to authenticated
using (
  public.is_room_member(public.room_points_log.room_id, auth.uid())
  or public.is_admin()
);
