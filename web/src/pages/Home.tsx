import { useEffect, useRef, useState } from 'react'
import HeroSlide from '../components/home/HeroSlide'
import ToolPromoSlide from '../components/home/ToolPromoSlide'
import StackSlide from '../components/home/StackSlide'
import ContactSlide from '../components/home/ContactSlide'

const slideLabels = ['Home', '101 AI Tools', 'Stack', 'Contact']

function Home() {
  const containerRef = useRef<HTMLDivElement>(null)
  const sectionRefs = useRef<(HTMLDivElement | null)[]>([])
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const index = sectionRefs.current.findIndex((el) => el === entry.target)
            if (index !== -1) setActiveIndex(index)
          }
        }
      },
      { root: container, threshold: 0.6 },
    )

    for (const el of sectionRefs.current) {
      if (el) observer.observe(el)
    }

    return () => observer.disconnect()
  }, [])

  function scrollToSlide(index: number) {
    sectionRefs.current[index]?.scrollIntoView({ behavior: 'smooth' })
  }

  function setSectionRef(index: number) {
    return (el: HTMLDivElement | null) => {
      sectionRefs.current[index] = el
    }
  }

  return (
    <div
      ref={containerRef}
      className="h-svh snap-y snap-mandatory overflow-y-scroll scroll-smooth"
    >
      <div ref={setSectionRef(0)} className="h-svh snap-start snap-always">
        <HeroSlide onNext={() => scrollToSlide(1)} />
      </div>
      <div ref={setSectionRef(1)} className="h-svh snap-start snap-always">
        <ToolPromoSlide />
      </div>
      <div ref={setSectionRef(2)} className="h-svh snap-start snap-always">
        <StackSlide />
      </div>
      <div ref={setSectionRef(3)} className="h-svh snap-start snap-always">
        <ContactSlide />
      </div>

      <div className="pointer-events-none fixed top-6 left-6 z-40 font-goudy text-base tracking-wide text-white mix-blend-difference">
        tonberry
      </div>

      <nav aria-label="Slide navigation">
        {slideLabels.map((label, index) => (
          <div
            key={label}
            role="button"
            tabIndex={0}
            aria-label={`Go to ${label} slide`}
            onClick={() => scrollToSlide(index)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') scrollToSlide(index)
            }}
            style={{ top: `calc(50% + ${(index - (slideLabels.length - 1) / 2) * 24}px)` }}
            className={`fixed right-5 z-40 cursor-pointer rounded-full bg-white mix-blend-difference transition-all ${
              index === activeIndex ? 'h-2.5 w-2.5 opacity-100' : 'h-1.5 w-1.5 opacity-50'
            }`}
          />
        ))}
      </nav>
    </div>
  )
}

export default Home
