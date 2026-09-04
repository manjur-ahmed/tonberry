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
    queryClient.setQueryData(['me'], null)
  }

  return {
    user: query.data ?? null,
    isLoading: !!getToken() && query.isLoading,
    signOut,
  }
}
