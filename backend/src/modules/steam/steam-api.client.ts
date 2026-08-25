import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { AxiosResponse } from 'axios';
import axios from 'axios';

import {
  GetOwnedGamesResponse,
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

  async getAppList(lastAppId?: number) {
    const response = await axios.get(
      'https://api.steampowered.com/IStoreService/GetAppList/v1/',
      {
        params: {
          key: this.apiKey,
          max_results: 50000,
          ...(lastAppId !== undefined && {
            last_appid: lastAppId,
          }),
        },
      },
    );

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return response.data.response;
  }

  async getItems(appIds: number[]) {
    const BASE_DELAY_MS = 2000;
    const MAX_DELAY_MS = 60_000;

    const inputJson = {
      ids: appIds.map((appid) => ({
        appid,
      })),
      context: {
        language: 'spanish',
        country_code: 'AR',
      },
      data_request: {
        include_basic_info: true,
        include_assets: true,
        include_release: true,
        include_reviews: true,
        include_tag_count: 20,
      },
    };

    let attempt = 0;

    while (true) {
      try {
        const response = await axios.get(
          'https://api.steampowered.com/IStoreBrowseService/GetItems/v1/',
          {
            params: {
              key: this.apiKey,
              input_json: JSON.stringify(inputJson),
            },
            timeout: 30_000,
          },
        );

        return response.data.response;
      } catch (error) {
        if (!axios.isAxiosError(error)) {
          throw error;
        }

        const status = error.response?.status;

        const shouldRetry =
          status === 429 ||
          status === 500 ||
          status === 502 ||
          status === 503 ||
          status === 504 ||
          error.code === 'ECONNRESET' ||
          error.code === 'ETIMEDOUT';

        if (!shouldRetry) {
          throw error;
        }

        attempt++;

        const retryAfter = error.response?.headers?.['retry-after'];

        const delay = retryAfter
          ? Number(retryAfter) * 1000
          : Math.min(BASE_DELAY_MS * 2 ** (attempt - 1), MAX_DELAY_MS);

        console.warn(
          `GetItems failed (${status ?? error.code}). ` +
            `Intento ${attempt}. Retrying in ${delay / 1000}s...`,
        );

        await this.sleep(delay);
      }
    }
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
