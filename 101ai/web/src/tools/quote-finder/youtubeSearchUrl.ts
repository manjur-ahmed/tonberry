// Deliberately a *search* URL built from the model's verified text fields,
// never a direct link the model generated itself — a model-produced URL is
// exactly the kind of thing that gets hallucinated (a plausible-looking but
// dead or wrong link), which would undermine the one thing this tool is
// meant to guarantee: that a quote can actually be checked. Concatenating
// speaker + source + quote into a real, always-resolvable YouTube search is
// safe by construction — worst case it just doesn't surface a perfect
// match, rather than confidently pointing somewhere wrong.
export function buildYoutubeSearchUrl(quote: { text: string; speaker: string | null; source: string }): string {
  const query = [quote.speaker, quote.source, quote.text].filter(Boolean).join(' ')
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`
}
