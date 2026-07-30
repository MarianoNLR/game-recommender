import { useMutation } from '@tanstack/react-query'
import { validateMember } from '@/lib/api'

export function useValidateMember() {
  return useMutation({
    mutationFn: validateMember,
  })
}