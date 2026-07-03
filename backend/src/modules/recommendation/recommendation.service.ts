import { Injectable } from '@nestjs/common';
import { SteamService } from '../steam/steam.service';
import { GroupsService } from '../groups/groups.service';
import { SteamGame } from '../steam/steam.types';
import { MemberProfile, MemberProfileWithTags, MemberTagProfile } from './recommendation.types';

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

  async getMemberProfile(steamId: string): Promise<MemberProfile> {
    const games: SteamGame[] = await this.steamService.getOwnedGames(steamId);

    const topGames = games
      .sort((a, b) => (b.playtime_forever || 0) - (a.playtime_forever || 0))
      .slice(0, 3);

    return {
      steamId,
      games,
      topGames,
    };
  }

  async getMemberTagProfile(
    steamId: string,
    topGames: SteamGame[],
  ): Promise<MemberTagProfile> {
    const appIds = topGames.map((game) => game.appid);
    const tagsByAppId = await this.steamService.getAppTags(appIds);

    const tagScores: Record<string, number> = {};
    topGames.forEach((game) => {
      const tags = tagsByAppId[game.appid] ?? {};
      const playtime = game.playtime_forever || 0;

      const totalVotes: number = Object.values(tags).reduce(
        (sum, v) => sum + v,
        0,
      );

      Object.entries(tags).forEach(([tag, votes]) => {
        const proportion = totalVotes > 0 ? votes / totalVotes : 0;
        tagScores[tag] = (tagScores[tag] || 0) + playtime * proportion;
      });
    });

    const topTags = Object.entries(tagScores)
      .sort(([, a], [, b]) => b - a)
      .map(([tag]) => tag)
      .slice(0, 10);

    return { tagScores, topTags };
  }

  getGroupTagProfile(memberProfiles: MemberProfileWithTags[]) {
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

    return { groupTagScores, topGroupTags };
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

  async getGroupRecommendations(accessCode: string) {
    // This method will generate game recommendations for the group based on the provided access code.
    const { memberProfiles, groupTagScores, topGroupTags } =
      await this.getGroupProfile(accessCode);
    console.log(memberProfiles, groupTagScores, topGroupTags);

    // Group Top Tags to search in steamspy
    const tagsToSearch = topGroupTags.slice(0, 5);

    // Search games by tag
    const candidatesByTag = await Promise.all(
      tagsToSearch.map((tag) => {
        const result = this.steamService.getAppsByTag(tag);
        return result;
      }),
    );

    // Count wieight of each candidate using index of tag.
    const appearances: Record<string, number> = {};
    candidatesByTag.forEach((games, index) => {
      const weight = tagsToSearch.length - index;
      Object.keys(games).forEach((appid) => {
        const id = Number(appid);
        appearances[id] = (appearances[id] || 0) + weight;
      });
    });

    // Set with group's owned games
    const ownedAppIds = new Set<number>();
    memberProfiles.forEach(({ games }) => {
      games.forEach((game) => ownedAppIds.add(game.appid));
    });

    const recommendations = Object.entries(appearances)
      .filter(([appId]) => !ownedAppIds.has(Number(appId)))
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([appId, count]) => ({ appId: Number(appId), tagMatches: count }));

    const appIds = recommendations.map(({ appId }) => appId);
    const detailsMap = await this.steamService.getAppsDetails(appIds);
    console.log(detailsMap);
    const recommendationsResponse = recommendations.map(
      ({ appId, tagMatches }) => {
        const details = detailsMap[appId] || {};
        console.log(details);
        return {
          appId,
          score: tagMatches,
          name: details.name || 'Unknown',
          headerImage: details.header_image || '',
          shortDescription: details.short_description || '',
          price: details.price_overview?.final_formatted || null,
          isFree: details.is_free || false,
          metacritic: details.recommendations?.total || null,
          storeUrl: `https://store.steampowered.com/app/${appId}`,
        };
      },
    );
    return {
      topGroupTags: tagsToSearch,
      groupRecommendations: recommendationsResponse,
    };
  }
}
