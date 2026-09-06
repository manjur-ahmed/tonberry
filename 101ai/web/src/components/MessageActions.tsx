import { useState } from 'react'
import { Check, Copy, ThumbsDown, ThumbsUp } from 'lucide-react'
import SaveStatusIndicator from './SaveStatusIndicator'
import type { SaveStatus } from '../tools/responseViews'

function MessageActions({ content, saveStatus }: { content: string; saveStatus?: SaveStatus }) {
  const [copied, setCopied] = useState(false)
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null)

  function handleCopy() {
    navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="mt-2 flex items-center gap-3">
      <button
        type="button"
        onClick={handleCopy}
        aria-label="Copy response"
        className="text-slate-400 hover:text-slate-600"
      >
        {copied ? <Check className="h-4 w-4" strokeWidth={1.75} /> : <Copy className="h-4 w-4" strokeWidth={1.75} />}
      </button>
      <button
        type="button"
        onClick={() => setFeedback((current) => (current === 'up' ? null : 'up'))}
        aria-label="Good response"
        className={feedback === 'up' ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'}
      >
        <ThumbsUp className="h-4 w-4" strokeWidth={1.75} fill={feedback === 'up' ? 'currentColor' : 'none'} />
      </button>
      <button
        type="button"
        onClick={() => setFeedback((current) => (current === 'down' ? null : 'down'))}
        aria-label="Bad response"
        className={feedback === 'down' ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'}
      >
        <ThumbsDown className="h-4 w-4" strokeWidth={1.75} fill={feedback === 'down' ? 'currentColor' : 'none'} />
      </button>
      {saveStatus && <SaveStatusIndicator status={saveStatus} />}
    </div>
  )
}

export default MessageActions
