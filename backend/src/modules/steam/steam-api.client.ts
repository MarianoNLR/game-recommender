import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosResponse } from 'axios';
import { SteamApiResponse, SteamPlayerSummaryResponse } from './steam.types';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config/dist/config.service';

@Injectable()
export class SteamApiClient {
  private apiKey: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
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
      const url = `https://store.steampowered.com/api/appdetails?appids=${id}`;
      const response: AxiosResponse<any> = await firstValueFrom(
        this.httpService.get<any>(url),
      );
      data[id] = response.data[id];
    }
    return data;
  }
}
