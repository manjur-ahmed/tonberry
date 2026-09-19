import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapPin } from 'lucide-react'
import { setCachedGpsLocation } from '../lib/gpsLocation'

// Step 2 of onboarding (Country -> Location -> Theme -> Pricing). Purely a
// permission prompt — the location itself is never sent to the backend or
// tied to the user's account (see gpsLocation.ts), just cached client-side
// the same way Steps Planner/Activity Planner's own "Allow location" flow
// already does, so a tool that needs it doesn't have to ask again right
// after onboarding.
function Location() {
  const navigate = useNavigate()
  const [isLocating, setIsLocating] = useState(false)
  const [deniedOrUnsupported, setDeniedOrUnsupported] = useState(false)

  function handleContinue() {
    navigate('/theme', { replace: true })
  }

  function handleAllowLocation() {
    if (!navigator.geolocation) {
      setDeniedOrUnsupported(true)
      return
    }
    setIsLocating(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsLocating(false)
        setCachedGpsLocation({ lat: position.coords.latitude, lng: position.coords.longitude })
        handleContinue()
      },
      () => {
        setIsLocating(false)
        setDeniedOrUnsupported(true)
      },
      // Same timeout as every other "Allow location" flow in the app — see
      // ToolDashboard.tsx's identical handler for why one's needed at all.
      { timeout: 10000 },
    )
  }

  return (
    <main className="relative overflow-hidden bg-gradient-to-b from-indigo-100 via-violet-50 to-white px-4 py-16">
      <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-violet-300/40 blur-2xl" />
      <div className="pointer-events-none absolute -left-16 top-20 h-32 w-32 rounded-full bg-indigo-200/50 blur-2xl" />

      <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-md shadow-slate-300/40">
        <MapPin className="h-7 w-7 text-violet-500" strokeWidth={1.75} />
      </div>

      <h1 className="relative mt-6 text-center font-display text-3xl font-extrabold leading-tight text-slate-900">
        Share your location?
      </h1>
      <p className="relative mt-2 text-center text-slate-600">
        It helps some AI tools give more relevant answers, like suggesting things actually near you. You can turn
        this off at any time in Settings.
      </p>

      <div className="relative mt-8 flex flex-col gap-3">
        <button
          type="button"
          disabled={isLocating}
          onClick={handleAllowLocation}
          className="rounded-full bg-slate-900 py-3 text-center text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isLocating ? 'Getting your location...' : 'Allow location'}
        </button>
        <button
          type="button"
          onClick={handleContinue}
          className="rounded-full border border-slate-300 bg-white/70 py-3 text-center text-sm font-semibold text-slate-900 hover:bg-white"
        >
          Not now
        </button>
      </div>

      {deniedOrUnsupported && (
        <p className="relative mt-4 text-center text-sm text-slate-500">
          No location was shared — you can still continue, and can allow it later.
        </p>
      )}
    </main>
  )
}

export default Location
