/* eslint-disable @typescript-eslint/no-explicit-any */
import { useParams } from "react-router-dom";
import { useRecommendations } from "../hooks/useRecommendations";
import RecommendationGrid from "./RecommendationGrid";
import { UserAvatar } from "@/components/UserAvatar";

export default function RecommendationsPage() {
  const { accessCode } = useParams<{ accessCode: string }>();
  const { data, isLoading, isError, error, refetch } = useRecommendations(accessCode!);

  const formatUsd = (cents: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100);

  if (isError) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-destructive text-lg font-medium">
            {error?.message ?? 'Error al obtener recomendaciones'}
          </p>
          <button type="button" onClick={() => void refetch()} className="block mx-auto text-sm underline">
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
    <main className="min-h-screen bg-background px-4 py-12 max-w-4xl mx-auto">
      {isLoading ? (
        <div className="space-y-8">
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

          <div className="space-y-2 text-center">
            <p className="text-foreground text-xl font-medium">
              Analizando los juegos del grupo...
            </p>

            <p className="text-muted-foreground text-sm">
              Esto puede tardar hasta un minuto
            </p>
          </div>

          {/* Juegos */}
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
          <br />
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
        </div>
      ) : (
        <div className="space-y-8">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold text-foreground">
              {data.group.name}
            </h1>
            <div className="flex flex-col items-start gap-4 text-muted-foreground text-sm">
              {/* <span>Código: <span className="text-foreground font-mono">{data.group.accessCode}</span></span> */}
              {data.group.budget != null && (
                <span className="font-medium">
                  Presupuesto por miembro: {formatUsd(data.group.budget)}
                </span>
              )}
              {data.group.members.length > 0 && (
                <div className="flex flex-col gap-2">
                  <span className="font-medium">
                    Miembros: {data.group.members.length}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {data.group.members.map((member: any) => (
                      <div
                        key={member.steamId}
                        className="flex items-center gap-2 bg-muted text-muted-foreground text-sm px-2 py-1 rounded-md"
                      >
                        <UserAvatar
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
          <RecommendationGrid
            games={data?.groupRecommendations.paidRecommendations ?? []}
          />
          <div className="space-y-2">
            <p className="text-muted-foreground text-sm">
              Recomendaciones gratuitas
            </p>
          </div>
          <RecommendationGrid
            games={data?.groupRecommendations.freeRecommendations ?? []}
          />
        </div>
      )}
    </main>
  );
}
