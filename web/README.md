# Moment Hunter MVP

Moment Hunter is a prediction game prototype where users watch live sports/esports streams and try to predict the exact moment of key events (goal, kill, round win, etc.).

Users earn points based on timing accuracy and compete in leaderboards.

## MVP Scope

- Email/password auth with Supabase Auth
- Live/upcoming matches list
- Match page with stream + prediction buttons
- Server-side scoring based on prediction accuracy
- Match and global leaderboards
- Profile with total points
- Test controls to simulate events for QA

## Tech Stack

- Frontend: React + Vite + TypeScript + Tailwind CSS + shadcn-style UI primitives
- Backend: Supabase (Postgres, Auth, RLS, RPC, triggers)
- Deployment target: Vercel (frontend) + Supabase (backend)

## Project Structure

- `src/` app code
- `src/components/ui/` reusable shadcn-style UI components
- `supabase/migrations/` schema, RLS, seed, and fix migrations
- Root-level planning docs and SQL snapshots exist one level above this folder

## Environment

Create `.env` in `web/`:

```env
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-publishable-key>
```

## Run Locally

```bash
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```

Open the local URL shown by Vite.

## Database Setup (CLI)

This project uses Supabase CLI migrations.

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push --include-all
```

## Seed/Test Data Included

Migrations include:

- Core schema and scoring logic
- RLS policies
- Example matches/event types
- Embed URL fixes for demo matches
- `simulate_event(...)` RPC for testing scoring
- Safe-update fix for `settle_event(...)`

## Testing Flow

1. Sign in / sign up.
2. Open a live match.
3. Submit prediction for an event type.
4. Use **Testing Controls** on match page:
   - `Simulate now`
   - `+5s`
5. Verify leaderboard and points updates.

## Notes

- Some YouTube links cannot be embedded due to provider restrictions. The UI falls back to "Open stream in new tab" when needed.
- Scoring is server-side for fairness.
