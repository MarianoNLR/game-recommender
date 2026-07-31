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
  score: number;
  name: string;
  headerImage: string;
  shortDescription: string;
  price: string | null;
  isFree: boolean;
  metacritic: number | null;
  storeUrl: string;
}

export interface GroupRecommendationResponse {
  topGroupTags: string[];
  groupRecommendations: GameRecommendation[];
}
