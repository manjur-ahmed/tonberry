import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { getLoadingStages, STAGE_DURATION_MS } from '../tools/loadingStages'

function GeneratingResponse({ toolSlug }: { toolSlug: string }) {
  const stages = getLoadingStages(toolSlug)
  const [index, setIndex] = useState(0)

  useEffect(() => {
    setIndex(0)
    if (stages.length < 2) return

    const interval = setInterval(() => {
      setIndex((current) => (current < stages.length - 1 ? current + 1 : current))
    }, STAGE_DURATION_MS)
    return () => clearInterval(interval)
  }, [stages])

  return (
    <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
      <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin" strokeWidth={2} />
      {stages[index]}…
    </div>
  )
}

export default GeneratingResponse
