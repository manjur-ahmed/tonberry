import type { ResponseViewProps } from '../responseViews'

function DefaultResponse({ content }: ResponseViewProps) {
  return <p className="text-sm text-slate-700">{content}</p>
}

export default DefaultResponse
