import { SteamAppDetails, OwnedGame } from '../steam/steam.types';

export interface MemberProfile {
  steamId: string;
  name: string;
  avatarUrl: string | null;
  games: OwnedGame[];
  topGames: OwnedGame[];
}

// Un juego que sí se tuvo en cuenta para el perfil de un miembro.
export interface CountedGame {
  appId: number;
  name: string;
  imageUrl: string | null;
  // Peso en el perfil del miembro (0 a 1): sus minutos sobre el total de los
  // juegos que contaron. No se exponen los minutos.
  share: number;
  // Tags relevantes que recibieron peso de este juego.
  tags: string[];
}

export interface MemberTagProfile {
  tagScores: Record<string, number>;
  topTags: string[];
  countedGames: CountedGame[];
}

export type MemberProfileWithTags = MemberProfile & MemberTagProfile;

export interface GameRecommendation {
  appId: number;
  steamAppId: number;
  score: number;
  // tagScore: number;

  reviewPercentage: number;
  reviewCount: number;
  // reviewScore: number;
  // reviewBonus: number;

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

export interface GroupTagContribution {
  tag: string;
  members: { steamId: string; games: CountedGame[] }[];
}

// Lo que se muestra del perfil del grupo: sin biblioteca completa ni minutos.
export interface GroupProfileSummary {
  group: { name: string; accessCode: string; budget: number | null };
  members: {
    steamId: string;
    name: string;
    avatarUrl: string | null;
    topTags: string[];
    countedGames: CountedGame[];
  }[];
  topGroupTags: string[];
  groupTagBreakdown: GroupTagContribution[];
}
