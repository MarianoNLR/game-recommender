import { Injectable } from '@nestjs/common';
import { SteamApiClient } from './steam-api.client';
import { PlayerSummary, SteamAppDetailsMap, SteamGame, SteamSpyGame } from './steam.types';
import { GameService } from '../game/game.service';
import { GameDetailsResponseMap } from '../game/game.types';

@Injectable()
export class SteamService {
  // This class will handle interactions with the Steam API, such as fetching user data, owned games, etc.
  constructor(
    private readonly steamApiClient: SteamApiClient,
    private readonly gameService: GameService,
  ) {}

  async getOwnedGames(steamId: string): Promise<SteamGame[]> {
    // For a given Steam ID, this method would call the Steam API to retrieve the list of owned games.
    const response = await this.steamApiClient.getOwnedGames(steamId);
    console.log('Owned Games Response:', response);
    // Filter games that have been played for more than 5 hours (300 minutes) to focus on games the user has engaged with.
    const gamesFiltered = response.response.games.filter(
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

  async getPlayerSummaries(steamIds: string[]): Promise<PlayerSummary[]> {
    // This method would call the Steam API to retrieve player summaries for a list of Steam IDs.
    const response = await this.steamApiClient.getPlayerSummaries(steamIds);
    return response.response.players;
  }

  async getAppsDetails(appIds: number[]): Promise<GameDetailsResponseMap> {
    // This method would call the Steam API to retrieve details for a list of app IDs.
    const response: GameDetailsResponseMap =
      await this.steamApiClient.getAppsDetails(appIds);
    return response;
  }

  async getAppTags(
    appIds: number[],
  ): Promise<Record<string, Record<string, number>>> {
    const data: Record<string, Record<string, number>> = {};

    for (const id of appIds) {
      const cached = await this.gameService.findByAppId(id);

      if (cached && this.gameService.isCacheValid(cached)) {
        data[id] = cached.tags as Record<string, number>;
        continue;
      }

      const [tags, details] = await Promise.all([
        this.steamApiClient.getAppTags(id),
        this.steamApiClient.getAppsDetails([id]),
      ]);

      await this.gameService.upsert(id, {
        name: details[id]?.name ?? null,
        tags,
        price: details[id]?.price,
        fetchedAt: new Date(),
      });

      data[id] = tags;

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    return data;
  }

  async getAppsByTag(tag: string): Promise<Record<string, SteamSpyGame>> {
    const response = await this.steamApiClient.getAppsByTag(tag);
    return response;
  }
}
