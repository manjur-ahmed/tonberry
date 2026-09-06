import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft } from 'lucide-react'
import { getAllChats } from '../lib/chats'
import { getTool } from '../tools/registry'
import { useAuth } from '../hooks/useAuth'

function Recent() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data: chats = [] } = useQuery({
    queryKey: ['chats'],
    queryFn: getAllChats,
    enabled: !!user,
  })

  return (
    <main className="px-4 py-6">
      <button type="button" onClick={() => navigate(-1)} aria-label="Back" className="text-slate-900">
        <ChevronLeft className="h-6 w-6" strokeWidth={1.75} />
      </button>

      <h1 className="mt-4 font-display text-2xl font-semibold text-slate-900">Recent</h1>

      {chats.length === 0 ? (
        <p className="mt-2 text-slate-600">Your recently used tools will show up here.</p>
      ) : (
        <div className="mt-6 space-y-2">
          {chats.map((chat) => {
            const tool = getTool(chat.toolSlug)
            return (
              <Link
                key={chat.id}
                to={`/tools/${chat.toolSlug}/chats/${chat.id}`}
                className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4"
              >
                <span className="text-2xl">{tool?.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {tool?.name ?? chat.toolSlug}
                  </p>
                  <p className="mt-1 truncate text-sm font-semibold text-slate-900">{chat.title}</p>
                  {chat.lastMessagePreview && (
                    <p className="mt-1 truncate text-sm text-slate-500">{chat.lastMessagePreview}</p>
                  )}
                </div>
                <span className="flex-shrink-0 text-xs text-slate-400">
                  {new Date(chat.updatedAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </Link>
            )
          })}
        </div>
      )}
    </main>
  )
}

export default Recent
