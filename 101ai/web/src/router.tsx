import { createBrowserRouter } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import ToolPage from './pages/ToolPage'
import SignIn from './pages/SignIn'
import Pricing from './pages/Pricing'
import AuthCallback from './pages/AuthCallback'

export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/tools/:slug', element: <ToolPage /> },
      { path: '/sign-in', element: <SignIn /> },
      { path: '/pricing', element: <Pricing /> },
      { path: '/auth/callback', element: <AuthCallback /> },
    ],
  },
])
