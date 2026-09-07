import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { setPassword } from '../lib/api'

function ChangePassword() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) navigate('/sign-in', { replace: true })
  }, [user, navigate])

  const mutation = useMutation({
    mutationFn: () => setPassword(newPassword),
    onSuccess: (updatedUser) => {
      queryClient.setQueryData(['me'], updatedUser)
      navigate('/settings', { replace: true })
    },
  })

  function handleSubmit() {
    setValidationError(null)
    if (newPassword.length < 8) {
      setValidationError('New password must be at least 8 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setValidationError("New passwords don't match.")
      return
    }
    mutation.mutate()
  }

  if (!user) return null

  const error = validationError ?? (mutation.isError ? (mutation.error as Error).message : null)

  return (
    <main className="px-4 py-6">
      <button type="button" onClick={() => navigate(-1)} aria-label="Back" className="text-slate-900">
        <ChevronLeft className="h-6 w-6" strokeWidth={1.75} />
      </button>

      <h1 className="mt-4 font-display text-2xl font-semibold text-slate-900">Change password</h1>
      <p className="mt-2 text-sm text-slate-600">
        {user.hasPassword
          ? 'Update the password you use to sign in with email.'
          : "Set a password so you can sign in with email, not just Google — handy on a device Google's sign-in redirect can't reach."}
      </p>

      <form
        className="mt-6 flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault()
          handleSubmit()
        }}
      >
        <input
          type="password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          placeholder="New password"
          className="rounded-full border border-slate-200 bg-white px-5 py-3 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
        />
        <input
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          placeholder="Confirm new password"
          className="rounded-full border border-slate-200 bg-white px-5 py-3 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
        />

        <button
          type="submit"
          disabled={mutation.isPending}
          className="mt-3 w-full rounded-full bg-slate-900 py-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {mutation.isPending ? 'Saving...' : 'Save password'}
        </button>

        {error && <p className="text-center text-sm text-red-600">{error}</p>}
      </form>
    </main>
  )
}

export default ChangePassword
