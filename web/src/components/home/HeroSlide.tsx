interface Props {
  onNext?: () => void
}

function HeroSlide({ onNext }: Props) {
  return (
    <section className="relative flex h-full w-full items-center justify-center overflow-hidden bg-black">
      <video
        className="absolute inset-0 h-full w-full object-cover"
        src="/hero-bg.mp4"
        autoPlay
        muted
        loop
        playsInline
      />
      <div className="absolute inset-0 bg-black/60" />

      <div className="relative flex flex-col items-center px-6 text-center">
        <h1 className="font-goudy text-5xl tracking-tight text-white md:text-7xl">tonberry</h1>
        <p className="mt-4 max-w-xl text-base text-white/80 md:text-lg">
          Shaping tech and AI to personal experiences
        </p>
      </div>

      <button
        type="button"
        onClick={onNext}
        className="absolute bottom-10 flex flex-col items-center gap-2 text-sm font-medium text-white/80 transition-colors hover:text-white"
      >
        Read more
        <svg
          className="h-5 w-5 animate-bounce"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
    </section>
  )
}

export default HeroSlide
