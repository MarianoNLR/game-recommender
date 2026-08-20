export class AppDetailsDto {
  type: string;
  name: string;
  steam_appid: number;
  is_free: boolean;
  short_description: string;
  header_image: string;
  categories: { id: number; description: string }[];
  genres: { id: string; description: string }[];
  recommendations?: { total: number };
  metacritic?: { score: number };
  price_overview: {
    currency: string;
    initial: number;
    final: number;
    discount_percent: number;
    final_formatted: string;
  };
  release_date: {
    coming_soon: boolean;
    date: string;
  };
}
