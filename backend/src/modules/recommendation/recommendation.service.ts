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
import { GameDetailsResponse } from '../game/game.types';
import {
  EXCLUDED_PROFILE_TAGS,
  REQUIRED_MULTIPLAYER_TAGS,
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
      .slice(0, 20);
    return { tagScores, topTags };
  }

  async getGroupTagProfile(memberProfiles: MemberProfileWithTags[]) {
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
      .slice(0, 20);

    console.log('Unique group tags:', Object.keys(groupTagScores).length);

    console.log('Group tags:', groupTagScores);

    console.log('Top group tags count:', topGroupTags.length);

    return { groupTagScores, topGroupTags };
  }

  async getGroupRecommendations(accessCode: string) {
    console.time('Get Recommendations');
    // This method will generate game recommendations for the group based on the provided access code.
    const { group, memberProfiles, groupTagScores, topGroupTags } =
      await this.getGroupProfile(accessCode);

    // Group Top Tags to search in steamspy
    const tagsToSearch = topGroupTags.slice(0, 15);
    console.log('Tags to search:', tagsToSearch);

    const recommendationsResponse: GroupRecommendationResponse = {
      paidRecommendations: [],
      freeRecommendations: [],
    };
    // Set with group's owned games
    const ownedAppIds = new Set<number>();
    memberProfiles.forEach(({ games }) => {
      games.forEach((game) => ownedAppIds.add(game.appid));
    });

    const candidates = (await this.gameService.getAppsByTags(tagsToSearch))
      .filter((game) => !ownedAppIds.has(game.appId))
      .map((game) => {
        const relevantTags = this.getRelevantTags(
          (game.tags as Record<string, number>) ?? {},
        );

        const tagScore = tagsToSearch.reduce((score, tag, index) => {
          if (relevantTags[tag] !== undefined) {
            return score + (tagsToSearch.length - index);
          }

          return score;
        }, 0);

        const matchScore = this.calculateMatchScore(
          groupTagScores,
          relevantTags,
        );

        return {
          ...game,
          relevantTags,
          tagScore,
          matchScore,
          finalScore: matchScore * 0.4 + tagScore * 0.6,
        };
      })
      .sort((a, b) => b.finalScore - a.finalScore);
    const recommendedSteamAppIds = new Set<number>();
    for (const candidate of candidates) {
      if (recommendedSteamAppIds.size >= 40) {
        break;
      }
      const appId = candidate.appId;
      const finalScore = candidate.finalScore;

      const details = await this.steamService
        .getAppsDetails([appId])
        .then((map) => map[appId]);

      if (!details) {
        console.log(`Rejected: No details | AppId: ${appId}`);
        continue;
      }

      // Validations
      const candidateRejection = this.validateCandidate(
        details,
        candidate.relevantTags,
      );

      if (candidateRejection) {
        console.log(
          `Rejected: ${candidateRejection} | AppId: ${appId} | score: ${finalScore}`,
        );
        continue;
      }

      // Avoid duplicates in recommendations by checking if the game has already been recommended based on its Steam App ID.
      if (recommendedSteamAppIds.has(details.steamAppId)) {
        console.log(`Rejected: Already recommended | AppId: ${appId}`);
        continue;
      }

      // Free games are treated differently. +
      // If the game is free, it is added to the free recommendations list if there is space (less than 20 recommendations).
      // Otherwise, it is skipped.
      if (details.isFree) {
        if (recommendationsResponse.freeRecommendations.length < 20) {
          recommendationsResponse.freeRecommendations.push(
            this.buildRecommendation(appId, finalScore || 0, details),
          );
          recommendedSteamAppIds.add(details.steamAppId);
        }

        continue;
      }

      // Validations for paid games.
      const paidRejection = this.validatePaidGame(details, group.budget);

      if (paidRejection) {
        console.log(
          `Rejected: ${paidRejection} | AppId: ${appId} | score: ${finalScore}`,
        );
        continue;
      }

      console.count('Recommendation found!');

      if (recommendationsResponse.paidRecommendations.length >= 20) {
        continue;
      }

      recommendationsResponse.paidRecommendations.push(
        this.buildRecommendation(appId, finalScore || 0, details),
      );
      recommendedSteamAppIds.add(details.steamAppId);
    }
    // console.log({ recommendations: recommendationsResponse });
    console.timeEnd('Get Recommendations');
    console.log('Recommendations found at candidate positions:');

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
      topGroupTags: topGroupTags,
      groupRecommendations: recommendationsResponse,
      groupTagScores,
    };
  }

  private validateCandidate(
    details: GameDetailsResponse,
    relevantTags: Record<string, number> = {},
  ): string | null {
    const hasMultiplayerTag = Object.keys(relevantTags).some((tag) =>
      REQUIRED_MULTIPLAYER_TAGS.has(tag),
    );

    if (!hasMultiplayerTag) return 'No multiplayer tag';

    if (Object.keys(relevantTags).some((tag) => EXCLUDED_GAME_TAGS.has(tag))) {
      return (
        'Has excluded tag: ' +
        Object.keys(relevantTags).find((tag) => EXCLUDED_GAME_TAGS.has(tag))
      );
    }

    if (details.type !== 'game') return 'Not a game';

    return null;
  }

  private validatePaidGame(
    details: GameDetailsResponse,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    budget: number | null,
  ): string | null {
    if (details.price == null) {
      return 'No price';
    }
    // if (budget != null && details.price / 100 > budget) {
    //   return 'Price greater than budget';
    // }

    if (details.recommendations?.total == null) {
      return 'No recommendation data';
    }

    if (details.recommendations.total < 5000) {
      return 'Not enough Steam recommendations';
    }

    return null;
  }

  private buildRecommendation(
    appId: number,
    score: number,
    details: GameDetailsResponse,
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
    };
  }
  private calculateMatchScore(
    groupTagScores: Record<string, number>,
    gameTags: Record<string, number>,
  ): number {
    const totalGroupScore = Object.values(groupTagScores).reduce(
      (a, b) => a + b,
      0,
    );
    const totalGameVotes = Object.values(gameTags).reduce((a, b) => a + b, 0);

    if (totalGroupScore === 0 || totalGameVotes === 0) return 0;

    let score = 0;

    for (const [tag, gameVotes] of Object.entries(gameTags)) {
      if (!groupTagScores[tag]) continue;

      // How representative this tag is for the group
      const groupWeight = groupTagScores[tag] / totalGroupScore;

      // How representative this tag is for the game
      const gameWeight = gameVotes / totalGameVotes;

      // Both has to be representative for the group and the game to have a high score.
      score += groupWeight * gameWeight;
    }

    return score;
  }

  private getRelevantTags(
    tags: Record<string, number>,
    topN: number = 10,
  ): Record<string, number> {
    const total = Object.values(tags).reduce((a, b) => a + b, 0);

    return Object.fromEntries(
      Object.entries(tags)
        .map(([tag, votes]) => [tag, votes / total] as [string, number])
        .sort(([, a], [, b]) => b - a)
        .slice(0, topN),
    );
  }
}
