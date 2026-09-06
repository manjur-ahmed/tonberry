export interface Plan {
  id: 'free' | 'plus' | 'premium'
  name: string
  amount: number
  dailyChats: number
  popular?: boolean
  features: string[]
}

export const plans: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    amount: 0,
    dailyChats: 5,
    features: [
      '5 chats per day',
      '100 credits per chat',
      '1 media per chat',
      '5 items per tool',
      'Chat history expires after 7 days',
      'No memory',
    ],
  },
  {
    id: 'plus',
    name: 'Plus',
    amount: 5,
    dailyChats: 25,
    popular: true,
    features: [
      '25 chats per day',
      '1000 credits per chat',
      '10 media per chat',
      'Unlimited items per tool',
      'Chat history never expires',
      'Memory',
    ],
  },
  {
    id: 'premium',
    name: 'Premium',
    amount: 20,
    dailyChats: 100,
    features: [
      '100 chats per day',
      '5000 credits per chat',
      'Unlimited media per chat',
      'Unlimited items per tool',
      'Chat history never expires',
      'Memory',
    ],
  },
]

export function getPlan(id: string | null | undefined): Plan | undefined {
  return plans.find((plan) => plan.id === id)
}
