import { createBrowserRouter } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import ToolPage from './pages/ToolPage'
import ToolDashboard from './pages/ToolDashboard'
import Chat from './pages/Chat'
import SignIn from './pages/SignIn'
import Pricing from './pages/Pricing'
import Settings from './pages/Settings'
import Recent from './pages/Recent'
import Country from './pages/Country'
import AuthCallback from './pages/AuthCallback'

export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/tools/:slug', element: <ToolPage /> },
      { path: '/tools/:slug/dashboard', element: <ToolDashboard /> },
      { path: '/tools/:slug/chats/:chatId', element: <Chat /> },
      { path: '/sign-in', element: <SignIn /> },
      { path: '/pricing', element: <Pricing /> },
      { path: '/country', element: <Country /> },
      { path: '/settings', element: <Settings /> },
      { path: '/recent', element: <Recent /> },
      { path: '/auth/callback', element: <AuthCallback /> },
    ],
  },
])
