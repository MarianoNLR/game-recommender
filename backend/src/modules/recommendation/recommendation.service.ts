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

    const memberProfiles = await Promise.all(
      groupSteamIds.map(async (steamId) => {
        const profile = await this.getMemberProfile(steamId);
        const tagProfile = await this.getMemberTagProfile(
          steamId,
          profile.topGames,
        );
        return { ...profile, ...tagProfile };
      }),
    );

    const { groupTagScores, topGroupTags } =
      this.getGroupTagProfile(memberProfiles);
    return {
      //group,
      memberProfiles,
      groupTagScores,
      topGroupTags,
    };
  }

  async getMemberProfile(steamId: string) {
    const games = await this.steamService.getOwnedGames(steamId);

    const topGames = games
      .sort((a, b) => (b.playtime_forever || 0) - (a.playtime_forever || 0))
      .slice(0, 3);

    return {
      steamId,
      games,
      topGames,
    };
  }

  async getMemberTagProfile(steamId: string, topGames: any[]) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    const appIds = topGames.map((game) => game.appid);
    const tagsByAppId = await this.steamService.getAppTags(appIds);

    const tagScores: Record<string, number> = {};
    topGames.forEach((game) => {
      const tags = tagsByAppId[game.appid] ?? {};
      const playtime = game.playtime_forever || 0;

      const totalVotes: any = Object.values(tags).reduce(
        (sum: number, v) => sum + (v as number),
        0,
      );

      Object.entries(tags).forEach(([tag, votes]) => {
        const proportion = (votes as number) / totalVotes;
        tagScores[tag] = (tagScores[tag] || 0) + playtime * proportion;
      });
    });

    const topTags = Object.entries(tagScores)
      .sort(([, a], [, b]) => b - a)
      .map(([tag]) => tag)
      .slice(0, 10);

    return { tagScores, topTags };
  }

  getGroupTagProfile(memberProfiles: any[]) {
    const groupTagScores: Record<string, number> = {};

    memberProfiles.forEach(({ topTags }) => {
      topTags.forEach((tag: string, index: number) => {
        // Position 0 has more value than position 9
        const positionWeight = topTags.length - index;
        groupTagScores[tag] = (groupTagScores[tag] || 0) + positionWeight;
      });
    });

    const topGroupTags = Object.entries(groupTagScores)
      .sort(([, a], [, b]) => b - a)
      .map(([tag]) => tag)
      .slice(0, 10);

    return { memberProfiles, groupTagScores, topGroupTags };
  }

  async getGroupPreferences(accessCode: string) {
    // This method will retrieve the group preferences based on the provided access code.
    // const { group, topGamesByMember, topAppIds } = await this.getGroupProfile(accessCode);

    // const tagsByAppId = await this.steamService.getAppTags(topAppIds);
    // console.log(tagsByAppId);
    // const groupTagProfile: Record<string, number> = {};

    // topGamesByMember.forEach(({ topGames }) => {
    //   topGames.forEach((game) => {
    //     const tags = tagsByAppId[game.appid] ?? {};
    //     const playtime = game.playtime_forever || 0;
    //     console.log(tags);
    //     Object.entries(tags).forEach(([tag, votes]) => {
    //       const weight = playtime * (votes as number);
    //       groupTagProfile[tag] = (groupTagProfile[tags] || 0) + weight;
    //     });
    //   });
    // });

    // //const appDetails = await this.steamService.getAppsDetails(topAppIds);

    // const sortedTags = Object.entries(groupTagProfile)
    //   .sort(([, a], [, b]) => b - a)
    //   .map(([tag]) => tag);
    // return {
    //   // group,
    //   groupTagProfile,
    //   topTags: sortedTags.slice(0, 10),
    // };
  }

  // async getGroupRecommendations(accessCode: string) {
  //   // This method will generate game recommendations for the group based on the provided access code.
  //   return;
  // }
}
