import { Injectable } from '@nestjs/common';
import { OwnedGamesResponseDto } from './dto/owned-games-response.dto';
import { SteamApiClient } from './steam-api.client';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class SteamService {
  // This class will handle interactions with the Steam API, such as fetching user data, owned games, etc.
  constructor(
    private readonly steamApiClient: SteamApiClient,
    private readonly prismaService: PrismaService,
  ) {}

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

  async getAppTags(appIds: number[]): Promise<any> {
    // This method would call the Steam API to retrieve tags for a list of app IDs.
    const data: any = {};

    for (const id of appIds) {
      const cached = await this.prismaService.gameTags.findUnique({
        where: { appId: id },
      });

      const isValid =
        cached && Date.now() - cached.fetchedAt.getTime() < 24 * 60 * 60 * 1000;

      if (isValid) {
        data[id] = cached.tags;
        continue;
      }
      const tags = await this.steamApiClient.getAppTags(id);

      await this.prismaService.gameTags.upsert({
        where: { appId: id },
        update: { tags, fetchedAt: new Date() },
        create: { appId: id, tags },
      });

      data[id] = tags;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    return data;
  }

  async getAppsByTag(tag: string): Promise<any> {
    const response = await this.steamApiClient.getAppsByTag(tag);
    return response.data;
  }
}
