import { useQuery, useQueryClient } from '@tanstack/react-query'
import { clearToken, fetchMe, getToken } from '../lib/api'

export function useAuth() {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['me'],
    queryFn: fetchMe,
    enabled: !!getToken(),
    retry: false,
  })

  function signOut() {
    clearToken()
    // Clear everything, not just ['me'] — chats/items queries have no auth
    // gate on their `enabled` option, so they'd otherwise keep serving the
    // previous user's cached data (as stale-but-shown) after logout.
    queryClient.clear()
  }

  return {
    user: query.data ?? null,
    isLoading: !!getToken() && query.isLoading,
    // A token in localStorage means "almost certainly logged in" before
    // the /auth/me round trip even starts — pages use this to pick the
    // right skeleton shape immediately instead of rendering nothing until
    // the network confirms it.
    hasToken: !!getToken(),
    signOut,
  }
}
