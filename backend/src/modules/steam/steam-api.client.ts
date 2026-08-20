import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { AxiosResponse } from 'axios';

import {
  GetOwnedGamesResponse,
  SteamAppListResponse,
  SteamPlayerSummaryResponse,
} from './steam.types';

@Injectable()
export class SteamApiClient {
  private readonly apiKey: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.apiKey = this.configService.get<string>('STEAM_API_KEY') ?? '';
    // this.apiKey = 'E8501EA9FB9B38EE7FAB90F44BE9AE55';
  }

  async getOwnedGames(steamId: string): Promise<GetOwnedGamesResponse> {
    const url =
      `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/` +
      `?key=${this.apiKey}` +
      `&steamid=${steamId}` +
      `&include_appinfo=true` +
      `&include_played_free_games=true`;

    const response: AxiosResponse<GetOwnedGamesResponse> = await firstValueFrom(
      this.httpService.get<GetOwnedGamesResponse>(url),
    );

    return response.data;
  }

  async getPlayerSummaries(
    steamIds: string[],
  ): Promise<SteamPlayerSummaryResponse> {
    const url =
      `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/` +
      `?key=${this.apiKey}` +
      `&steamids=${steamIds.join(',')}`;

    const response: AxiosResponse<SteamPlayerSummaryResponse> =
      await firstValueFrom(
        this.httpService.get<SteamPlayerSummaryResponse>(url),
      );

    return response.data;
  }

  async getAppList(lastAppId = 0): Promise<SteamAppListResponse> {
    const url =
      `https://api.steampowered.com/IStoreService/GetAppList/v1/` +
      `?key=${this.apiKey}` +
      `&max_results=50000` +
      `&last_appid=${lastAppId}`;

    const response: AxiosResponse<SteamAppListResponse> = await firstValueFrom(
      this.httpService.get<SteamAppListResponse>(url),
    );

    return response.data;
  }
}
