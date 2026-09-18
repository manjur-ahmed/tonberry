import { useMutation } from '@tanstack/react-query'
import { createContactMessage } from '../../lib/api'

function ContactSlide() {
  const mutation = useMutation({ mutationFn: createContactMessage })

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    mutation.mutate({
      name: String(form.get('name') ?? ''),
      email: String(form.get('email') ?? ''),
      message: String(form.get('message') ?? ''),
    })
  }

  return (
    <section className="flex h-full w-full items-center justify-center bg-[#f7f5f2] px-6">
      <div className="w-full max-w-md">
        <h2 className="text-center text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
          Get in touch
        </h2>
        <p className="mt-3 text-center text-slate-600">
          Questions, feedback, or just want to say hello — drop us a message.
        </p>

        {mutation.isSuccess ? (
          <div className="mt-8 rounded-xl border border-green-200 bg-green-50 p-6 text-center">
            <h3 className="font-semibold text-green-800">Thanks — we've got it.</h3>
            <p className="mt-2 text-sm text-green-700">We'll get back to you shortly.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div>
              <label htmlFor="contact-name" className="block text-sm font-medium text-slate-700">
                Name
              </label>
              <input
                id="contact-name"
                name="name"
                type="text"
                required
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-[#7e14ff] focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="contact-email" className="block text-sm font-medium text-slate-700">
                Email
              </label>
              <input
                id="contact-email"
                name="email"
                type="email"
                required
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-[#7e14ff] focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="contact-message" className="block text-sm font-medium text-slate-700">
                Message
              </label>
              <textarea
                id="contact-message"
                name="message"
                rows={4}
                required
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-[#7e14ff] focus:outline-none"
              />
            </div>

            {mutation.isError && <p className="text-sm text-red-600">{mutation.error.message}</p>}

            <button
              type="submit"
              disabled={mutation.isPending}
              className="w-full rounded-md bg-[#7e14ff] py-2.5 text-sm font-semibold text-white hover:bg-[#6a0fe0] disabled:opacity-50"
            >
              {mutation.isPending ? 'Sending...' : 'Send message'}
            </button>
          </form>
        )}
      </div>
    </section>
  )
}

export default ContactSlide
