import { Link } from 'react-router-dom'

const teasers = [
  {
    title: 'How commercial mortgages differ from residential',
    blurb: 'The basics of rates, terms and lender expectations.',
  },
  {
    title: 'What brokers look for in a deal',
    blurb: 'Get your numbers in order before you apply.',
  },
  {
    title: 'Bridging vs. term finance',
    blurb: 'Choosing the right structure for your timeline.',
  },
]

function GuidesTeaser() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-slate-900">Guides</h2>
        <Link to="/guides" className="text-sm font-medium text-slate-600 hover:text-slate-900">
          View all guides →
        </Link>
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-3">
        {teasers.map((teaser) => (
          <div
            key={teaser.title}
            className="rounded-lg border border-slate-200 p-5 hover:border-slate-300"
          >
            <h3 className="font-semibold text-slate-900">{teaser.title}</h3>
            <p className="mt-2 text-sm text-slate-600">{teaser.blurb}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

export default GuidesTeaser
