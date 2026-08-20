import { BadRequestException, Injectable } from '@nestjs/common';
import { SteamService } from '../steam/steam.service';
import { GroupsService } from '../groups/groups.service';
import { SteamGame } from '../steam/steam.types';
import {
  GameRecommendation,
  GroupRecommendationResponse,
  MemberProfile,
  MemberProfileWithTags,
  MemberTagProfile,
} from './recommendation.types';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { GameDetailsResponse } from '../game/game.types';
import {
  EXCLUDED_PROFILE_TAGS,
  REQUIRED_MULTIPLAYER_TAGS,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  EXCLUDED_GAME_TAGS,
} from './recommendation.constants';
import { GameService } from '../game/game.service';

@Injectable()
export class RecommendationService {
  constructor(
    private steamService: SteamService,
    private groupsService: GroupsService,
    private gameService: GameService,
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

    const { groupTagScores, topGroupTags } =
      await this.getGroupTagProfile(memberProfiles);
    return {
      group,
      memberProfiles,
      groupTagScores,
      topGroupTags,
    };
  }

  // 1. Individual member profile with games and member info.
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
      .slice(0, 20);

    return {
      steamId,
      name: player.personaname,
      avatarUrl: player.avatarmedium,
      games,
      topGames,
    };
  }

  // 2. Get most played tags from a member.
  async getMemberTagProfile(
    steamId: string,
    topGames: SteamGame[],
  ): Promise<MemberTagProfile> {
    const appIds = topGames.map((game) => game.appid);

    const games = await this.gameService.findTagsByAppIds(appIds);

    const tagsByAppId = Object.fromEntries(
      games.map((game) => [
        game.steamAppId,
        game.tags.map(({ tag }) => tag.name),
      ]),
    );

    const tagScores: Record<string, number> = {};

    topGames.forEach((game) => {
      const tags = tagsByAppId[game.appid] ?? [];

      const relevantTags = tags.filter(
        (tag) => !EXCLUDED_PROFILE_TAGS.has(tag),
      );

      if (relevantTags.length === 0) {
        return;
      }

      const playtime = game.playtime_forever ?? 0;
      const weightPerTag = 1 / relevantTags.length;

      relevantTags.forEach((tag) => {
        tagScores[tag] = (tagScores[tag] ?? 0) + playtime * weightPerTag;
      });
    });

    const totalScore = Object.values(tagScores).reduce(
      (sum, score) => sum + score,
      0,
    );

    const normalizedTagScores: Record<string, number> = Object.fromEntries(
      Object.entries(tagScores).map(([tag, score]) => [
        tag,
        totalScore > 0 ? score / totalScore : 0,
      ]),
    );

    const topTags = Object.entries(normalizedTagScores)
      .sort(([, a], [, b]) => b - a)
      .map(([tag]) => tag)
      .slice(0, 20);

    return {
      tagScores: normalizedTagScores,
      topTags,
    };
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async getGroupTagProfile(memberProfiles: MemberProfileWithTags[]) {
    const groupTagScores: Record<
      string,
      { memberCount: number; score: number }
    > = {};

    memberProfiles.forEach(({ tagScores }) => {
      Object.entries(tagScores).forEach(([tag, score]) => {
        if (!groupTagScores[tag]) {
          groupTagScores[tag] = {
            memberCount: 0,
            score: 0,
          };
        }

        groupTagScores[tag].memberCount += 1;
        groupTagScores[tag].score += score;
      });
    });

    const topGroupTags = Object.entries(groupTagScores)
      .sort(([, a], [, b]) => {
        if (b.memberCount !== a.memberCount) {
          return b.memberCount - a.memberCount;
        }

        return b.score - a.score;
      })
      .map(([tag]) => tag)
      .slice(0, 20);

    console.log('Unique group tags:', Object.keys(groupTagScores).length);
    console.log('Group tags:', groupTagScores);
    console.log('Top group tags count:', topGroupTags.length);

    return {
      groupTagScores,
      topGroupTags,
    };
  }

  async getGroupRecommendations(accessCode: string) {
    console.time('Get Recommendations');

    const { group, memberProfiles, groupTagScores, topGroupTags } =
      await this.getGroupProfile(accessCode);
    const tagIdf = await this.gameService.getNormalizedTagIdf();
    const tagsToSearch = topGroupTags;

    console.log('Tags to search:', tagsToSearch);

    const recommendationsResponse: GroupRecommendationResponse = {
      paidRecommendations: [],
      freeRecommendations: [],
    };

    const ownedAppIds = new Set<number>();

    memberProfiles.forEach(({ games }) => {
      games.forEach((game) => {
        ownedAppIds.add(game.appid);
      });
    });

    const games = await this.gameService.findCandidatesByTags(
      tagsToSearch,
      [...REQUIRED_MULTIPLAYER_TAGS],
      group.budget || 0,
    );

    const candidates = games
      .filter((game) => !ownedAppIds.has(game.steamAppId))
      .map((game) => {
        const relevantTags = new Set(
          game.tags
            .map(({ tag }) => tag.name)
            .filter((tag) => !EXCLUDED_PROFILE_TAGS.has(tag)),
        );

        const { finalScore, matchedTags, matchedTagCount } =
          this.calculateMatchScore(groupTagScores, relevantTags, tagIdf);

        return {
          ...game,
          relevantTags,
          finalScore,
          matchedTags,
          matchedTagCount,
        };
      })
      .sort((a, b) => b.finalScore - a.finalScore);

    for (const candidate of candidates) {
      const paidFull =
        recommendationsResponse.paidRecommendations.length >= 100;

      const freeFull =
        recommendationsResponse.freeRecommendations.length >= 100;

      if (paidFull && freeFull) {
        break;
      }

      if (candidate.isFree) {
        if (!freeFull) {
          recommendationsResponse.freeRecommendations.push(
            this.buildRecommendation(
              candidate.steamAppId,
              candidate.finalScore,
              candidate,
            ),
          );
        }

        continue;
      }

      const paidRejection = this.validatePaidGame(candidate, group.budget);

      if (paidRejection) {
        console.log(
          `Rejected: ${paidRejection} | AppId: ${candidate.steamAppId} | Score: ${candidate.finalScore}`,
        );

        continue;
      }

      if (paidFull) {
        continue;
      }

      recommendationsResponse.paidRecommendations.push(
        this.buildRecommendation(
          candidate.steamAppId,
          candidate.finalScore,
          candidate,
        ),
      );

      console.count('Recommendation found!');
    }

    console.timeEnd('Get Recommendations');

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
      topGroupTags,
      groupRecommendations: recommendationsResponse,
      groupTagScores,
    };
  }

  private validatePaidGame(
    details: any,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    budget: number | null,
  ): string | null {
    if (details.price == null) {
      return 'No price';
    }
    // if (budget != null && details.price / 100 > budget) {
    //   return 'Price greater than budget';
    // }

    // if (details.recommendations?.total == null) {
    //   return 'No recommendation data';
    // }

    // if (details.recommendations.total < 5000) {
    //   return 'Not enough Steam recommendations';
    // }

    return null;
  }

  private buildRecommendation(
    appId: number,
    score: number,
    details: any,
  ): GameRecommendation {
    return {
      appId,
      steamAppId: details.steamAppId,
      score,
      name: details.name,
      headerImage: details.headerImage,
      shortDescription: details.shortDescription,
      price: details.price,
      formattedPrice:
        details.price != null ? `$${(details.price / 100).toFixed(2)}` : null,
      isFree: details.isFree,
      metacritic: details.recommendations?.total ?? null,
      storeUrl: `https://store.steampowered.com/app/${appId}`,

      matchedTags: details.matchedTags ?? [],
      matchedTagCount: details.matchedTagCount ?? 0,
    };
  }

  // private calculateMatchScore(
  //   groupTagScores: Record<
  //     string,
  //     {
  //       memberCount: number;
  //       score: number;
  //     }
  //   >,
  //   gameTags: Set<string>,
  // ): number {
  //   return Object.entries(groupTagScores).reduce((total, [tag, groupTag]) => {
  //     if (!gameTags.has(tag)) {
  //       return total;
  //     }

  //     return total + groupTag.score;
  //   }, 0);
  // }

  private calculateMatchScore(
    groupTagScores: Record<
      string,
      {
        memberCount: number;
        score: number;
      }
    >,
    gameTags: Set<string>,
    tagIdf: Record<string, number>,
  ) {
    const matchedTags: {
      tag: string;
      groupScore: number;
      memberCount: number;
      idf: number;
      weightedScore: number;
    }[] = [];

    let finalScore = 0;

    for (const [tag, groupTag] of Object.entries(groupTagScores)) {
      if (!gameTags.has(tag)) {
        continue;
      }

      const idf = tagIdf[tag] ?? 0;

      const weightedScore = groupTag.score * idf;

      finalScore += weightedScore;

      matchedTags.push({
        tag,
        groupScore: groupTag.score,
        memberCount: groupTag.memberCount,
        idf,
        weightedScore,
      });
    }

    matchedTags.sort((a, b) => b.weightedScore - a.weightedScore);

    return {
      finalScore,
      matchedTags,
      matchedTagCount: matchedTags.length,
    };
  }

  // private getRelevantTags(
  //   tags: Record<string, number>,
  //   topN: number = 10,
  // ): Record<string, number> {
  //   const total = Object.values(tags).reduce((a, b) => a + b, 0);

  //   return Object.fromEntries(
  //     Object.entries(tags)
  //       .map(([tag, votes]) => [tag, votes / total] as [string, number])
  //       .sort(([, a], [, b]) => b - a)
  //       .slice(0, topN),
  //   );
  // }
}
