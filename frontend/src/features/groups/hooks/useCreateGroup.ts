import { useMutation } from '@tanstack/react-query'
import { createGroup } from '@/lib/api'
import { useNavigate } from 'react-router-dom'

export function useCreateGroup() {
  const navigate = useNavigate()

  return useMutation({
    mutationFn: createGroup,
    onSuccess: (data) => {
      navigate(`/recommendations/${data.accessCode}`)
    },
  })
}