import { BASE_URL } from '@/lib/config'
import { responseError } from './response-error'

export async function getRecommendations(accessCode: string) {
  const response = await fetch(`${BASE_URL}/recommendations/${accessCode}`)

  if (!response.ok) throw await responseError(response, 'Error al obtener recomendaciones. Volvé a intentar.')

  return response.json()
}
