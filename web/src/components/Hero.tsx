import { useMutation } from '@tanstack/react-query'
import { createLead } from '../lib/api'

function Hero() {
  const mutation = useMutation({ mutationFn: createLead })

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    mutation.mutate({
      name: String(form.get('name') ?? ''),
      email: String(form.get('email') ?? ''),
      propertyType: String(form.get('propertyType') ?? ''),
      loanAmount: String(form.get('loanAmount') ?? '') || undefined,
    })
  }

  return (
    <section className="mx-auto grid max-w-6xl gap-12 px-6 py-20 md:grid-cols-2 md:items-center">
      <div>
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
          Get your commercial property deal in front of the right broker
        </h1>
        <p className="mt-4 text-lg text-slate-600">
          Tell us about your deal and we'll connect you with a finance broker
          who specialises in it.
        </p>
      </div>

      {mutation.isSuccess ? (
        <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center">
          <h2 className="font-semibold text-green-800">Thanks — we've got it.</h2>
          <p className="mt-2 text-sm text-green-700">
            A broker will be in touch about your deal shortly.
          </p>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-slate-700">
              Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="propertyType" className="block text-sm font-medium text-slate-700">
              Property type
            </label>
            <select
              id="propertyType"
              name="propertyType"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            >
              <option>Office</option>
              <option>Retail</option>
              <option>Industrial</option>
              <option>Mixed use</option>
              <option>Other</option>
            </select>
          </div>

          <div>
            <label htmlFor="loanAmount" className="block text-sm font-medium text-slate-700">
              Loan amount (£)
            </label>
            <input
              id="loanAmount"
              name="loanAmount"
              type="number"
              min="0"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </div>

          {mutation.isError && (
            <p className="text-sm text-red-600">{mutation.error.message}</p>
          )}

          <button
            type="submit"
            disabled={mutation.isPending}
            className="w-full rounded-md bg-slate-900 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {mutation.isPending ? 'Submitting...' : 'Get matched with a broker'}
          </button>
        </form>
      )}
    </section>
  )
}

export default Hero
