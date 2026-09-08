// Compact form for a large play count (e.g. 850000000 -> "850M") — a raw
// number that size reads as noise, not a stat, at card scale.
export function formatPlays(count: number): string {
  if (count >= 1_000_000_000) return `${(count / 1_000_000_000).toFixed(1)}B`
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`
  return `${count}`
}
