import { Injectable } from '@nestjs/common';
import { OwnedGamesResponseDto } from './dto/owned-games-response.dto';
import { SteamApiClient } from './steam-api.client';

@Injectable()
export class SteamService {
  // This class will handle interactions with the Steam API, such as fetching user data, owned games, etc.
  constructor(private readonly steamApiClient: SteamApiClient) {}

  async getOwnedGames(steamId: string): Promise<OwnedGamesResponseDto[]> {
    // For a given Steam ID, this method would call the Steam API to retrieve the list of owned games.
    const response = await this.steamApiClient.getOwnedGames(steamId);

    // Filter games that have been played for more than 5 hours (300 minutes) to focus on games the user has engaged with.
    const gamesFiltered = response.response.games.filter(
      (game) => game.playtime_forever >= 300,
    );

    return gamesFiltered.map((game: OwnedGamesResponseDto) => ({
      appid: game.appid,
      name: game.name,
      playtime_forever: game.playtime_forever,
      img_icon_url: game.img_icon_url,
      content_descriptorids: game.content_descriptorids,
    }));
  }

  async getPlayerSummaries(steamIds: string[]): Promise<any> {
    // This method would call the Steam API to retrieve player summaries for a list of Steam IDs.
    const response = await this.steamApiClient.getPlayerSummaries(steamIds);
    return response.response.players;
  }

  async getAppsDetails(appIds: number[]): Promise<any> {
    // This method would call the Steam API to retrieve details for a list of app IDs.
    const response = await this.steamApiClient.getAppsDetails(appIds);
    return response;
  }
}
