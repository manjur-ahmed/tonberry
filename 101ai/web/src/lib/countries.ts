export type CurrencySymbol = '$' | '£' | '€'

export interface Country {
  code: string
  name: string
  flag: string
  currency: CurrencySymbol
}

// Curated shortlist — not exhaustive. Extend as needed once real billing
// requires more precise per-country currency handling.
export const countries: Country[] = [
  { code: 'US', name: 'United States', flag: '🇺🇸', currency: '$' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧', currency: '£' },
  { code: 'IE', name: 'Ireland', flag: '🇮🇪', currency: '€' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪', currency: '€' },
  { code: 'FR', name: 'France', flag: '🇫🇷', currency: '€' },
  { code: 'ES', name: 'Spain', flag: '🇪🇸', currency: '€' },
  { code: 'IT', name: 'Italy', flag: '🇮🇹', currency: '€' },
  { code: 'NL', name: 'Netherlands', flag: '🇳🇱', currency: '€' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦', currency: '$' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺', currency: '$' },
  { code: 'IN', name: 'India', flag: '🇮🇳', currency: '$' },
]

export function getCountry(code: string | null): Country | undefined {
  return countries.find((country) => country.code === code)
}

export function getCurrencySymbol(code: string | null): CurrencySymbol {
  return getCountry(code)?.currency ?? '$'
}
