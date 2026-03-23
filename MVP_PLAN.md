# Game Prediction MVP Plan

## 1) MVP Goal
Build a web app (desktop + mobile) where users watch a live stream and predict the **exact moment** of key events (goal, kill, knockout, etc.).
Users earn points based on timing accuracy and climb a leaderboard.

## 2) Core MVP Scope (Current)
Keep only the essentials currently in the app:

1. User auth (email/social via Supabase Auth)
2. List of live/upcoming matches
3. Match detail page with:
   - Embedded stream/video
   - Event prediction buttons (e.g., "Goal in next 30s" / "Kill in next 15s")
4. Real-time scoring after event is confirmed
5. Match leaderboard + global leaderboard
6. Basic profile (username, avatar, total points)

Out of scope for current MVP:
- Payments
- Fantasy teams
- Social rooms
- Complex tournament systems
- Anti-cheat ML

## 3) User Flow (Desktop + Mobile, Current)

### A. New user
1. Landing page explains gameplay in 20 seconds
2. Sign up / sign in
3. Choose interests (football, CS2, etc.)
4. Enter first live match

### B. Active gameplay
1. User watches stream on match page
2. UI shows event buttons and countdown windows
3. User taps prediction
4. Prediction is locked with server timestamp
5. Admin/operator confirms actual event moment
6. Points update instantly
7. User sees rank movement

### C. Retention loop
1. End-of-match summary (accuracy, best streak, rank change)
2. Prompt to join next match
3. Weekly leaderboard and simple achievement badges

## 4) Competitive Benchmarks (Mar 23, 2026)
Patterns validated from similar apps:

1. Collaborative bet/pick building and social loops increase engagement.
2. Transparent lock/finalization rules reduce confusion and trust issues.
3. Strong second-screen behavior (watch on TV, act on phone) improves conversion.
4. Granular notifications (by team/match/event) improve retention.
5. Rich timeline + momentum context increases session depth.
6. Missions/streaks/badges improve repeat usage.

## 5) Scoring Model (Simple and Fair)
Use one clear formula for MVP:

- Each event has official timestamp `T_event`
- User prediction timestamp `T_user`
- Delta = `|T_user - T_event|`

Points:
- `<= 1s`: 100
- `<= 3s`: 70
- `<= 5s`: 40
- `<= 10s`: 15
- `> 10s`: 0

Optional later: multiplier by event type (goal x1.5, minor action x1.0).

## 6) Product Structure

### Public pages
1. Landing
2. Upcoming/live matches
3. Match page (main gameplay)
4. Leaderboards
5. Profile

### Admin pages (simple internal)
1. Create match
2. Define category event types
3. Confirm event timestamps (manual control for MVP)

## 7) Tech Stack Plan

### Frontend
- React + Vite
- Tailwind CSS
- React Router
- TanStack Query (server state)
- Zustand or Context for lightweight UI state

### Backend (Supabase)
- Postgres (core data)
- Auth
- Realtime subscriptions (leaderboard + score updates)
- Row Level Security (RLS)
- Edge Functions for secure scoring/event settlement

### Deployment
- Vercel for frontend
- Supabase hosted backend

## 8) Data Model (Current + Updated Shape)
Main tables:

1. `profiles` (`user_id`, `username`, `avatar_url`, `total_points`)
2. `matches` (`id`, `title`, `category`, `starts_at`, `stream_url`, `status`)
3. `event_types` (`id`, `category`, `name`, `prediction_window_sec`)
4. `events` (`id`, `match_id`, `event_type_id`, `official_ts`, `created_by_admin`)
5. `predictions` (`id`, `user_id`, `match_id`, `event_type_id`, `predicted_ts`, `created_at`)
6. `points_log` (`id`, `user_id`, `match_id`, `event_id`, `delta_ms`, `points_awarded`)

