export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// A save that resolves in 20ms still shows its spinner for this long —
// otherwise a fast/local response flashes past too quickly to read, and it
// looks broken next to a slower one (e.g. real network latency) that
// visibly spins. Applies whether the promise resolves or rejects.
export const MIN_SAVE_SPINNER_MS = 1000

export async function withMinDuration<T>(promise: Promise<T>, ms: number): Promise<T> {
  const start = Date.now()
  try {
    return await promise
  } finally {
    const remaining = ms - (Date.now() - start)
    if (remaining > 0) await delay(remaining)
  }
}
