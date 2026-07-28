import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createGroupSchema } from '../types'
import type { CreateGroupFormValues } from '../types'
import { useCreateGroup } from '../hooks/useCreateGroup'

export default function CreateGroupForm() {
  const [steamIdInput, setSteamIdInput] = useState('')
  const { mutate: createGroup, isPending } = useCreateGroup()

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
    setValue('memberSteamIds', [...memberSteamIds, trimmed])
    setSteamIdInput('')
  }

  const removeMember = (steamId: string) => {
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
          <Button type="button" className="cursor-pointer" variant="outline" size="icon" onClick={addMember}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          {memberSteamIds.map((id) => (
            <div
              key={id}
              className="flex items-center gap-1 bg-muted text-muted-foreground text-sm px-2 py-1 rounded-md"
            >
              <span>{id}</span>
              <button type="button" className="cursor-pointer hover:text-foreground" onClick={() => removeMember(id)}>
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