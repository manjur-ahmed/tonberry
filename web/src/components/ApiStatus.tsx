import { useQuery } from '@tanstack/react-query'
import { fetchHealth } from '../lib/api'

function ApiStatus() {
  const { data, isPending, isError } = useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
    refetchInterval: 10_000,
  })

  const label = isPending ? 'Checking API...' : isError ? 'API offline' : `API status: ${data.status}`
  const dotColor = isPending ? 'bg-slate-400' : isError ? 'bg-red-500' : 'bg-green-500'

  return (
    <div className="flex items-center gap-2 text-xs text-slate-500">
      <span className={`h-2 w-2 rounded-full ${dotColor}`} />
      {label}
    </div>
  )
}

export default ApiStatus
