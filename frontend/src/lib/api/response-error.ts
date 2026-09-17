export async function responseError(response: Response, fallback: string): Promise<Error> {
  if (response.status >= 400 && response.status < 500) {
    const body: unknown = await response.json().catch(() => null)
    if (body && typeof body === 'object' && 'message' in body && typeof body.message === 'string') {
      return new Error(body.message)
    }
  }
  return new Error(fallback)
}
