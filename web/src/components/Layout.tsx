import { Outlet } from 'react-router-dom'
import Nav from './Nav'

function Layout() {
  return (
    <div className="min-h-svh bg-white">
      <Nav />
      <Outlet />
    </div>
  )
}

export default Layout
