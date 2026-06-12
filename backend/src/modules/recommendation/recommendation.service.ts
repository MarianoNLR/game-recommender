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

    return {
      group,
      ownedGamesByMember,
    };
  }
}
