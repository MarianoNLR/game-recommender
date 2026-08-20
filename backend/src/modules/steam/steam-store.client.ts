import { Injectable } from '@nestjs/common';
import axios, { AxiosResponse } from 'axios';
import * as cheerio from 'cheerio';
import { SteamAppDetails, SteamAppDetailsMap } from './steam.types';
import { firstValueFrom } from 'rxjs/internal/firstValueFrom';
import { HttpService } from '@nestjs/axios/dist/http.service';
import { SteamStoreTag } from './steam.types';

@Injectable()
export class SteamStoreClient {
  constructor(private readonly httpService: HttpService) {}

  async getGameTags(appId: number): Promise<SteamStoreTag[]> {
    const response = await axios.get(
      `https://store.steampowered.com/app/${appId}/?l=english`,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/139.0.0.0 Safari/537.36',
          Cookie: 'birthtime=631152001; lastagecheckage=1-January-1990',
        },
      },
    );

    return this.extractGameTags(response.data, appId);
  }

  private extractGameTags(html: string, appId: number): SteamStoreTag[] {
    const $ = cheerio.load(html);

    const pattern = new RegExp(
      `InitAppTagModal\\(\\s*${appId}\\s*,\\s*(\\[[\\s\\S]*?\\])\\s*,\\s*\\[\\]`,
    );

    for (const script of $('script').toArray()) {
      const content = $(script).html();

      if (!content) continue;

      const match = content.match(pattern);

      if (!match) continue;

      try {
        return (JSON.parse(match[1]) as SteamStoreTag[]).map(
          ({ tagid, name, count }) => ({
            tagid,
            name,
            count,
          }),
        );
      } catch {
        throw new Error(`Could not parse tags for app ${appId}`);
      }
    }

    throw new Error(`Could not find tags for app ${appId}`);
  }

  async getGameDetails(appId: number): Promise<SteamAppDetails> {
    const url =
      `https://store.steampowered.com/api/appdetails` +
      `?appids=${appId}&cc=us`;

    const response: AxiosResponse<SteamAppDetails> = await firstValueFrom(
      this.httpService.get<SteamAppDetails>(url),
    );

    return {
      type: response.data[appId].data.type,
      name: response.data[appId].data.name,
      steam_appid: response.data[appId].data.steam_appid,
      is_free: response.data[appId].data.is_free,
      short_description: response.data[appId].data.short_description,
      header_image: response.data[appId].data.header_image,
      price_overview: response.data[appId].data.price_overview,
      recommendations: response.data[appId].data.recommendations,
      release_date: response.data[appId].data.release_date,
    };
  }
}
