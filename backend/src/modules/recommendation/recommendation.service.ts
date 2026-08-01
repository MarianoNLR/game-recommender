import { BadRequestException, Injectable } from '@nestjs/common';
import { SteamService } from '../steam/steam.service';
import { GroupsService } from '../groups/groups.service';
import { SteamGame } from '../steam/steam.types';
import {
  MemberProfile,
  MemberProfileWithTags,
  MemberTagProfile,
} from './recommendation.types';
import { GameRecommendationResponse } from '../game/game.types';
import {
  EXCLUDED_PROFILE_TAGS,
  REQUIRED_MULTIPLAYER_TAGS,
} from './recommendation.constants';

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
    console.log('Group:', group);
    //const groupSteamIds = group.memberSteamIds.map((steamId) => steamId);
    //console.log('Group Steam IDs:', groupSteamIds);

    const memberProfiles = await Promise.all(
      group.memberSteamIds.map(async (steamId) => {
        const profile = await this.getMemberProfile(steamId);
        const tagProfile = await this.getMemberTagProfile(
          steamId,
          profile.topGames,
        );
        return { ...profile, ...tagProfile };
      }),
    );
    console.log('Member Profiles:', memberProfiles);
    const { groupTagScores, topGroupTags } =
      this.getGroupTagProfile(memberProfiles);
    return {
      group,
      memberProfiles,
      groupTagScores,
      topGroupTags,
    };
  }

  async getMemberProfile(steamId: string): Promise<MemberProfile> {
    const games: SteamGame[] = await this.steamService.getOwnedGames(steamId);
    const playerSummaries = await this.steamService.getPlayerSummaries([
      steamId,
    ]);
    const player = playerSummaries[0];

    if (!games || games.length === 0) {
      throw new BadRequestException(`No games found for Steam ID: ${steamId}`);
    }

    const topGames = games
      .sort((a, b) => (b.playtime_forever || 0) - (a.playtime_forever || 0))
      .slice(0, 10);

    return {
      steamId,
      name: player.personaname,
      avatarUrl: player.avatarmedium,
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
        if (EXCLUDED_PROFILE_TAGS.has(tag)) return;

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

  async getGroupRecommendations(accessCode: string) {
    // This method will generate game recommendations for the group based on the provided access code.
    const { group, memberProfiles, groupTagScores, topGroupTags } =
      await this.getGroupProfile(accessCode);

    // Group Top Tags to search in steamspy
    const tagsToSearch = topGroupTags.slice(0, 10);

    // Search games by tag
    const candidatesByTag = await Promise.all(
      tagsToSearch.map((tag) => {
        const result = this.steamService.getAppsByTag(tag);
        return result;
      }),
    );

    // Count weight of each candidate using index of tag.
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

    const candidates = Object.entries(appearances)
      .filter(([appId]) => !ownedAppIds.has(Number(appId)))
      .sort(([, a], [, b]) => b - a);

    const recommendationsResponse: GameRecommendationResponse[] = [];
    let cont = 0;
    for (const [appIdStr, tagMatches] of candidates) {
      const appId = Number(appIdStr);

      const tags = await this.steamService.getAppTags([appId]);

      const gameTags = tags[appId] ?? {};

      const hasMultiplayerTag = Object.keys(gameTags).some((tag) =>
        REQUIRED_MULTIPLAYER_TAGS.has(tag),
      );

      if (!hasMultiplayerTag) {
        continue;
      }

      const detailsMap = await this.steamService.getAppsDetails([appId]);
      const details = detailsMap[appId];
      cont = cont + 1;
      console.log('Search number: ', cont);
      if (details.type !== 'game') continue;

      if (!details) continue;

      // If the game is free, discard (at the moment)
      if (details.isFree) {
        continue;
      }

      // If has no price, discard
      if (details.price == null) continue;

      // If price is greater than group budget, discard
      if (group.budget != null && details.price / 100 > group.budget) {
        continue;
      }

      if (details.recommendations?.total == null) {
        continue;
      }

      if (details.recommendations?.total < 10000) {
        continue;
      }
      recommendationsResponse.push({
        appId,
        score: tagMatches,
        name: details.name,
        headerImage: details.headerImage,
        shortDescription: details.shortDescription,
        price: details.price,
        formattedPrice:
          details.price != null ? `$${(details.price / 100).toFixed(2)}` : null,
        isFree: details.isFree,
        metacritic: details.recommendations?.total ?? null,
        storeUrl: `https://store.steampowered.com/app/${appId}`,
      });
      console.log('Recommendation found!', recommendationsResponse.length);

      if (recommendationsResponse.length === 20) {
        break;
      }
    }

    console.log({ recommendations: recommendationsResponse });
    return {
      group: {
        name: group.name,
        accessCode: group.accessCode,
        budget: group.budget,
        members: memberProfiles.map(({ steamId, name, avatarUrl }) => ({
          steamId,
          name,
          avatarUrl,
        })),
      },
      topGroupTags: tagsToSearch,
      groupRecommendations: recommendationsResponse,
      groupTagScores,
    };
  }
}
