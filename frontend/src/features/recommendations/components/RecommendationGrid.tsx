"use client";

import { useMemo, useState } from "react";

type RecommendationGame = {
  appId: number;
  name: string;
  shortDescription?: string | null;
  price?: number | null;
  formattedPrice?: string | null;
  isFree?: boolean | null;
  storeUrl?: string;
  imageUrl?: string | null;
};

type RecommendationGridProps = {
  games: RecommendationGame[];
  itemsPerPage?: number;
};

export default function RecommendationGrid({
  games,
  itemsPerPage = 9,
}: RecommendationGridProps) {
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(games.length / itemsPerPage));

  const paginatedGames = useMemo(() => {
    const start = (page - 1) * itemsPerPage;
    const end = start + itemsPerPage;

    return games.slice(start, end);
  }, [games, page, itemsPerPage]);

  const goToPreviousPage = () => {
    setPage((currentPage) => Math.max(1, currentPage - 1));
  };

  const goToNextPage = () => {
    setPage((currentPage) => Math.min(totalPages, currentPage + 1));
  };

  if (games.length === 0) {
    return (
      <p className="text-muted-foreground">
        No hay recomendaciones disponibles.
      </p>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="min-h-187.5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {paginatedGames.map((game) => (
            <div
              key={game.appId}
              className="bg-card overflow-hidden rounded-lg"
            >
              <img
                src={
                  game.imageUrl ??
                  `https://cdn.akamai.steamstatic.com/steam/apps/${game.appId}/header.jpg`
                }
                onError={(e) => {
                  e.currentTarget.src =
                    "https://placehold.co/460x215?text=No+Image";
                }}
                alt={game.name}
                className="w-full object-cover"
              />

              <div className="space-y-2 p-4">
                <h2 className="text-foreground font-semibold">{game.name}</h2>

                <p className="text-muted-foreground line-clamp-2 text-sm">
                  {game.shortDescription}
                </p>

                <div className="flex items-center justify-between">
                  <span className="text-primary text-sm font-medium">
                    {game.isFree
                      ? "Gratis"
                      : (game.formattedPrice ?? "Ver precio")}
                  </span>

                  {game.storeUrl && (
                    <a
                      href={game.storeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground text-sm underline"
                    >
                      Ver en Steam
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={goToPreviousPage}
            disabled={page === 1}
            className="bg-card rounded-md px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Anterior
          </button>

          <span className="text-muted-foreground text-sm">
            Página {page} de {totalPages}
          </span>

          <button
            type="button"
            onClick={goToNextPage}
            disabled={page === totalPages}
            className="bg-card rounded-md px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  );
}
