export interface Plan {
  id: 'basic' | 'plus' | 'premium'
  name: string
  amount: number
  dailyChats: number
  popular?: boolean
  features: string[]
}

// Unlimited items per tool and never-expiring chat history are now every
// plan's baseline (not worth a per-plan bullet), so they're not listed
// here at all — same reasoning for Premium's old "Unlimited media per
// chat" line. Plus's own "10 media per chat" is a distinct, still-real
// differentiator and stays.
export const plans: Plan[] = [
  {
    id: 'basic',
    name: 'Basic',
    amount: 1.99,
    dailyChats: 10,
    features: ['10 chats per day', '1000 credits per chat', 'Memory'],
  },
  {
    id: 'plus',
    name: 'Plus',
    amount: 6.99,
    dailyChats: 25,
    popular: true,
    features: ['25 chats per day', '2500 credits per chat', 'Memory'],
  },
  {
    id: 'premium',
    name: 'Premium',
    amount: 20,
    dailyChats: 100,
    features: ['100 chats per day', '5000 credits per chat', 'Memory'],
  },
]

export function getPlan(id: string | null | undefined): Plan | undefined {
  return plans.find((plan) => plan.id === id)
}
