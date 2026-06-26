import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosResponse } from 'axios';
import { SteamApiResponse, SteamPlayerSummaryResponse } from './steam.types';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config/dist/config.service';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class SteamApiClient {
  private apiKey: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
  ) {
    this.apiKey = this.configService.get<string>('STEAM_API_KEY') ?? '';
  }

  async getOwnedGames(steamId: string): Promise<SteamApiResponse> {
    const url = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${this.apiKey}&steamid=${steamId}&include_appinfo=true&include_played_free_games=true`;

    const response: AxiosResponse<SteamApiResponse> = await firstValueFrom(
      this.httpService.get<SteamApiResponse>(url),
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

  async getAppsDetails(appId: number[]): Promise<any> {
    // TODO: implement batching for large number of appIds to avoid hitting rate limits.
    const data: any = {};
    for (const id of appId) {
      console.log(`Fetching details for app ID: ${id}`);
      const url = `https://store.steampowered.com/api/appdetails?appids=${id}&cc=us`;
      const response: AxiosResponse<any> = await firstValueFrom(
        this.httpService.get<any>(url),
      );
      const { success } = response.data[id];
      const {
        type,
        name,
        steam_appid,
        is_free,
        price_overview,
        recommendations,
      } = response.data[id].data;
      data[id] = {
        success,
        type,
        name,
        steam_appid,
        is_free,
        price_overview,
        recommendations,
      };
    }
    return data;
  }

  async getAppTags(appId: number): Promise<any> {
    // TODO: implement batching and caching to avoid rate limits and improve performance.
    const url = `https://steamspy.com/api.php?request=appdetails&appid=${appId}`;
    const response: AxiosResponse<any> = await firstValueFrom(
      this.httpService.get<any>(url),
    );
    return response.data.tags;
  }

  async getAppsByTag(tag: string): Promise<any> {
    const url = `https://steamspy.com/api.php?request=tag&tag=${tag}`;
    console.log(url);
    const response: AxiosResponse<any> = await firstValueFrom(
      this.httpService.get<any>(url),
    );
    return response;
  }
}
