import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './index.css'
import { AppShell } from './app/AppShell'
import { AuthPage } from './pages/AuthPage'
import { LeaderboardPage } from './pages/LeaderboardPage'
import { MatchDetailPage } from './pages/MatchDetailPage'
import { MatchesPage } from './pages/MatchesPage'
import { ProfilePage } from './pages/ProfilePage'
import { ProtectedLayout } from './app/ProtectedLayout'

const queryClient = new QueryClient()

const router = createBrowserRouter([
  {
    path: '/auth',
    element: <AuthPage />,
  },
  {
    element: <ProtectedLayout />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: '/', element: <MatchesPage /> },
          { path: '/match/:matchId', element: <MatchDetailPage /> },
          { path: '/leaderboard', element: <LeaderboardPage /> },
          { path: '/profile', element: <ProfilePage /> },
        ],
      },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
