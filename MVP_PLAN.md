# Game Prediction MVP Plan

## 1) MVP Goal
Build a web app (desktop + mobile) where users watch a live stream and predict the **exact moment** of key events (goal, kill, knockout, etc.).
Users earn points based on timing accuracy and climb a leaderboard.

## 2) Core MVP Scope
Keep only the essentials:

1. User auth (email/social via Supabase Auth)
2. List of live/upcoming matches
3. Match detail page with:
   - Embedded stream/video
   - Event prediction buttons (e.g., "Goal in next 30s" / "Kill in next 15s")
4. Real-time scoring after event is confirmed
5. Match leaderboard + global leaderboard
6. Basic profile (username, avatar, total points)

Out of scope for this MVP:
- Payments
- Fantasy teams
- Chat
- Complex tournament systems
- Anti-cheat ML

## 3) User Flow (Desktop + Mobile)

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

## 4) Scoring Model (Simple and Fair)
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

## 5) Product Structure

### Public pages
1. Landing
2. Upcoming/live matches
3. Match page (main gameplay)
4. Leaderboards
5. Profile

### Admin pages (simple internal)
1. Create match
2. Define event types
3. Confirm event timestamps (manual control for MVP)

## 6) Tech Stack Plan

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

## 7) Data Model (MVP)
Main tables:

1. `profiles` (`user_id`, `username`, `avatar_url`, `total_points`)
2. `matches` (`id`, `title`, `category`, `starts_at`, `stream_url`, `status`)
3. `event_types` (`id`, `match_id`, `name`, `prediction_window_sec`)
4. `events` (`id`, `match_id`, `event_type_id`, `official_ts`, `created_by_admin`)
5. `predictions` (`id`, `user_id`, `match_id`, `event_type_id`, `predicted_ts`, `created_at`)
6. `points_log` (`id`, `user_id`, `match_id`, `event_id`, `delta_ms`, `points_awarded`)

Materialized/derived:
- `match_leaderboard_view`
- `global_leaderboard_view`

## 8) Realtime & Fairness Rules
1. All prediction writes timestamped on server
2. Predictions locked once event window closes
3. Only admin/operator can create official events
4. Scoring runs server-side only
5. Realtime channel pushes:
   - New event confirmations
   - Leaderboard updates
   - User point updates

## 9) UI/UX Direction with Tailwind (Desktop + Mobile)
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

## 10) Build Plan (Phased)

### Phase 1: Foundation (Week 1)
1. Project setup (Vite + Tailwind + Supabase client)
2. Auth + profile
3. DB schema + RLS basics

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

## 11) MVP Risks and Mitigations
1. **Stream delay differences by user**:
   - Mitigation: use "predict in upcoming window" mechanics and consistent server timing.
2. **Event timestamp disputes**:
   - Mitigation: admin-only event confirmation + audit log.
3. **Realtime load spikes**:
   - Mitigation: single-region start + indexed queries + pagination.
4. **Cheating/multi-account**:
   - Mitigation: basic rate limits + device/IP heuristics later.

## 12) Success Metrics (First 30 Days)
1. Activation: % users who place first prediction
2. Engagement: predictions per active user/session
3. Retention: D1 / D7
4. Match completion rate
5. Average session length
6. Leaderboard interaction rate

## Next Implementation Artifacts
1. Exact Supabase SQL schema + RLS policies
2. Wireframe-level page structure (desktop/mobile)
3. API/event flow diagram: prediction -> scoring -> leaderboard update
