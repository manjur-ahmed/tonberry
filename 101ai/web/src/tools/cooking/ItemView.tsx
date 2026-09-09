interface RecipeItemData {
  recipeName: string
  ingredients: string[]
  instructions: string[]
}

function isRecipeItemData(value: unknown): value is RecipeItemData {
  if (!value || typeof value !== 'object') return false
  const data = value as Record<string, unknown>
  return typeof data.recipeName === 'string' && Array.isArray(data.ingredients)
}

function CookingItemView({ title, data }: { title: string; data: unknown }) {
  if (!isRecipeItemData(data)) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <h3 className="font-display text-xl font-bold text-slate-900">{data.recipeName}</h3>
      <p className="mt-0.5 text-xs uppercase tracking-wide text-slate-400">
        {data.ingredients.length} ingredients &bull; {data.instructions.length} steps
      </p>
      <p className="mt-2 line-clamp-3 text-sm text-slate-600">{data.ingredients.join(', ')}</p>
    </div>
  )
}

export default CookingItemView
