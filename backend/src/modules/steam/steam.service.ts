import { BadRequestException, Injectable } from '@nestjs/common';
import { SteamApiClient } from './steam-api.client';
import { SteamStoreClient } from './steam-store.client';
import { PlayerSummary, SteamGame } from './steam.types';
import { GameDetailsResponseMap } from '../game/game.types';
import { GameService } from '../game/game.service';

@Injectable()
export class SteamService {
  constructor(
    private readonly steamApiClient: SteamApiClient,
    private readonly steamStoreClient: SteamStoreClient,
    private readonly gameService: GameService,
  ) {}

  async getOwnedGames(steamId: string): Promise<SteamGame[]> {
    const response = await this.steamApiClient.getOwnedGames(steamId);

    const library = response.response;
    if (!Array.isArray(library?.games) && library?.game_count !== 0) {
      throw new BadRequestException(
        `No se pudo acceder a la biblioteca del SteamID ${steamId}. Revisá que el perfil y los detalles de juegos estén públicos en la privacidad de Steam y volvé a intentar.`,
      );
    }

    const gamesFiltered = (library.games ?? []).filter(
      (game) => game.playtime_forever >= 300,
    );

    return gamesFiltered.map((game: SteamGame) => ({
      appid: game.appid,
      name: game.name,
      playtime_forever: game.playtime_forever,
      img_icon_url: game.img_icon_url,
      content_descriptorids: game.content_descriptorids,
    }));
  }

  async validateMember(steamId: string) {
    const [player] = await this.getPlayerSummaries([steamId]);
    if (!player) {
      return { isValid: false as const, reason: `SteamID ${steamId} no encontrado` };
    }
    if (player.communityvisibilitystate !== 3) {
      return {
        isValid: false as const,
        isPrivate: true,
        reason: `El perfil del SteamID ${steamId} es privado. Configuralo como público en Steam.`,
        name: player.personaname,
        avatarUrl: player.avatarmedium,
      };
    }
    try {
      await this.getOwnedGames(steamId);
    } catch (error) {
      if (!(error instanceof BadRequestException)) throw error;
      return {
        isValid: false as const,
        reason: error.message,
        name: player.personaname,
        avatarUrl: player.avatarmedium,
      };
    }
    return {
      isValid: true as const,
      isPrivate: false,
      name: player.personaname,
      avatarUrl: player.avatarmedium,
      steamId,
    };
  }

  async getPlayerSummaries(steamIds: string[]): Promise<PlayerSummary[]> {
    const response = await this.steamApiClient.getPlayerSummaries(steamIds);

    return response.response.players;
  }

  // async getGameInfo(appIds: number[]): Promise<GameDetailsResponseMap> {
  //   return this.steamApiClient.getAppsDetails(appIds);
  // }

  async getGameTags(appId: number) {
    return this.steamStoreClient.getGameTags(appId);
  }

  async syncGame(appId: number) {
    const game = await this.gameService.findByAppId(appId);

    // New game
    if (!game) {
      const details = await this.steamStoreClient.getGameDetails(appId);
      const tags = await this.steamStoreClient.getGameTags(appId);

      await this.gameService.upsertGame(details);
      await this.gameService.updateGameTags(appId, tags);

      return this.gameService.findByAppId(appId);
    }

    const priceValid = this.gameService.isPriceCacheValid(game);
    const infoValid = this.gameService.isInfoCacheValid(game);
    const tagsValid = this.gameService.isTagsCacheValid(game);

    // Everthing is up to date
    if (priceValid && infoValid && tagsValid) {
      return game;
    }

    // If price or info are not valid update
    if (!priceValid || !infoValid) {
      const details = await this.steamStoreClient.getGameDetails(appId);

      await this.gameService.upsertGame(details, !priceValid, !infoValid);
    }

    // Control tags cache
    if (!tagsValid) {
      const tags = await this.steamStoreClient.getGameTags(appId);

      await this.gameService.updateGameTags(appId, tags);
    }

    return this.gameService.findByAppId(appId);
  }
}
