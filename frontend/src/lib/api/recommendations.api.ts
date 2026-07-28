import { BASE_URL } from '@/lib/config'

export async function getRecommendations(accessCode: string) {
  const response = await fetch(`${BASE_URL}/recommendations/${accessCode}`)

  if (!response.ok) throw new Error('Error al obtener recomendaciones')

  return response.json()
}