import { Outlet } from 'react-router-dom'
import BottomNav from './BottomNav'

function Layout() {
  return (
    <div className="min-h-svh bg-white">
      <div className="relative mx-auto flex min-h-svh w-full max-w-md flex-col">
        <div className="flex flex-1 flex-col">
          <Outlet />
        </div>
        <BottomNav />
      </div>
    </div>
  )
}

export default Layout
