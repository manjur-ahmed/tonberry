import { techLogos } from '../../data/techLogos'

const FORCE_WHITE = new Set(['OpenAI', 'AWS'])

function StackSlide() {
  return (
    <section className="flex h-full w-full items-center justify-center bg-[#0d0d0f] px-6 py-16">
      <div className="max-w-4xl">
        <h2 className="text-center text-3xl font-semibold tracking-tight text-white md:text-4xl">
          Built with
        </h2>
        <p className="mt-3 text-center text-sm text-white/50">
          Powered by the best-in-class 3rd party tools and services
        </p>

        <div className="mt-10 flex flex-wrap justify-center gap-3">
          {techLogos.map((item) => (
            <div
              key={item.label}
              className="flex w-28 flex-col items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-5"
            >
              <svg viewBox="0 0 24 24" className="h-[60px] w-[60px]">
                {item.paths ? (
                  item.paths.map((p) => <path key={p.d} d={p.d} fill={p.fill} />)
                ) : (
                  <path d={item.path} fill={FORCE_WHITE.has(item.label) ? '#ffffff' : `#${item.hex}`} />
                )}
              </svg>
              <span className="text-center text-xs leading-tight text-white/70">
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default StackSlide
