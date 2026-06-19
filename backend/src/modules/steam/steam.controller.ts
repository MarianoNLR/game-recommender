import { Controller, Get, Body, Param, Query } from '@nestjs/common';
import { SteamService } from './steam.service';
import { OwnedGamesResponseDto } from './dto/owned-games-response.dto';

@Controller('steam')
export class SteamController {
  constructor(private steamService: SteamService) {}
  @Get('owned-games/:steamId')
  async getOwnedGames(
    @Param('steamId') steamId: string,
  ): Promise<OwnedGamesResponseDto[]> {
    return this.steamService.getOwnedGames(steamId);
  }

  @Get('player-summaries/:steamIds')
  async getPlayerSummaries(@Param('steamIds') steamIds: string): Promise<any> {
    const steamIdArray = steamIds.split(',');
    return this.steamService.getPlayerSummaries(steamIdArray);
  }

  @Get('apps-details')
  async getAppsDetails(@Query('appIds') appIds: string): Promise<any> {
    const appIdArray = appIds.split(',').map((id) => parseInt(id, 10));
    return this.steamService.getAppsDetails(appIdArray);
  }

  @Get('app-tags')
  async getAppTags(@Query('appIds') appIds: string): Promise<any> {
    const appIdArray = appIds.split(',').map((id) => parseInt(id, 10));
    return this.steamService.getAppTags(appIdArray);
  }
}
