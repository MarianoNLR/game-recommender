import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createGroupSchema } from '../types'
import type { CreateGroupFormValues, GroupMember } from '../types'
import { useCreateGroup } from '../hooks/useCreateGroup'
import { useValidateMember } from '../hooks/useValidatemember'

export default function CreateGroupForm() {
  const [steamIdInput, setSteamIdInput] = useState('')
  const { mutate: validate, isPending: isValidating } = useValidateMember()
  const { mutate: createGroup, isPending } = useCreateGroup()
  const [members, setMembers] = useState<GroupMember[]>([])
  const [steamIdError, setSteamIdError] = useState('')

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateGroupFormValues>({
    resolver: zodResolver(createGroupSchema),
    defaultValues: {
      name: '',
      budget: undefined,
      memberSteamIds: [],
    },
  })

  const memberSteamIds = watch('memberSteamIds')

  const addMember = () => {
    const trimmed = steamIdInput.trim()
    if (!trimmed) return
    if (memberSteamIds.includes(trimmed)) return
    if (memberSteamIds.length >= 12) return
    validate(trimmed, {
    onSuccess: (data) => {
      if (!data.isValid) {
        setSteamIdError(data.reason)
        return
      }
      const newMember: GroupMember = {
        steamId: data.steamId,
        name: data.name,
        avatarUrl: data.avatarUrl,
      }
      setMembers([...members, newMember])
      setValue('memberSteamIds', [...memberSteamIds, trimmed])
      setSteamIdInput('')
      setSteamIdError('')
    },
    onError: () => {
      setSteamIdError('Error al validar el SteamID')
    },
  })
  }

  const removeMember = (steamId: string) => {
    setMembers((prev) => prev.filter((m) => m.steamId !== steamId))
    setValue('memberSteamIds', memberSteamIds.filter((id) => id !== steamId))
  }

  const onSubmit = (values: CreateGroupFormValues) => {
    createGroup({
      ...values,
      budget: values.budget ? Number(values.budget) : undefined,
    })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 w-full max-w-md">
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Nombre del grupo</label>
        <Input placeholder="Los pibes" {...register('name')} />
        {errors.name && <p className="text-destructive text-sm">{errors.name.message}</p>}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Presupuesto (opcional)</label>
        <Input type="number" placeholder="15" {...register('budget')} />
        {errors.budget && <p className="text-destructive text-sm">{errors.budget.message}</p>}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Miembros</label>
        <div className="flex gap-2">
          <Input
            placeholder="SteamID"
            value={steamIdInput}
            onChange={(e) => setSteamIdInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addMember()
              }
            }}
          />
          <Button type="button" className="cursor-pointer" variant="outline" size="icon" onClick={addMember} disabled={isValidating}>
            {isValidating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </Button>
        </div>
        {steamIdError && <p className="text-destructive text-sm">{steamIdError}</p>}
        <div className="flex flex-wrap gap-2 mt-2">
          {members.map((member) => (
            <div
              key={member.steamId}
              className="flex items-center gap-2 bg-muted text-muted-foreground text-sm px-2 py-1 rounded-md"
            >
              <img
                src={member.avatarUrl}
                alt={member.name}
                className="w-5 h-5 rounded-full"
              />
              <span>{member.name}</span>
              <button
                type="button"
                onClick={() => removeMember(member.steamId)}
                className="hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
        {errors.memberSteamIds && (
          <p className="text-destructive text-sm">{errors.memberSteamIds.message}</p>
        )}
      </div>

      <Button type="submit" className="w-full cursor-pointer" disabled={isPending}>
        {isPending ? 'Creando...' : 'Crear grupo'}
      </Button>
    </form>
  )
}