function ToolPromoSlide() {
  return (
    <section className="flex h-full w-full flex-col overflow-hidden bg-[#f9f9f9] md:flex-row">
      <div className="flex flex-1 flex-col items-center justify-center px-6 pt-12 text-center md:items-start md:px-12 md:text-left">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#7e14ff]">
          From the tonberry studio
        </span>
        <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 md:text-5xl">
          101 AI Tools
        </h2>
        <p className="mt-6 text-base text-slate-600 md:text-lg">
          A growing catalog of everyday AI tools — each one gets its own
          purpose-built interface, not just another chat box. Where accuracy
          matters, the AI is backed by a real data integration, not just a
          model guessing.
        </p>
        <a
          href="https://101ai.tonberry.co.uk"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#7e14ff] px-7 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#6a0fe0]"
        >
          Visit 101ai.tonberry.co.uk
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M7 17L17 7M7 7h10v10" />
          </svg>
        </a>
      </div>

      <div className="flex flex-1 items-end justify-center md:justify-end md:pr-10">
        <img
          src="/101ai-app-mock.png"
          alt="101 AI Tools app screenshot on an iPhone"
          className="h-[42%] w-auto object-contain md:h-[90%]"
        />
      </div>
    </section>
  )
}

export default ToolPromoSlide
