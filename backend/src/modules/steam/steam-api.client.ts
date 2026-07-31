import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosResponse } from 'axios';
import {
  GetOwnedGamesResponse,
  SteamAppDetails,
  SteamPlayerSummaryResponse,
  SteamSpyGameTagsResponse,
  SteamSpyGame,
} from './steam.types';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config/dist/config.service';
import { PrismaService } from 'src/prisma.service';
import { GameService } from '../game/game.service';
import { GameDetailsCache, GameDetailsResponseMap } from '../game/game.types';

@Injectable()
export class SteamApiClient {
  private apiKey: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
    private readonly gameService: GameService,
  ) {
    this.apiKey = this.configService.get<string>('STEAM_API_KEY') ?? '';
  }

  async getOwnedGames(steamId: string): Promise<GetOwnedGamesResponse> {
    const url = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${this.apiKey}&steamid=${steamId}&include_appinfo=true&include_played_free_games=true`;

    const response: AxiosResponse<GetOwnedGamesResponse> = await firstValueFrom(
      this.httpService.get<GetOwnedGamesResponse>(url),
    );

    return response.data;
  }

  async getPlayerSummaries(
    steamId: string[],
  ): Promise<SteamPlayerSummaryResponse> {
    console.log('Fetching player summaries for Steam IDs:', typeof steamId);
    const url = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${this.apiKey}&steamids=${steamId.join(',')}`;

    const response: AxiosResponse<SteamPlayerSummaryResponse> =
      await firstValueFrom(
        this.httpService.get<SteamPlayerSummaryResponse>(url),
      );

    return response.data;
  }

  async getAppsDetails(appIds: number[]): Promise<GameDetailsResponseMap> {
    const data: GameDetailsResponseMap = {};

    for (const id of appIds) {
      const cached = await this.gameService.findByAppId(id);

      if (cached && cached.details && this.gameService.isCacheValid(cached)) {
        const details = cached.details as unknown as GameDetailsCache;

        data[id] = {
          appId: cached.appId,
          name: cached.name ?? 'Unknown',
          price: cached.price,
          ...details,
        };

        continue;
      }

      const url = `https://store.steampowered.com/api/appdetails?appids=${id}&cc=us`;

      const response: AxiosResponse<SteamAppDetails> = await firstValueFrom(
        this.httpService.get<SteamAppDetails>(url),
      );

      const app = response.data[id];

      if (!app?.success) continue;

      const {
        type,
        name,
        is_free,
        short_description,
        header_image,
        price_overview,
        recommendations,
      } = app.data;

      const details: GameDetailsCache = {
        type,
        isFree: is_free,
        shortDescription: short_description,
        headerImage: header_image,
        recommendations,
      };

      await this.gameService.upsert(id, {
        name,
        price: price_overview?.final ?? null,
        details,
        fetchedAt: new Date(),
      });

      data[id] = {
        appId: id,
        name,
        price: price_overview?.final ?? null,
        ...details,
      };

      await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    return data;
  }
  async getAppTags(appId: number): Promise<Record<string, number>> {
    // TODO: implement batching and caching to avoid rate limits and improve performance.
    const url = `https://steamspy.com/api.php?request=appdetails&appid=${appId}`;
    const response: AxiosResponse<SteamSpyGameTagsResponse> =
      await firstValueFrom(this.httpService.get<SteamSpyGameTagsResponse>(url));
    return response.data.tags ?? {};
  }

  async getAppsByTag(tag: string): Promise<Record<string, SteamSpyGame>> {
    const url = `https://steamspy.com/api.php?request=tag&tag=${tag}`;
    console.log(url);
    const response: AxiosResponse<Record<string, SteamSpyGame>> =
      await firstValueFrom(
        this.httpService.get<Record<string, SteamSpyGame>>(url),
      );
    return response.data;
  }
}
