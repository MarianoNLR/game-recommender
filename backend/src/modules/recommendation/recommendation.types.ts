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
  name: string;
  headerImage: string;
  shortDescription: string;
  price: number | null;
  formattedPrice: string | null;
  isFree: boolean;
  metacritic: number | null;
  storeUrl: string;
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
