import { SteamAppDetails, SteamGame } from '../steam/steam.types';

export interface MemberProfile {
  steamId: string;
  name: string;
  avatarUrl: string;
  games: SteamGame[];
  topGames: SteamGame[];
}

export interface MemberTagProfile {
  tagScores: Record<string, number>;
  topTags: string[];
}

export type MemberProfileWithTags = MemberProfile & MemberTagProfile;

export interface GameRecommendation {
  appId: number;
  steamAppId: number;
  score: number;
  tagScore: number;

  reviewPercentage: number;
  reviewCount: number;
  reviewScore: number;
  reviewBonus: number;

  name: string;

  price: number | null;
  formattedPrice: string | null;
  isFree: boolean;

  storeUrl: string;

  matchedTags: MatchedTag[];
  matchedTagCount: number;
}

export interface MatchedTag {
  tag: string;
  groupScore: number;
  memberCount: number;
}

export interface GroupRecommendationResponse {
  paidRecommendations: GameRecommendation[];
  freeRecommendations: GameRecommendation[];
}

export interface GameCandidate {
  appId: number;
  steamAppId: number | null;
  name: string | null;
  tags: Record<string, number> | null;

  tagScore: number;
  matchScore?: number;
  finalScore?: number;
}
