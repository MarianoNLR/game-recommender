import { z } from 'zod'

export const createGroupSchema = z.object({
  name: z.string().min(3, 'El nombre debe tener al menos 3 caracteres').max(50),
  budget: z.coerce.number().positive('El presupuesto debe ser positivo').optional(),
  memberSteamIds: z
    .array(z.string().min(1))
    .min(1, 'Agregá al menos un miembro')
    .max(12, 'Máximo 12 miembros'),
})

export type CreateGroupFormValues = z.infer<typeof createGroupSchema>