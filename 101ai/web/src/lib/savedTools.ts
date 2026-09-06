const KEY = '101ai_saved_tools'

function read(): string[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

function write(slugs: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(slugs))
  } catch {
    // Storage unavailable (private mode, quota, etc.) — saved state just won't persist.
  }
}

export function getSavedSlugs(): string[] {
  return read()
}

export function isToolSaved(slug: string): boolean {
  return read().includes(slug)
}

export function toggleSavedTool(slug: string): boolean {
  const current = read()
  const isSaved = current.includes(slug)
  write(isSaved ? current.filter((saved) => saved !== slug) : [...current, slug])
  return !isSaved
}
