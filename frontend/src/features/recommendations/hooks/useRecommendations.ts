import { useQuery } from '@tanstack/react-query'
import { getRecommendations } from '@/lib/api'

export function useRecommendations(accessCode: string) {
  return useQuery({
    queryKey: ['recommendations', accessCode],
    queryFn: () => getRecommendations(accessCode),
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 30,
  })
}