import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { fetchMe, setToken } from '../lib/api'

function AuthCallback() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const token = searchParams.get('token')
    if (!token) {
      setError('Missing token from sign-in redirect.')
      return
    }
    setToken(token)
    fetchMe()
      .then((user) => {
        navigate(user?.plan && user?.country && user?.name ? '/' : '/pricing', { replace: true })
      })
      .catch(() => setError('Could not complete sign-in. Please try again.'))
  }, [searchParams, navigate])

  return (
    <main className="px-4 py-16 text-center">
      {error ? (
        <p className="text-red-600">{error}</p>
      ) : (
        <p className="text-slate-600">Signing you in...</p>
      )}
    </main>
  )
}

export default AuthCallback
