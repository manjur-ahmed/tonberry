import { useEffect, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import DefaultResponse from '../default/ResponseView'
import { saveItem, ItemLimitReachedError } from '../../lib/items'
import { withMinDuration, MIN_SAVE_SPINNER_MS } from '../../lib/delay'
import { hasSavedItemForMessage, markItemSavedForMessage } from '../../lib/savedMessageItems'
import type { ResponseViewProps } from '../responseViews'

interface WordDefinition {
  word: string
  phonetic: string
  shortDefinition: string
  meaning: string
  examples: string[]
  synonyms: string[]
  wordType: string
  related: string[]
}

function isWordDefinition(value: unknown): value is WordDefinition {
  if (!value || typeof value !== 'object') return false
  const data = value as Record<string, unknown>
  return typeof data.word === 'string' && typeof data.meaning === 'string'
}

function Label({ children }: { children: string }) {
  return <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">{children}</h3>
}

function WordHelperResponse({ content, toolSlug, chatId, messageId, readOnly, onSaveStatusChange }: ResponseViewProps) {
  let data: WordDefinition | null = null
  try {
    const parsed = JSON.parse(content)
    if (isWordDefinition(parsed)) data = parsed
  } catch {
    data = null
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!data) throw new Error('Nothing to save')
      // Dedup key is the word itself — looking up "happy" twice (or asking
      // a follow-up about it) updates the same item instead of piling up
      // duplicates. Tools with no natural "same thing" concept just omit this.
      const request = saveItem(toolSlug, chatId, data.word, data, data.word.toLowerCase())
      // This resolves near-instantly today, but the spinner should still
      // read as a spinner rather than flash by — holds it open at least
      // this long regardless of how fast (or slow, once real) the save is.
      return withMinDuration(request, MIN_SAVE_SPINNER_MS)
    },
    onMutate: () => onSaveStatusChange?.('saving'),
    onSuccess: () => {
      markItemSavedForMessage(messageId)
      onSaveStatusChange?.('saved')
    },
    onError: (error) => {
      onSaveStatusChange?.(error instanceof ItemLimitReachedError ? 'limit-reached' : 'error')
    },
  })

  // Every response for this tool is worth saving, so it happens
  // automatically rather than waiting on a user click. Runs once per
  // message instance (component is freshly mounted per message.id) — the
  // ref guard is only to dodge StrictMode's dev-mode double-invoke; the
  // dedup key already makes a genuine double-call harmless either way.
  //
  // Reopening a chat remounts this for every historical message too, so a
  // message whose item already saved successfully skips straight to
  // "saved" instead of re-running the save (and, if the item limit's since
  // been hit, flashing an error on something that's already safely stored).
  const hasSavedRef = useRef(false)
  useEffect(() => {
    if (!data || readOnly) return
    if (hasSavedItemForMessage(messageId)) {
      onSaveStatusChange?.('saved')
      return
    }
    if (hasSavedRef.current) return
    hasSavedRef.current = true
    saveMutation.mutate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!data) return <DefaultResponse content={content} toolSlug={toolSlug} chatId={chatId} messageId={messageId} />

  return (
    <div>
      <h2 className="font-display text-4xl font-bold text-slate-900">{data.word}</h2>
      <p className="mt-1 text-sm text-slate-400">/{data.phonetic}/</p>
      <p className="mt-3 font-semibold text-slate-900">{data.shortDefinition}</p>

      <div className="mt-6">
        <Label>Meaning</Label>
        <p className="mt-2 text-sm text-slate-700">{data.meaning}</p>
      </div>

      <div className="mt-6">
        <Label>Examples</Label>
        <ul className="mt-2 space-y-1.5">
          {data.examples.map((example) => (
            <li key={example} className="flex gap-2 text-sm text-slate-700">
              <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-violet-300" />
              &ldquo;{example}&rdquo;
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-6">
        <Label>Synonyms</Label>
        <p className="mt-2 text-sm text-slate-700">{data.synonyms.join(' • ')}</p>
      </div>

      <div className="mt-6">
        <Label>Word Type</Label>
        <p className="mt-2 text-sm text-slate-700">{data.wordType}</p>
      </div>

      <div className="mt-6">
        <Label>Related</Label>
        <p className="mt-2 text-sm text-slate-700">{data.related.join(' • ')}</p>
      </div>
    </div>
  )
}

export default WordHelperResponse
