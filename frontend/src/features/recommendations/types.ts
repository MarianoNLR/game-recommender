// Juego que se tuvo en cuenta para el perfil de un miembro.
export interface CountedGame {
  appId: number
  name: string
  imageUrl: string | null
  // Peso en el perfil de su dueño (0 a 1).
  share: number
  tags: string[]
}

export interface ProfileMember {
  steamId: string
  name: string
  avatarUrl: string | null
  topTags: string[]
  countedGames: CountedGame[]
}

export interface TagContribution {
  tag: string
  members: { steamId: string; games: CountedGame[] }[]
}

export interface GroupProfile {
  group: { name: string; accessCode: string; budget: number | null }
  members: ProfileMember[]
  topGroupTags: string[]
  groupTagBreakdown: TagContribution[]
}
