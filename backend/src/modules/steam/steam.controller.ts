import {
  Controller,
  Get,
  Body,
  Param,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { SteamService } from './steam.service';
import {
  PlayerSummary,
  SteamAppDetails,
  SteamAppDetailsMap,
  SteamGame,
  SteamSpyGame,
} from './steam.types';
import { SteamStoreClient } from './steam-store.client';
import { SteamApiClient } from './steam-api.client';
import { GameService } from '../game/game.service';

@Controller('steam')
export class SteamController {
  constructor(
    private steamService: SteamService,
    private steamStoreClient: SteamStoreClient,
    private gameService: GameService,
    private steamApiClient: SteamApiClient,
  ) {}
  @Get('validate-member/:steamId')
  async validateMember(@Param('steamId') steamId: string) {
    return this.steamService.validateMember(steamId);
  }

  @Get('owned-games/:steamId')
  async getOwnedGames(@Param('steamId') steamId: string): Promise<SteamGame[]> {
    return this.steamService.getOwnedGames(steamId);
  }

  @Get('player-summaries/:steamIds')
  async getPlayerSummaries(
    @Param('steamIds') steamIds: string,
  ): Promise<PlayerSummary[]> {
    const steamIdArray = steamIds.split(',');
    return this.steamService.getPlayerSummaries(steamIdArray);
  }

  // @Get('apps-details')
  // async getAppsDetails(
  //   @Query('appIds') appIds: string,
  // ): Promise<GameDetailsResponseMap> {
  //   const appIdArray = appIds.split(',').map((id) => parseInt(id, 10));
  //   return this.steamService.getAppsDetails(appIdArray);
  // }

  // @Get('app-tags')
  // async getAppTags(
  //   @Query('appIds') appIds: string,
  // ): Promise<Record<string, Record<string, number>>> {
  //   const appIdArray = appIds.split(',').map((id) => parseInt(id, 10));
  //   return this.steamService.getAppTags(appIdArray);
  // }

  // @Get('apps-by-tag')
  // async getAppsByTag(
  //   @Query('tag') tag: string,
  // ): Promise<Record<string, SteamSpyGame>> {
  //   return this.steamService.getAppsByTag(tag);
  // }

  @Get('games/:appId/tags')
  async getGameTags(@Param('appId', ParseIntPipe) appId: number) {
    return this.steamStoreClient.getGameTags(appId);
  }

  @Get('games/:appId/details')
  async getGameDetails(@Param('appId', ParseIntPipe) appId: number) {
    return this.steamStoreClient.getGameDetails(appId);
  }

  @Get('games/:appId/sync')
  syncGame(@Param('appId', ParseIntPipe) appId: number) {
    return this.steamService.syncGame(appId);
  }

  @Get('games/:appId/tags/sync')
  async syncGameTags(@Param('appId', ParseIntPipe) appId: number) {
    const details = await this.steamStoreClient.getGameDetails(appId);
    // console.log('Details fetched for appId', appId, details);
    // await new Promise((resolve) => setTimeout(resolve, 100000000)); // Wait for 1 second
    await this.gameService.upsertGame(details);

    const tags = await this.steamStoreClient.getGameTags(appId);

    await this.gameService.updateGameTags(appId, tags);

    return {
      appId,
      name: details.name,
      tagsCount: tags.length,
      tags,
    };
  }

  @Get('games/get-apps')
  async getApps() {
    return (await this.steamApiClient.getAppList()).response.apps;
  }
}
