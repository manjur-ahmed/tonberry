import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../hooks/useAuth'
import {
  createRecurringCost,
  deleteRecurringCost,
  getRecurringCosts,
  updateRecurringCost,
  type BillingCycle,
  type RecurringCost,
  type RecurringCostInput,
} from '../lib/api'
import ConfirmDialog from '../components/ConfirmDialog'

const CYCLE_LABELS: Record<BillingCycle, string> = {
  monthly: 'Monthly',
  yearly: 'Yearly',
  one_time: 'One-time',
}

const EMPTY_FORM: RecurringCostInput = {
  name: '',
  category: '',
  amountUsd: 0,
  billingCycle: 'monthly',
  renewsAt: '',
  notes: '',
}

function formatUsd(value: number) {
  return `$${value.toFixed(2)}`
}

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

// Highlights a renewal that's imminent/overdue — the whole point of
// tracking this at all is catching one before it lapses unnoticed.
function renewalUrgency(renewsAt: string | null): 'overdue' | 'soon' | null {
  if (!renewsAt) return null
  const days = (new Date(renewsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  if (days < 0) return 'overdue'
  if (days <= 14) return 'soon'
  return null
}

// Deliberately admin-only, unlinked from nav — reach it by URL (see
// AdminUsage's identical pattern/comment). The email check that actually
// matters lives entirely server-side (AdminGuard); a 403 here just means
// "not authorized", nothing on this page grants access on its own.
function AdminCosts() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user, isLoading } = useAuth()
  const [form, setForm] = useState<RecurringCostInput>(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)

  useEffect(() => {
    if (!isLoading && !user) navigate('/sign-in', { replace: true })
  }, [user, isLoading, navigate])

  const { data, isLoading: isCostsLoading, error } = useQuery({
    queryKey: ['recurring-costs'],
    queryFn: getRecurringCosts,
    enabled: !!user,
  })

  function resetForm() {
    setForm(EMPTY_FORM)
    setEditingId(null)
    setIsFormOpen(false)
  }

  const createMutation = useMutation({
    mutationFn: createRecurringCost,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-costs'] })
      resetForm()
    },
  })

  const updateMutation = useMutation({
    mutationFn: (input: RecurringCostInput) => updateRecurringCost(editingId as string, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-costs'] })
      resetForm()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteRecurringCost,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-costs'] })
      setPendingDeleteId(null)
    },
  })

  const isSaving = createMutation.isPending || updateMutation.isPending

  function startEdit(cost: RecurringCost) {
    setForm({
      name: cost.name,
      category: cost.category ?? '',
      amountUsd: Number(cost.amountUsd),
      billingCycle: cost.billingCycle,
      renewsAt: cost.renewsAt ?? '',
      notes: cost.notes ?? '',
    })
    setEditingId(cost.id)
    setIsFormOpen(true)
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const input: RecurringCostInput = {
      name: form.name.trim(),
      category: form.category?.trim() || null,
      amountUsd: form.amountUsd,
      billingCycle: form.billingCycle,
      renewsAt: form.renewsAt || null,
      notes: form.notes?.trim() || null,
    }
    if (editingId) {
      updateMutation.mutate(input)
    } else {
      createMutation.mutate(input)
    }
  }

  if (!user) return null

  const isForbidden = error instanceof Error && error.message.includes('403')

  return (
    <main className="flex flex-col gap-6 p-4 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-extrabold text-slate-900">Recurring costs</h1>
        <button
          type="button"
          onClick={() => (isFormOpen ? resetForm() : setIsFormOpen(true))}
          className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
        >
          {isFormOpen ? 'Cancel' : '+ Add cost'}
        </button>
      </div>

      {isForbidden && <p className="text-slate-600">Not authorized — this page is restricted.</p>}
      {!isForbidden && error && <p className="text-red-600">Something went wrong: {(error as Error).message}</p>}
      {isCostsLoading && <p className="text-slate-500">Loading…</p>}

      {data && (
        <div className="rounded-2xl border-2 border-slate-900 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Monthly total</p>
          <p className="mt-1 font-display text-2xl font-semibold text-slate-900">
            {formatUsd(data.monthlyTotalUsd)}
            <span className="ml-1 text-base font-medium text-slate-500">/mo</span>
          </p>
          <p className="mt-0.5 text-xs text-slate-500">Yearly costs normalized to a monthly figure; one-time costs excluded.</p>
        </div>
      )}

      {isFormOpen && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-2xl border-2 border-slate-900 bg-white p-4">
          <h2 className="font-display text-lg font-semibold text-slate-900">
            {editingId ? 'Edit cost' : 'Add a cost'}
          </h2>

          <input
            type="text"
            required
            placeholder="Name (e.g. tonberry.co.uk domain)"
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300"
          />

          <input
            type="text"
            placeholder="Category (e.g. Domain, Hosting, API, Tooling)"
            value={form.category ?? ''}
            onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300"
          />

          <div className="flex gap-3">
            <input
              type="number"
              step="0.01"
              min="0"
              required
              placeholder="Amount (USD)"
              value={form.amountUsd || ''}
              onChange={(event) =>
                setForm((current) => ({ ...current, amountUsd: Number(event.target.value) }))
              }
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
            <select
              value={form.billingCycle}
              onChange={(event) =>
                setForm((current) => ({ ...current, billingCycle: event.target.value as BillingCycle }))
              }
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300"
            >
              {Object.entries(CYCLE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Next renewal (leave blank for a one-time cost already paid)
          </label>
          <input
            type="date"
            value={form.renewsAt ?? ''}
            onChange={(event) => setForm((current) => ({ ...current, renewsAt: event.target.value }))}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300"
          />

          <textarea
            placeholder="Notes (optional)"
            value={form.notes ?? ''}
            onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
            rows={2}
            className="resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300"
          />

          {(createMutation.isError || updateMutation.isError) && (
            <p className="text-sm text-red-600">Something went wrong — try again.</p>
          )}

          <button
            type="submit"
            disabled={isSaving}
            className="rounded-full bg-slate-900 py-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isSaving ? 'Saving…' : editingId ? 'Save changes' : 'Add cost'}
          </button>
        </form>
      )}

      {data && data.costs.length === 0 && !isFormOpen && (
        <p className="text-slate-500">Nothing tracked yet — add the first one above.</p>
      )}

      {data && data.costs.length > 0 && (
        <div className="flex flex-col gap-3">
          {data.costs.map((cost) => {
            const urgency = renewalUrgency(cost.renewsAt)
            return (
              <div key={cost.id} className="rounded-2xl border-2 border-slate-900 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-base font-semibold text-slate-900">{cost.name}</p>
                    {cost.category && <p className="text-xs text-slate-500">{cost.category}</p>}
                  </div>
                  <p className="whitespace-nowrap font-display text-base font-semibold text-slate-900">
                    {formatUsd(Number(cost.amountUsd))}
                    <span className="ml-1 text-xs font-medium text-slate-500">
                      {cost.billingCycle === 'one_time' ? '' : `/${cost.billingCycle === 'monthly' ? 'mo' : 'yr'}`}
                    </span>
                  </p>
                </div>

                <div className="mt-2 flex items-center gap-2 text-xs">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600">
                    {CYCLE_LABELS[cost.billingCycle]}
                  </span>
                  {cost.renewsAt && (
                    <span
                      className={`rounded-full px-2 py-0.5 font-medium ${
                        urgency === 'overdue'
                          ? 'bg-red-100 text-red-700'
                          : urgency === 'soon'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      Renews {formatDate(cost.renewsAt)}
                    </span>
                  )}
                </div>

                {cost.notes && <p className="mt-2 whitespace-pre-line text-sm text-slate-600">{cost.notes}</p>}

                <div className="mt-3 flex gap-2 text-sm font-semibold">
                  <button type="button" onClick={() => startEdit(cost)} className="text-slate-900 underline">
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingDeleteId(cost.id)}
                    className="text-red-600 underline"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <ConfirmDialog
        open={pendingDeleteId !== null}
        title="Delete this cost?"
        description="This removes it from the tracked list — it doesn't cancel the actual subscription anywhere."
        confirmLabel="Delete"
        onConfirm={() => pendingDeleteId && deleteMutation.mutate(pendingDeleteId)}
        onCancel={() => setPendingDeleteId(null)}
      />
    </main>
  )
}

export default AdminCosts
