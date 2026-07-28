import { BASE_URL } from '@/lib/config'

export async function createGroup(data: {
  name: string
  budget?: number
  memberSteamIds: string[]
}) {
  const response = await fetch(`${BASE_URL}/groups`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

  if (!response.ok) throw new Error('Error al crear el grupo')

  return response.json()
}