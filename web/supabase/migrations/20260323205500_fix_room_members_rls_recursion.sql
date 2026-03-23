-- Fix infinite recursion in room_members RLS policy.
-- The previous select policy referenced room_members from room_members itself.

drop policy if exists "room_members_select_room_members" on public.room_members;

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
