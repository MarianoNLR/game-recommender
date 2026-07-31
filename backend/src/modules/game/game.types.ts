export interface GameDetailsCache {
  type: string;
  isFree: boolean;
  shortDescription: string;
  headerImage: string;
  recommendations?: {
    total: number;
  };
}

export interface GameDetailsResponse extends GameDetailsCache {
  appId: number;
  name: string;
  price: number | null;
}

export type GameDetailsResponseMap = Record<number, GameDetailsResponse>;

export interface GameRecommendationResponse {
  appId: number;
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
