import { useEffect, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import { ExternalLink } from 'lucide-react'
import { saveItem, ItemLimitReachedError } from '../../lib/items'
import { withMinDuration, MIN_SAVE_SPINNER_MS } from '../../lib/delay'
import { hasSavedItemForMessage, markItemSavedForMessage } from '../../lib/savedMessageItems'
import type { ResponseViewProps } from '../responseViews'

export interface SavedProductData {
  title: string | null
  price: string | null
  oldPrice: string | null
  thumbnail: string | null
  link: string | null
  source: string | null
  rating: number | null
  reviews: number | null
}

function isSavedProductData(value: unknown): value is SavedProductData {
  if (!value || typeof value !== 'object') return false
  return 'link' in value
}

// Each individual product search saves as its OWN item, keyed by its
// thread — same "one item per real result" rule as Steps Planner/News.
// Real title/price/seller come from SerpApi's actual Google Shopping
// result (see ChatsService/ShoppingService) — this component never
// invents or estimates them, only renders and saves what was already
// found server-side.
//
// Two ways this renders: a live reply, where Chat.tsx passes the product
// fields as real props and `content` is the deterministic reply text (see
// ShoppingService); or a saved item being reopened read-only, where
// ItemDetailModal instead passes `content` as the raw JSON of the saved
// SavedProductData (no product props at all) — detected by productTitle
// being undefined rather than merely null.
function ShoppingResponse({
  content,
  toolSlug,
  chatId,
  messageId,
  readOnly,
  productTitle,
  productPrice,
  productOldPrice,
  productThumbnail,
  productLink,
  productSource,
  productRating,
  productReviews,
  productThreadId,
  onSaveStatusChange,
}: ResponseViewProps) {
  const isSavedItemView = productTitle === undefined

  let saved: SavedProductData | null = null
  if (isSavedItemView) {
    try {
      const parsed: unknown = JSON.parse(content)
      if (isSavedProductData(parsed)) saved = parsed
    } catch {
      // Not JSON — falls through to the plain-text render below.
    }
  }
  const title = isSavedItemView ? (saved?.title ?? null) : (productTitle ?? null)
  const price = isSavedItemView ? (saved?.price ?? null) : (productPrice ?? null)
  const oldPrice = isSavedItemView ? (saved?.oldPrice ?? null) : (productOldPrice ?? null)
  const thumbnail = isSavedItemView ? (saved?.thumbnail ?? null) : (productThumbnail ?? null)
  const link = isSavedItemView ? (saved?.link ?? null) : (productLink ?? null)
  const source = isSavedItemView ? (saved?.source ?? null) : (productSource ?? null)
  const rating = isSavedItemView ? (saved?.rating ?? null) : (productRating ?? null)
  const reviews = isSavedItemView ? (saved?.reviews ?? null) : (productReviews ?? null)

  const saveMutation = useMutation({
    mutationFn: () => {
      const data: SavedProductData = {
        title: productTitle ?? null,
        price: productPrice ?? null,
        oldPrice: productOldPrice ?? null,
        thumbnail: productThumbnail ?? null,
        link: productLink ?? null,
        source: productSource ?? null,
        rating: productRating ?? null,
        reviews: productReviews ?? null,
      }
      // A product thread (see ShoppingService's continuation handling)
      // shares one dedupKey across every "tweak this product" message
      // ("change it to red"), so saveItem's upsert updates the same Item
      // rather than creating a new one each time — only a genuinely new
      // product search (no productThreadId, or one that starts a new
      // thread) gets its own item, keyed by its own message id as before.
      const request = saveItem(toolSlug, chatId, productTitle ?? 'Product', data, productThreadId ?? messageId)
      // Resolves near-instantly today, but the spinner should still read as
      // a spinner rather than flash by — holds it open at least this long
      // regardless of how fast (or slow, once real) the save is.
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

  // Auto-saves once per live reply that actually found a product — same
  // ref guard against StrictMode's dev-mode double-invoke as every other
  // auto-saving ResponseView (see e.g. steps-planner/ResponseView.tsx).
  const hasSavedRef = useRef(false)
  useEffect(() => {
    if (isSavedItemView || !productTitle || readOnly) return
    if (hasSavedItemForMessage(messageId)) {
      onSaveStatusChange?.('saved')
      return
    }
    if (hasSavedRef.current) return
    hasSavedRef.current = true
    saveMutation.mutate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div>
      <p className="whitespace-pre-line text-sm text-slate-700">{content}</p>
      {title && (
        <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {thumbnail && <img src={thumbnail} alt="" className="aspect-square w-full object-contain bg-slate-50 p-4" />}
          <div className="p-4">
            <p className="text-sm font-semibold text-slate-900">{title}</p>
            <div className="mt-1 flex items-baseline gap-2">
              {price && <span className="text-lg font-bold text-slate-900">{price}</span>}
              {oldPrice && <span className="text-sm text-slate-400 line-through">{oldPrice}</span>}
            </div>
            <p className="mt-0.5 text-xs uppercase tracking-wide text-slate-400">
              {source}
              {rating && reviews ? ` · ${rating}★ (${reviews})` : ''}
            </p>
            {link && (
              <a
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-900"
              >
                <ExternalLink className="h-4 w-4" strokeWidth={2} />
                View product
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default ShoppingResponse
