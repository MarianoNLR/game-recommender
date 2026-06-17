import { Injectable } from '@nestjs/common';
import { SteamService } from '../steam/steam.service';
import { GroupsService } from '../groups/groups.service';

@Injectable()
export class RecommendationService {
  constructor(
    private steamService: SteamService,
    private groupsService: GroupsService,
  ) {}

  async getGroupProfile(accessCode: string) {
    // This method will retrieve the group profile,
    // including the list of members and their owned games, based on the provided access code.
    const group = await this.groupsService.findOne(accessCode);

    const groupSteamIds = group.members.map((member) => member.steamId);
    console.log('Group Steam IDs:', groupSteamIds);
    const ownedGamesByMember = await Promise.all(
      groupSteamIds.map(async (steamId) => {
        return {
          steamId,
          games: await this.steamService.getOwnedGames(steamId),
        };
      }),
    );

    const topGamesByMember = ownedGamesByMember.map(({ steamId, games }) => {
      const topGames = games
        .sort((a, b) => (b.playtime_forever || 0) - (a.playtime_forever || 0))
        .slice(0, 10);
      return {
        steamId,
        topGames,
      };
    });

    const uniqueTopAppIds = new Set<number>();
    topGamesByMember.forEach(({ topGames }) => {
      topGames.forEach((game) => uniqueTopAppIds.add(game.appid));
    });

    return {
      group,
      ownedGamesByMember,
      topGamesByMember,
      topAppIds: Array.from(uniqueTopAppIds),
    };
  }

  async getGroupPreferences(accessCode: string) {
    // This method will retrieve the group preferences based on the provided access code.
    const { group, topAppIds } = await this.getGroupProfile(accessCode);

    const appDetails = await this.steamService.getAppsDetails(topAppIds);
    return {
      // group,
      appDetails,
    };
  }

  // async getGroupRecommendations(accessCode: string) {
  //   // This method will generate game recommendations for the group based on the provided access code.
  //   return;
  // }
}
