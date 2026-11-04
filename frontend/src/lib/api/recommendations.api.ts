import { BASE_URL } from '@/lib/config'
import { responseError } from './response-error'
import type { GroupProfile } from '@/features/recommendations/types'

export async function getRecommendations(accessCode: string) {
  const response = await fetch(`${BASE_URL}/recommendations/${accessCode}`)

  if (!response.ok) throw await responseError(response, 'Error al obtener recomendaciones. Volvé a intentar.')

  return response.json()
}

export async function getGroupProfile(accessCode: string): Promise<GroupProfile> {
  const response = await fetch(`${BASE_URL}/recommendations/${accessCode}/profile`)

  if (!response.ok) throw await responseError(response, 'Error al obtener el perfil del grupo. Volvé a intentar.')

  return response.json()
}
