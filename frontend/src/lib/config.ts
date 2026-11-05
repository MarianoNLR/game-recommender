export const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

// Opcional: si no está definida, no se muestra el botón "Ver ejemplo"
export const EXAMPLE_ACCESS_CODE: string | undefined =
  import.meta.env.VITE_EXAMPLE_ACCESS_CODE || undefined
