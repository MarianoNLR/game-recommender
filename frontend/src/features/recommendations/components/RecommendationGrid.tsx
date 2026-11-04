"use client";

import { useMemo, useRef, useState } from "react";

type RecommendationGame = {
  appId: number;
  name: string;
  shortDescription?: string | null;
  price?: number | null;
  formattedPrice?: string | null;
  isFree?: boolean | null;
  storeUrl?: string;
  imageUrl?: string | null;
  matchedTags?: { tag: string }[];
};

type RecommendationGridProps = {
  games: RecommendationGame[];
  // Tags de "Gustos del grupo", en ese orden. Cada tarjeta muestra los que tiene el juego.
  groupTags?: string[];
  itemsPerPage?: number;
};

const MAX_VISIBLE_TAGS = 5;

function GameTags({
  game,
  groupTags,
}: {
  game: RecommendationGame;
  groupTags: string[];
}) {
  const gameTags = new Set((game.matchedTags ?? []).map((item) => item.tag));
  const shared = groupTags.filter((tag) => gameTags.has(tag));

  if (shared.length === 0) return null;

  const visible = shared.slice(0, MAX_VISIBLE_TAGS);
  const hidden = shared.slice(MAX_VISIBLE_TAGS);

  return (
    <div className="flex flex-wrap gap-1">
      {visible.map((tag) => (
        <span
          key={tag}
          className="bg-muted text-muted-foreground rounded-md px-2 py-0.5 text-xs"
        >
          {tag}
        </span>
      ))}
      {hidden.length > 0 && (
        <span
          title={hidden.join(", ")}
          className="bg-muted text-muted-foreground rounded-md px-2 py-0.5 text-xs"
        >
          +{hidden.length}
        </span>
      )}
    </div>
  );
}

export default function RecommendationGrid({
  games,
  groupTags = [],
  itemsPerPage = 9,
}: RecommendationGridProps) {
  const [page, setPage] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  const totalPages = Math.max(1, Math.ceil(games.length / itemsPerPage));

  const paginatedGames = useMemo(() => {
    const start = (page - 1) * itemsPerPage;
    const end = start + itemsPerPage;

    return games.slice(start, end);
  }, [games, page, itemsPerPage]);

  // Al cambiar de página, vuelve al inicio de esta lista (hay más de una en la página).
  const scrollToTop = () => {
    containerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const goToPreviousPage = () => {
    setPage((currentPage) => Math.max(1, currentPage - 1));
    scrollToTop();
  };

  const goToNextPage = () => {
    setPage((currentPage) => Math.min(totalPages, currentPage + 1));
    scrollToTop();
  };

  if (games.length === 0) {
    return (
      <p className="text-muted-foreground">
        No hay recomendaciones disponibles.
      </p>
    );
  }

  return (
    <div ref={containerRef} className="flex scroll-mt-4 flex-col">
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

                <GameTags game={game} groupTags={groupTags} />

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
