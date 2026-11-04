import { useQuery } from '@tanstack/react-query'
import { getGroupProfile } from '@/lib/api'

export function useGroupProfile(accessCode: string) {
  return useQuery({
    queryKey: ['group-profile', accessCode],
    queryFn: () => getGroupProfile(accessCode),
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 30,
  })
}
