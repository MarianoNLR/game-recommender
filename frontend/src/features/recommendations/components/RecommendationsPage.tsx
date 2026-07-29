import { useParams } from 'react-router-dom'
import { useRecommendations } from '../hooks/useRecommendations'

export default function RecommendationsPage() {
  const { accessCode } = useParams<{ accessCode: string }>()
  const { data, isLoading, isError } = useRecommendations(accessCode!)

  if (isError) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-destructive text-lg font-medium">Código inválido o grupo expirado</p>
          <a href="/" className="text-muted-foreground text-sm underline">Volver al inicio</a>
        </div>
      </main>
    )
  }

  return (
<main className="min-h-screen bg-background px-4 py-12 max-w-4xl mx-auto">
      {isLoading ? (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <p className="text-foreground text-xl font-medium">Analizando los juegos del grupo...</p>
          <p className="text-muted-foreground text-sm">Esto puede tardar hasta un minuto</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full mt-8">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-card rounded-lg h-48 animate-pulse" />
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          <h1 className="text-3xl font-bold text-foreground">Recomendaciones</h1>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data?.groupRecommendations?.map((game: any) => (
              <div key={game.appId} className="bg-card rounded-lg overflow-hidden">
                <img src={game.headerImage} alt={game.name} className="w-full object-cover" />
                <div className="p-4 space-y-2">
                  <h2 className="text-foreground font-semibold">{game.name}</h2>
                  <p className="text-muted-foreground text-sm line-clamp-2">{game.shortDescription}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-primary text-sm font-medium">
                      {game.isFree ? 'Gratis' : game.price ?? 'Ver precio'}
                    </span>
                    <a
                      href={game.storeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground text-sm underline hover:text-foreground"
                    >
                      Ver en Steam
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  )
}