Materialized/derived:
- `match_leaderboard_view`
- `global_leaderboard_view`
- `match_event_types` (view joining `matches.category -> event_types.category`)

Planned new tables (next roadmap phases):
1. `rooms`, `room_members`, `room_predictions`, `room_invites`
2. `notification_prefs`
3. `missions`, `mission_rules`, `user_mission_progress`
4. `badges`, `user_badges`
5. `user_streaks`
6. `match_live_state`
7. `event_timeline_items`

## 9) Realtime & Fairness Rules
1. All prediction writes timestamped on server
2. Predictions locked once event window closes
3. Only admin/operator can create official events
4. Scoring runs server-side only
5. Event type category must match match category
6. Realtime channel pushes:
   - New event confirmations
   - Leaderboard updates
   - User point updates

## 10) UI/UX Direction with Tailwind (Desktop + Mobile)
Design goals: clean, sporty, fast.

1. Mobile-first layout with sticky action bar for predictions
2. Large tap targets (thumb-friendly)
3. Split-screen desktop: stream left, prediction/leaderboard right
4. Clear state colors:
   - Live (red)
   - Locked (gray)
   - Success/high score (green)
5. Lightweight animations for:
   - Point gain
   - Rank up/down
   - Event confirmation pulse

## 11) Build Plan (Phased, Synced Roadmap)

### Phase 1: Foundation (Week 1)
1. Project setup (Vite + Tailwind + Supabase client)
2. Auth + profile
3. DB schema + RLS basics
4. Category-scoped event types migration

### Phase 2: Gameplay Core (Week 2)
1. Match list + match page
2. Prediction submission
3. Admin event confirmation panel

### Phase 3: Scoring + Leaderboards (Week 3)
1. Scoring edge function
2. Realtime updates
3. Match/global leaderboard UI

### Phase 4: Polish + Launch Readiness (Week 4)
1. Responsive optimization
2. Error/loading states
3. Basic analytics (funnel + retention)
4. Vercel production deploy

### Phase 5: Social Rooms + Notifications (Week 5-6)
1. Create/join/invite prediction rooms
2. Room leaderboard and feed
3. Notification preferences by match/category/event type
4. In-app push plumbing

### Phase 6: Dynamic Windows + Game Loops (Week 7-8)
1. Dynamic prediction windows (`normal` / `clutch` / `overtime`)
2. Lock reason UX and countdown ring
3. Missions, streaks, badges

### Phase 7: Live Intelligence + Creator Mode MVP (Week 9-10)
1. Timeline cards and momentum strip
2. Creator-hosted branded rooms
3. Referral flow for room growth

## 12) MVP Risks and Mitigations
1. **Stream delay differences by user**:
   - Mitigation: use "predict in upcoming window" mechanics and consistent server timing.
2. **Event timestamp disputes**:
   - Mitigation: admin-only event confirmation + audit log.
3. **Realtime load spikes**:
   - Mitigation: single-region start + indexed queries + pagination.
4. **Cheating/multi-account**:
   - Mitigation: basic rate limits + device/IP heuristics later.

## 13) Success Metrics (First 30 Days)
1. Activation: % users who place first prediction
2. Engagement: predictions per active user/session
3. Retention: D1 / D7
4. Match completion rate
5. Average session length
6. Leaderboard interaction rate

## 14) Sprint 1 Execution Backlog (Next)
1. Implement room schema + RLS + `join_room` RPC.
2. Add room list/create/join UI (`RoomsPage`, `RoomDetailPage`).
3. Add room leaderboard view/query path.
4. Add `notification_prefs` schema + settings UI.
5. Add lock-state reason banner on match page.

## 15) Acceptance Criteria for Sprint 1
1. User can create room, invite another user, and both can place room predictions.
2. Room leaderboard updates after event settlement.
3. User can toggle notifications per event type and match.
4. Prediction lock reason is visible and accurate.
5. No client-side bypasses of write rules under RLS.
