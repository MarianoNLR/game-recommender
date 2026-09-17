import { BASE_URL } from '@/lib/config'
import { responseError } from './response-error'

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

  if (!response.ok) throw await responseError(response, 'Error al crear el grupo. Volvé a intentar.')

  return response.json()
}

export async function validateMember(steamId: string) {
  const response = await fetch(`${BASE_URL}/steam/validate-member/${steamId}`)
  if (!response.ok) throw new Error('Error al validar el miembro')
  return response.json()
}
