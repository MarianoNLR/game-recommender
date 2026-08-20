export interface GetOwnedGamesResponse {
  response: {
    game_count: number;
    games: SteamGame[];
  };
}

export interface SteamPlayerSummaryResponse {
  response: {
    players: PlayerSummary[];
  };
}

export interface PlayerSummary {
  steamid: string;
  personaname: string;
  realname: string;
  avatar: string;
  avatarmedium: string;
  avatarfull: string;
  profileurl: string;
  personastate: number;
  lastlogoff: number;
  commentpermission: number;
  communityvisibilitystate: number;
}

export interface SteamGame {
  appid: number;
  name: string;
  playtime_forever: number;
  img_icon_url: string;
  content_descriptorids: number[] | undefined | null;
}

export interface SteamAppDetails {
  type: string;
  name: string;
  steam_appid: number;
  is_free: boolean;
  short_description: string;
  header_image: string;
  price_overview?: {
    currency: string;
    initial: number;
    final: number;
    discount_percent: number;
    final_formatted: string;
  };
  release_date?: {
    coming_soon: boolean;
    date: string;
  };
  recommendations?: {
    total: number;
  };
}

export type SteamAppDetailsMap = Record<number, SteamAppDetails>;

export interface SteamSpyGameTagsResponse {
  appid: number;
  name: string;
  tags: Record<string, number>;
}

export interface SteamSpyGame {
  appid: number;
  name: string;
}

export interface SteamStoreTag {
  tagid: number;
  name: string;
  count: number;
}

export interface SteamAppListItem {
  appid: number;
  name: string;
  last_modified: number;
  price_change_number: number;
}

export interface SteamAppListResponse {
  response: {
    apps: SteamAppListItem[];
    have_more_results?: boolean;
    last_appid?: number;
  };
}
