import { useParams } from "react-router-dom";
import { useRecommendations } from "../hooks/useRecommendations";
import { useGroupProfile } from "../hooks/useGroupProfile";
import RecommendationGrid from "./RecommendationGrid";
import GroupProfileSection from "./GroupProfileSection";

const formatUsd = (cents: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);

function ProfileSkeleton() {
  return (
    <div className="space-y-4">
      {/* Nombre del grupo */}
      <div className="h-9 w-72 rounded-md bg-muted animate-pulse" />

      {/* Presupuesto + miembros */}
      <div className="flex flex-wrap gap-4">
        <div className="h-5 w-56 rounded-md bg-muted animate-pulse" />
        <div className="h-5 w-28 rounded-md bg-muted animate-pulse" />
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="h-6 rounded-md bg-muted animate-pulse"
            style={{
              width: `${60 + (i % 4) * 20}px`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function GameCardsSkeleton() {
  return (
    <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="bg-card overflow-hidden rounded-lg">
          <div className="w-full bg-muted animate-pulse" />

          <div className="space-y-3 p-4">
            <div className="h-5 w-3/4 rounded bg-muted animate-pulse" />

            <div className="space-y-2">
              <div className="h-4 w-full rounded bg-muted animate-pulse" />
              <div className="h-4 w-2/3 rounded bg-muted animate-pulse" />
            </div>

            <div className="flex justify-between">
              <div className="h-4 w-16 rounded bg-muted animate-pulse" />
              <div className="h-4 w-24 rounded bg-muted animate-pulse" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function RecommendationsPage() {
  const { accessCode } = useParams<{ accessCode: string }>();
  const profile = useGroupProfile(accessCode!);
  const recommendations = useRecommendations(accessCode!);

  // Sin perfil no hay nada que mostrar (grupo inexistente, vencido, etc.).
  if (profile.isError) {
    return (
      <main className="min-h-[calc(100svh-3.5rem)] bg-background flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-destructive text-lg font-medium">
            {profile.error.message ?? 'Error al obtener el perfil del grupo'}
          </p>
          <button type="button" onClick={() => void profile.refetch()} className="block mx-auto text-sm underline">
            Reintentar
          </button>
          <a href="/" className="text-muted-foreground text-sm underline">
            Volver al inicio
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100svh-3.5rem)] bg-background px-4 py-12 max-w-4xl mx-auto">
      {profile.data ? (
        <div className="space-y-8">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold text-foreground">
              {profile.data.group.name}
            </h1>
            {profile.data.group.budget != null && (
              <p className="text-muted-foreground text-sm font-medium">
                Presupuesto por miembro: {formatUsd(profile.data.group.budget)}
              </p>
            )}
          </div>

          <GroupProfileSection profile={profile.data} />
        </div>
      ) : (
        <ProfileSkeleton />
      )}

      <div className="mt-8 space-y-8">
        {recommendations.isLoading ? (
          <>
            <div className="space-y-2 text-center">
              <p className="text-foreground text-xl font-medium">
                Analizando los juegos del grupo...
              </p>

              <p className="text-muted-foreground text-sm">
                Esto puede tardar hasta un minuto
              </p>
            </div>

            <GameCardsSkeleton />
            <GameCardsSkeleton />
          </>
        ) : recommendations.isError ? (
          <div className="text-center space-y-2">
            <p className="text-destructive text-lg font-medium">
              {recommendations.error.message ?? 'Error al obtener recomendaciones'}
            </p>
            <button type="button" onClick={() => void recommendations.refetch()} className="block mx-auto text-sm underline">
              Reintentar
            </button>
          </div>
        ) : (
          <>
            <RecommendationGrid
              games={recommendations.data?.groupRecommendations.paidRecommendations ?? []}
              groupTags={profile.data?.topGroupTags}
            />
            <div className="space-y-2">
              <p className="text-muted-foreground text-sm">
                Recomendaciones gratuitas
              </p>
            </div>
            <RecommendationGrid
              games={recommendations.data?.groupRecommendations.freeRecommendations ?? []}
              groupTags={profile.data?.topGroupTags}
            />
          </>
        )}
      </div>
    </main>
  );
}
