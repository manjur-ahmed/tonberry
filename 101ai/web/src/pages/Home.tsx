import ToolCard from '../components/ToolCard'
import { tools } from '../tools/registry'

function Home() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-16">
      <h1 className="text-4xl font-bold tracking-tight text-slate-900">
        Everyday AI tools, one place
      </h1>
      <p className="mt-3 text-lg text-slate-600">
        Pick a tool below to get started.
      </p>

      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {tools.map((tool) => (
          <ToolCard key={tool.slug} tool={tool} />
        ))}
      </div>
    </main>
  )
}

export default Home
