function DefaultItemView({ title }: { title: string; data: unknown }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
    </div>
  )
}

export default DefaultItemView
