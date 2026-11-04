import { BadRequestException } from '@nestjs/common';
import type { GetOwnedGamesResponse, SteamGame } from './steam.types';

/**
 * Devuelve los juegos de una respuesta de GetOwnedGames.
 * Una biblioteca vacía pero pública (game_count: 0) es válida; si Steam no
 * devuelve ni juegos ni game_count 0, la biblioteca no es accesible.
 */
export function extractLibraryGames(
  response: GetOwnedGamesResponse,
  steamId: string,
): SteamGame[] {
  const library = response.response;
  if (!Array.isArray(library?.games) && library?.game_count !== 0) {
    throw new BadRequestException(
      `No se pudo acceder a la biblioteca del SteamID ${steamId}. Revisá que el perfil y los detalles de juegos estén públicos en la privacidad de Steam y volvé a intentar.`,
    );
  }

  return library?.games ?? [];
}
