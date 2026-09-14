interface ProductItemData {
  title: string | null
  price: string | null
  oldPrice: string | null
  thumbnail: string | null
  source: string | null
  rating: number | null
  reviews: number | null
}

function isProductItemData(value: unknown): value is ProductItemData {
  if (!value || typeof value !== 'object') return false
  return 'link' in value
}

function ShoppingItemView({ title, data }: { title: string; data: unknown }) {
  if (!isProductItemData(data)) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      {data.thumbnail && (
        <img src={data.thumbnail} alt="" className="aspect-square w-full object-contain bg-slate-50 p-4" />
      )}
      <div className="p-4">
        <p className="text-sm font-semibold text-slate-900">{data.title ?? title}</p>
        <div className="mt-1 flex items-baseline gap-2">
          {data.price && <span className="text-base font-bold text-slate-900">{data.price}</span>}
          {data.oldPrice && <span className="text-xs text-slate-400 line-through">{data.oldPrice}</span>}
        </div>
        <p className="mt-0.5 text-xs uppercase tracking-wide text-slate-400">
          {data.source}
          {data.rating && data.reviews ? ` · ${data.rating}★ (${data.reviews})` : ''}
        </p>
      </div>
    </div>
  )
}

export default ShoppingItemView
