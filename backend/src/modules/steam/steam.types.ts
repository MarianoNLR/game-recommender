export interface SteamApiOwnedGameResponse {
  appid: number;
  name: string;
  playtime_forever: number;
  img_icon_url: string;
  playtime_windows_forever: number;
  playtime_mac_forever: number;
  playtime_linux_forever: number;
  playtime_deck_forever: number;
  rtime_last_played: number;
  content_descriptorids: number[] | undefined | null;
  playtime_disconnected: number;
}

export interface SteamApiResponse {
  response: {
    game_count: number;
    games: SteamApiOwnedGameResponse[];
  };
}

export interface SteamPlayerSummaryResponse {
  response: {
    players: SteamPlayerSummaryRs[];
  };
}

export interface SteamPlayerSummaryRs {
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
}
