import { Controller, Get, Body, Param, Query } from '@nestjs/common';
import { SteamService } from './steam.service';
import {
  PlayerSummary,
  SteamAppDetailsMap,
  SteamGame,
  SteamSpyGame,
} from './steam.types';
import { GameDetailsResponseMap } from '../game/game.types';

@Controller('steam')
export class SteamController {
  constructor(private steamService: SteamService) {}
  @Get('validate-member/:steamId')
  async validateMember(@Param('steamId') steamId: string) {
    const playerSummaries = await this.steamService.getPlayerSummaries([
      steamId,
    ]);
    const player = playerSummaries[0];
    if (!player) {
      return { isValid: false, reason: 'SteamID not found' };
    }
    if (player.communityvisibilitystate !== 3) {
      return {
        isValid: false,
        isPrivate: true,
        reason: 'El perfil es privado',
        name: player.personaname,
        avatarUrl: player.avatarmedium,
      };
    }
    return {
      isValid: true,
      isPrivate: false,
      name: player.personaname,
      avatarUrl: player.avatarmedium,
      steamId,
    };
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

  @Get('apps-details')
  async getAppsDetails(
    @Query('appIds') appIds: string,
  ): Promise<GameDetailsResponseMap> {
    const appIdArray = appIds.split(',').map((id) => parseInt(id, 10));
    return this.steamService.getAppsDetails(appIdArray);
  }

  @Get('app-tags')
  async getAppTags(
    @Query('appIds') appIds: string,
  ): Promise<Record<string, Record<string, number>>> {
    const appIdArray = appIds.split(',').map((id) => parseInt(id, 10));
    return this.steamService.getAppTags(appIdArray);
  }

  @Get('apps-by-tag')
  async getAppsByTag(
    @Query('tag') tag: string,
  ): Promise<Record<string, SteamSpyGame>> {
    return this.steamService.getAppsByTag(tag);
  }
}
