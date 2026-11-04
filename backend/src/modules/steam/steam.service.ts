import { Injectable } from '@nestjs/common';
import { SteamApiClient } from './steam-api.client';
import { SteamStoreClient } from './steam-store.client';
import { PlayerSummary, SteamGame } from './steam.types';
import { GameDetailsResponseMap } from '../game/game.types';
import { GameService } from '../game/game.service';
import { SteamProfileError, SteamProfileService } from './steam-profile.service';
import { extractLibraryGames } from './steam-library.util';
import { MIN_PLAYTIME_MINUTES } from './steam.constants';

@Injectable()
export class SteamService {
  constructor(
    private readonly steamApiClient: SteamApiClient,
    private readonly steamStoreClient: SteamStoreClient,
    private readonly gameService: GameService,
    private readonly steamProfileService: SteamProfileService,
  ) {}

  async getOwnedGames(steamId: string): Promise<SteamGame[]> {
    const response = await this.steamApiClient.getOwnedGames(steamId);

    const games = extractLibraryGames(response, steamId);

    const gamesFiltered = games.filter(
      (game) => game.playtime_forever >= MIN_PLAYTIME_MINUTES,
    );

    return gamesFiltered.map((game: SteamGame) => ({
      appid: game.appid,
      name: game.name,
      playtime_forever: game.playtime_forever,
      img_icon_url: game.img_icon_url,
      content_descriptorids: game.content_descriptorids,
    }));
  }

  // Valida con el perfil cacheado (o lo consulta a Steam y lo guarda), de modo
  // que las recomendaciones del grupo no vuelvan a llamar a Steam por este miembro.
  async validateMember(steamId: string) {
    try {
      const profile = await this.steamProfileService.getProfile(steamId);

      return {
        isValid: true as const,
        isPrivate: false,
        name: profile.name,
        avatarUrl: profile.avatarUrl,
        steamId,
      };
    } catch (error) {
      if (!(error instanceof SteamProfileError)) throw error;

      return {
        isValid: false as const,
        reason: error.message,
        ...error.details,
      };
    }
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
