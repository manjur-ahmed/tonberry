import { useEffect, useState } from 'react'

// Height (px) of whatever's currently covering the bottom of the screen —
// in practice, the on-screen keyboard. iOS Safari shrinks the *visual*
// viewport when the keyboard opens but not the layout viewport, so
// anything sized or positioned with vh/dvh, `fixed`, or `sticky` keeps
// measuring against the full (keyboard-covered) height and ends up
// rendered underneath the keyboard. This tracks the gap so bottom-pinned
// UI (a compose bar's send button, say) can offset itself above it. 0 when
// nothing is covering it, or when the VisualViewport API isn't available.
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0)

  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return

    function update() {
      const covered = window.innerHeight - viewport!.height - viewport!.offsetTop
      setInset(Math.max(0, Math.round(covered)))
    }

    update()
    viewport.addEventListener('resize', update)
    viewport.addEventListener('scroll', update)
    return () => {
      viewport.removeEventListener('resize', update)
      viewport.removeEventListener('scroll', update)
    }
  }, [])

  return inset
}
