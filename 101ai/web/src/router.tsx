import { createBrowserRouter } from 'react-router-dom'
import { withFaroRouterInstrumentation } from '@grafana/faro-react'
import Layout from './components/Layout'
import Home from './pages/Home'
import ToolPage from './pages/ToolPage'
import ToolDashboard from './pages/ToolDashboard'
import Chat from './pages/Chat'
import NoteEditor from './pages/NoteEditor'
import SignIn from './pages/SignIn'
import Pricing from './pages/Pricing'
import Settings from './pages/Settings'
import ChangePassword from './pages/ChangePassword'
import Recent from './pages/Recent'
import Country from './pages/Country'
import AuthCallback from './pages/AuthCallback'
import AdminUsage from './pages/AdminUsage'
import RecommendTool from './pages/RecommendTool'
import AdminSuggestions from './pages/AdminSuggestions'
import AdminDebug from './pages/AdminDebug'
import NotFound from './pages/NotFound'
import RouteError from './pages/RouteError'

// withFaroRouterInstrumentation is safe to apply unconditionally — it only
// subscribes to route changes; without Faro actually initialized (see
// lib/faro.ts's hostname gate), that subscription is a real no-op and
// reports nothing anywhere (confirmed against the package's own source:
// its internal isInitialized flag only ever flips via initializeFaro's own
// ReactIntegration setup).
export const router = withFaroRouterInstrumentation(createBrowserRouter([
  {
    element: <Layout />,
    children: [
      // Pathless wrapper so errorElement replaces only this subtree, not
      // Layout itself (see RouteError.tsx) — BottomNav stays visible even
      // when a page throws, giving the user a way to navigate away from
      // the crash instead of getting stuck.
      {
        errorElement: <RouteError />,
        children: [
          { path: '/', element: <Home /> },
          { path: '/tools/:slug', element: <ToolPage /> },
          { path: '/tools/:slug/dashboard', element: <ToolDashboard /> },
          { path: '/tools/:slug/chats/:chatId', element: <Chat /> },
          { path: '/tools/:slug/notes/:noteId', element: <NoteEditor /> },
          { path: '/sign-in', element: <SignIn /> },
          { path: '/pricing', element: <Pricing /> },
          { path: '/country', element: <Country /> },
          { path: '/settings', element: <Settings /> },
          { path: '/settings/password', element: <ChangePassword /> },
          { path: '/settings/recommend-tool', element: <RecommendTool /> },
          { path: '/recent', element: <Recent /> },
          { path: '/auth/callback', element: <AuthCallback /> },
          { path: '/admin/usage', element: <AdminUsage /> },
          { path: '/admin/suggestions', element: <AdminSuggestions /> },
          { path: '/admin/debug', element: <AdminDebug /> },
          // Catch-all — any URL that matches nothing above lands here
          // instead of React Router's raw blank screen.
          { path: '*', element: <NotFound /> },
        ],
      },
    ],
  },
]))
