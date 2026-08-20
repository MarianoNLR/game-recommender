/* eslint-disable @typescript-eslint/no-explicit-any */
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
          <div className="space-y-1">
            <h1 className="text-3xl font-bold text-foreground">{data.group.name}</h1>
            <div className="flex flex-col items-start gap-4 text-muted-foreground text-sm">
              {/* <span>Código: <span className="text-foreground font-mono">{data.group.accessCode}</span></span> */}
              {data.group.budget && <span className="font-medium">Presupuesto por miembro: USD ${data.group.budget}</span>}
              {data.group.members.length > 0 && (
                <div className="flex flex-col gap-2">
                  <span className="font-medium">Miembros: {data.group.members.length}</span>
                  <div className="flex flex-wrap gap-2">
                    {data.group.members.map((member: any) => (
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
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-muted-foreground text-sm">Gustos del grupo</p>
            <div className="flex flex-wrap gap-2">
              {data.topGroupTags.map((tag: string) => (
                <span
                  key={tag}
                  className="bg-muted text-muted-foreground text-xs px-2 py-1 rounded-md"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data?.groupRecommendations.paidRecommendations?.map((game: any) => (
              <div key={game.appId} className="bg-card rounded-lg overflow-hidden">
                <img src={`https://cdn.akamai.steamstatic.com/steam/apps/${game.appId}/header.jpg`}
                onError={(e) => {
                  e.currentTarget.src = 'https://placehold.co/460x215?text=No+Image';
                }}
   alt={game.name} className="w-full object-cover" />
                <div className="p-4 space-y-2">
                  <h2 className="text-foreground font-semibold">{game.name}</h2>
                  <p className="text-muted-foreground text-sm line-clamp-2">{game.shortDescription}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-primary text-sm font-medium">
                      {game.isFree ? 'Gratis' : game.formattedPrice ?? 'Ver precio'}
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
          <div className="space-y-2">
            <p className="text-muted-foreground text-sm">Recomendaciones gratuitas</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data?.groupRecommendations.freeRecommendations?.map((game: any) => (
              <div key={game.appId} className="bg-card rounded-lg overflow-hidden">
                <img src={`https://cdn.akamai.steamstatic.com/steam/apps/${game.appId}/header.jpg`}
                  onError={(e) => {
                    e.currentTarget.src = 'https://placehold.co/460x215?text=No+Image';
                  }} 
                  alt={game.name} className="w-full object-cover" />
                <div className="p-4 space-y-2">
                  <h2 className="text-foreground font-semibold">{game.name}</h2>
                  <p className="text-muted-foreground text-sm line-clamp-2">{game.shortDescription}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-primary text-sm font-medium">
                      {game.isFree ? 'Gratis' : game.formattedPrice ?? 'Ver precio'}
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