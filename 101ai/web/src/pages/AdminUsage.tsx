import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useAuth } from '../hooks/useAuth'
import { getUsageSummary, type UsageRange, type UsageSummary } from '../lib/api'

const RANGES: UsageRange[] = ['7d', '30d', '90d']

const PLAN_LABELS: Record<'free' | 'plus' | 'premium' | 'none', string> = {
  free: 'Free',
  plus: 'Plus',
  premium: 'Premium',
  none: 'No plan',
}

function formatUsd(value: number) {
  return `$${value.toFixed(6)}`
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function SummaryCard({ label, value, sublabel }: { label: string; value: string; sublabel: string }) {
  return (
    <div className="rounded-2xl border-2 border-slate-900 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 font-display text-xl font-semibold text-slate-900">{value}</p>
      <p className="mt-0.5 text-xs text-slate-500">{sublabel}</p>
    </div>
  )
}

function CostByModelTable({ byModel }: { byModel: UsageSummary['byModel'] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border-2 border-slate-900">
      <table className="w-full min-w-max text-sm">
        <thead>
          <tr className="border-b-2 border-slate-900 bg-slate-50 text-left">
            <th className="px-3 py-2 font-semibold text-slate-700">Model</th>
            <th className="px-3 py-2 font-semibold text-slate-700">Total cost</th>
            <th className="px-3 py-2 font-semibold text-slate-700">Tokens</th>
            <th className="px-3 py-2 font-semibold text-slate-700">Requests</th>
          </tr>
        </thead>
        <tbody>
          {byModel.map((row) => (
            <tr key={row.model} className="border-b border-slate-200 last:border-0">
              <td className="px-3 py-2 text-slate-900">{row.model}</td>
              <td className="px-3 py-2 text-slate-900">{formatUsd(row.totalCostUsd)}</td>
              <td className="px-3 py-2 text-slate-600">{row.totalTokens.toLocaleString()}</td>
              <td className="px-3 py-2 text-slate-600">{row.requestCount.toLocaleString()}</td>
            </tr>
          ))}
          {byModel.length === 0 && (
            <tr>
              <td className="px-3 py-4 text-center text-slate-500" colSpan={4}>
                No usage in this range.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function CostByPlanTable({ byPlan }: { byPlan: UsageSummary['byPlan'] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border-2 border-slate-900">
      <table className="w-full min-w-max text-sm">
        <thead>
          <tr className="border-b-2 border-slate-900 bg-slate-50 text-left">
            <th className="px-3 py-2 font-semibold text-slate-700">Plan</th>
            <th className="px-3 py-2 font-semibold text-slate-700">Total cost</th>
            <th className="px-3 py-2 font-semibold text-slate-700">Avg / response</th>
            <th className="px-3 py-2 font-semibold text-slate-700">Requests</th>
            <th className="px-3 py-2 font-semibold text-slate-700">Users</th>
          </tr>
        </thead>
        <tbody>
          {byPlan.map((row) => (
            <tr key={row.plan ?? 'none'} className="border-b border-slate-200 last:border-0">
              <td className="px-3 py-2 font-medium text-slate-900">{PLAN_LABELS[row.plan ?? 'none']}</td>
              <td className="px-3 py-2 text-slate-900">{formatUsd(row.totalCostUsd)}</td>
              <td className="px-3 py-2 text-slate-600">{formatUsd(row.avgCostPerResponseUsd)}</td>
              <td className="px-3 py-2 text-slate-600">{row.requestCount.toLocaleString()}</td>
              <td className="px-3 py-2 text-slate-600">{row.userCount.toLocaleString()}</td>
            </tr>
          ))}
          {byPlan.length === 0 && (
            <tr>
              <td className="px-3 py-4 text-center text-slate-500" colSpan={5}>
                No usage in this range.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

// Deliberately admin-only, unlinked from nav — reach it by URL. The email
// check that actually matters lives entirely server-side (AdminGuard); a
// 403 here just means "not authorized", nothing on this page grants
// access on its own.
function AdminUsage() {
  const navigate = useNavigate()
  const { user, isLoading } = useAuth()
  const [range, setRange] = useState<UsageRange>('30d')

  useEffect(() => {
    if (!isLoading && !user) navigate('/sign-in', { replace: true })
  }, [user, isLoading, navigate])

  const { data, isLoading: isSummaryLoading, error } = useQuery({
    queryKey: ['usage-summary', range],
    queryFn: () => getUsageSummary(range),
    enabled: !!user,
  })

  if (!user) return null

  const isForbidden = error instanceof Error && error.message.includes('403')

  return (
    <main className="flex flex-col gap-6 p-4 pb-24">
      <div>
        <h1 className="font-display text-2xl font-semibold text-slate-900">AI usage report</h1>
        <div className="mt-3 inline-flex rounded-full border-2 border-slate-900 bg-white p-1">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                r === range ? 'bg-slate-900 text-white' : 'text-slate-600'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {isForbidden && <p className="text-slate-600">Not authorized — this page is restricted.</p>}
      {!isForbidden && error && <p className="text-red-600">Something went wrong: {(error as Error).message}</p>}
      {isSummaryLoading && <p className="text-slate-500">Loading…</p>}

      {data && (
        <>
          <div className="grid grid-cols-3 gap-2">
            <SummaryCard
              label="Per response"
              value={formatUsd(data.perResponse.averageCostUsd)}
              sublabel={`n=${data.perResponse.count}`}
            />
            <SummaryCard
              label="Per chat"
              value={formatUsd(data.perChat.averageCostUsd)}
              sublabel={`n=${data.perChat.chatCount}`}
            />
            <SummaryCard
              label="Per user"
              value={formatUsd(data.perUser.averageCostUsd)}
              sublabel={`n=${data.perUser.userCount}`}
            />
          </div>

          <section>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Cost over time
            </h2>
            <div className="h-52 rounded-2xl border-2 border-slate-900 bg-white p-3">
              {data.timeSeries.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-slate-500">
                  No usage in this range.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.timeSeries} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatDate}
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      axisLine={{ stroke: '#cbd5e1' }}
                      tickLine={false}
                      minTickGap={24}
                    />
                    <YAxis
                      tickFormatter={(value: number) => `$${value.toFixed(2)}`}
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      axisLine={false}
                      tickLine={false}
                      width={48}
                    />
                    <Tooltip
                      formatter={(value) => formatUsd(Number(value))}
                      labelFormatter={(label) => formatDate(String(label))}
                    />
                    <Line
                      type="monotone"
                      dataKey="totalCostUsd"
                      stroke="#4f46e5"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </section>

          <section>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Cost by model
            </h2>
            <CostByModelTable byModel={data.byModel} />
          </section>

          <section>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Cost by plan
            </h2>
            <CostByPlanTable byPlan={data.byPlan} />
          </section>
        </>
      )}
    </main>
  )
}

export default AdminUsage
