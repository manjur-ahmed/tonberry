function DefaultResponse({
  content,
}: {
  content: string
  toolSlug?: string
  chatId?: string
  readOnly?: boolean
}) {
  return <p className="text-sm text-slate-700">{content}</p>
}

export default DefaultResponse
