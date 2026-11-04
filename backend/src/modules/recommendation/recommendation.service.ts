import { BadRequestException, Injectable } from '@nestjs/common';
import { SteamProfileService } from '../steam/steam-profile.service';
import { GroupsService } from '../groups/groups.service';
import { OwnedGame } from '../steam/steam.types';
import { MIN_PLAYTIME_MINUTES } from '../steam/steam.constants';
import {
  GameRecommendation,
  GroupRecommendationResponse,
  MemberProfile,
  MemberProfileWithTags,
  MemberTagProfile,
  CountedGame,
  GroupProfileSummary,
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

const REVIEW_WEIGHT = 0.15;

@Injectable()
export class RecommendationService {
  constructor(
    private steamProfileService: SteamProfileService,
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

  // Perfil del grupo para mostrar en pantalla: qué juegos de cada miembro se
  // tuvieron en cuenta y qué aportó cada uno a los tags del grupo. No incluye
  // la biblioteca completa ni los minutos jugados.
  async getGroupProfileSummary(
    accessCode: string,
  ): Promise<GroupProfileSummary> {
    const { group, memberProfiles, topGroupTags } =
      await this.getGroupProfile(accessCode);

    return {
      group: {
        name: group.name,
        accessCode: group.accessCode,
        budget: group.budget,
      },
      members: memberProfiles.map(
        ({ steamId, name, avatarUrl, topTags, countedGames }) => ({
          steamId,
          name,
          avatarUrl,
          topTags,
          countedGames,
        }),
      ),
      topGroupTags,
      groupTagBreakdown: topGroupTags.map((tag) => ({
        tag,
        members: memberProfiles
          .map(({ steamId, countedGames }) => ({
            steamId,
            games: countedGames.filter((game) => game.tags.includes(tag)),
          }))
          .filter(({ games }) => games.length > 0),
      })),
    };
  }

  // 1. Individual member profile with games and member info.
  // Viene del perfil cacheado (ver SteamProfileService), no siempre de Steam.
  async getMemberProfile(steamId: string): Promise<MemberProfile> {
    const profile = await this.steamProfileService.getProfile(steamId);

    const games = profile.games.filter(
      (game) => (game.playtime_forever || 0) >= MIN_PLAYTIME_MINUTES,
    );

    if (games.length === 0) {
      throw new BadRequestException(`No games found for Steam ID: ${steamId}`);
    }

    const topGames = [...games]
      .sort((a, b) => (b.playtime_forever || 0) - (a.playtime_forever || 0))
      .slice(0, 20);

    return {
      steamId,
      name: profile.name,
      avatarUrl: profile.avatarUrl,
      games,
      topGames,
    };
  }

  // 2. Get most played tags from a member.
  async getMemberTagProfile(
    steamId: string,
    topGames: OwnedGame[],
  ): Promise<MemberTagProfile> {
    const appIds = topGames.map((game) => game.appid);

    const games = await this.gameService.findTagsByAppIds(appIds);

    const tagsByAppId = Object.fromEntries(
      games.map((game) => [
        game.steamAppId,
        game.tags.map(({ tag }) => tag.name),
      ]),
    );

    const gameInfoByAppId = new Map(
      games.map((game) => [game.steamAppId, game] as const),
    );

    // Juegos que sí aportaron al perfil (están en la base y tienen tags relevantes).
    const counted: (Omit<CountedGame, 'share'> & { playtime: number })[] = [];

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

      const info = gameInfoByAppId.get(game.appid);

      counted.push({
        appId: game.appid,
        name: info?.name ?? `#${game.appid}`,
        imageUrl: info?.imageUrl ?? null,
        playtime,
        tags: relevantTags,
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

    // totalScore es la suma de minutos de los juegos que contaron.
    const countedGames: CountedGame[] = counted
      .map(({ playtime, ...game }) => ({
        ...game,
        share: totalScore > 0 ? playtime / totalScore : 0,
      }))
      .sort((a, b) => b.share - a.share);

    return {
      tagScores: normalizedTagScores,
      topTags,
      countedGames,
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

    const recommendationsResponse = {
      paidRecommendations: [] as any[],
      freeRecommendations: [] as any[],
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
        const relevantTags = new Map(
          game.tags
            .filter(({ tag }) => !EXCLUDED_PROFILE_TAGS.has(tag.name))
            .map(({ tag, weight }) => [tag.name, weight]),
        );

        const match = this.calculateMatchScore(
          groupTagScores,
          relevantTags,
          tagIdf,
        );

        const reviewScore = this.calculateReviewScore(
          game.reviewPercentage,
          game.reviewCount,
        );

        const reviewBonus = reviewScore * REVIEW_WEIGHT;

        const finalScore = match.finalScore + reviewBonus;

        return {
          appId: game.steamAppId,
          steamAppId: game.steamAppId,

          score: finalScore,
          tagScore: match.finalScore,

          reviewPercentage: game.reviewPercentage,
          reviewCount: game.reviewCount,
          // reviewScore,
          // reviewBonus,

          name: game.name,
          price: game.price,
          isFree: game.isFree,

          matchedTags: match.matchedTags,
          matchedTagCount: match.matchedTagCount,
        };
      })
      .sort((a, b) => b.score - a.score);

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
            this.buildRecommendation(candidate),
          );
        }

        continue;
      }

      // const paidRejection = this.validatePaidGame(candidate, group.budget);

      // if (paidRejection) {
      //   console.log(
      //     `Rejected: ${paidRejection} | AppId: ${candidate.steamAppId} | Score: ${candidate.score}`,
      //   );

      //   continue;
      // }

      if (paidFull) {
        continue;
      }

      recommendationsResponse.paidRecommendations.push(
        this.buildRecommendation(candidate),
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

  // private validatePaidGame(
  //   details: any,
  //   // eslint-disable-next-line @typescript-eslint/no-unused-vars
  //   budget: number | null,
  // ): string | null {
  //   if (details.price == null) {
  //     return 'No price';
  //   }
  //   // if (budget != null && details.price / 100 > budget) {
  //   //   return 'Price greater than budget';
  //   // }

  //   // if (details.recommendations?.total == null) {
  //   //   return 'No recommendation data';
  //   // }

  //   // if (details.recommendations.total < 5000) {
  //   //   return 'Not enough Steam recommendations';
  //   // }

  //   return null;
  // }

  private buildRecommendation(candidate: any): GameRecommendation {
    return {
      appId: candidate.steamAppId,
      steamAppId: candidate.steamAppId,

      score: candidate.score,
      // tagScore: candidate.tagScore,

      reviewPercentage: candidate.reviewPercentage,
      reviewCount: candidate.reviewCount,
      // reviewScore: candidate.reviewScore,
      // reviewBonus: candidate.reviewBonus,

      name: candidate.name,
      price: candidate.price,
      formattedPrice:
        candidate.price != null
          ? `$${(candidate.price / 100).toFixed(2)}`
          : null,
      isFree: candidate.isFree,
      storeUrl: `https://store.steampowered.com/app/${candidate.appId}`,

      matchedTags: candidate.matchedTags,
      matchedTagCount: candidate.matchedTagCount,
    };
  }

  private calculateMatchScore(
    groupTagScores: Record<
      string,
      {
        memberCount: number;
        score: number;
      }
    >,
    gameTags: Map<string, number>,
    tagIdf: Record<string, number>,
  ) {
    const matchedTags: {
      tag: string;
      groupScore: number;
      memberCount: number;
      idf: number;
      gameWeight: number;
      normalizedGameWeight: number;
      weightedScore: number;
    }[] = [];

    let finalScore = 0;

    const weights = [...gameTags.values()];

    const maxWeight = weights.length > 0 ? Math.max(...weights) : 0;

    for (const [tag, groupTag] of Object.entries(groupTagScores)) {
      const gameWeight = gameTags.get(tag);

      if (gameWeight === undefined) {
        continue;
      }

      const idf = tagIdf[tag] ?? 0;

      const normalizedGameWeight = maxWeight > 0 ? gameWeight / maxWeight : 0;

      const weightedScore = groupTag.score * idf * normalizedGameWeight;

      finalScore += weightedScore;

      matchedTags.push({
        tag,
        groupScore: groupTag.score,
        memberCount: groupTag.memberCount,
        idf,
        gameWeight,
        normalizedGameWeight,
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

  private calculateReviewScore(
    reviewPercentage: number | null,
    reviewCount: number | null,
  ) {
    if (reviewPercentage == null || reviewCount == null || reviewCount <= 0) {
      return 0;
    }

    const quality = reviewPercentage / 100;

    const confidence = Math.min(Math.log10(reviewCount + 1) / 5, 1);

    return quality * confidence;
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
