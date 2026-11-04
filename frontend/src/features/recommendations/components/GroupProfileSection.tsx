import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { UserAvatar } from '@/components/UserAvatar'
import type { CountedGame, GroupProfile, ProfileMember } from '../types'

const PLACEHOLDER_IMAGE = 'https://placehold.co/460x215?text=No+Image'

const gameImage = (game: CountedGame) =>
  game.imageUrl ??
  `https://cdn.akamai.steamstatic.com/steam/apps/${game.appId}/header.jpg`

function GameRow({ game }: { game: CountedGame }) {
  return (
    <li className="flex items-center gap-3">
      <img
        src={gameImage(game)}
        onError={(e) => {
          if (e.currentTarget.src !== PLACEHOLDER_IMAGE) {
            e.currentTarget.src = PLACEHOLDER_IMAGE
          }
        }}
        alt=""
        className="h-10 w-[86px] shrink-0 rounded object-cover"
      />
      <span className="text-foreground min-w-0 flex-1 truncate text-sm">
        {game.name}
      </span>
    </li>
  )
}

function MemberGames({ member }: { member: ProfileMember }) {
  return (
    <div className="bg-card space-y-3 rounded-lg p-4">
      <p className="text-foreground text-sm font-medium">
        Juegos que se tuvieron en cuenta para el perfil de {member.name}
      </p>
      {member.countedGames.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Ningún juego aportó al perfil.
        </p>
      ) : (
        <ul className="space-y-2">
          {member.countedGames.map((game) => (
            <GameRow key={game.appId} game={game} />
          ))}
        </ul>
      )}
    </div>
  )
}

function TagDetail({ tag, profile }: { tag: string; profile: GroupProfile }) {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const membersById = new Map(
    profile.members.map((member) => [member.steamId, member] as const),
  )

  // Miembros que aportaron a este tag, con los juegos de cada uno.
  const contributors = (
    profile.groupTagBreakdown.find((item) => item.tag === tag)?.members ?? []
  ).flatMap(({ steamId, games }) => {
    const member = membersById.get(steamId)

    return member ? [{ member, games }] : []
  })

  // Por defecto se muestra el primer miembro.
  const selected =
    contributors.find(({ member }) => member.steamId === selectedId) ??
    contributors[0]

  return (
    <div className="bg-card space-y-4 rounded-lg p-4">
      <div className="space-y-1">
        <p className="text-foreground text-sm font-medium">
          Juegos que aportaron a «{tag}»
        </p>
        <p className="text-muted-foreground text-xs">
          Elegí un miembro para ver sus juegos.
        </p>
      </div>

      {selected && (
        <>
          <div className="flex flex-wrap gap-2">
            {contributors.map(({ member }) => {
              const isSelected = member.steamId === selected.member.steamId

              return (
                <button
                  key={member.steamId}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setSelectedId(member.steamId)}
                  className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm ${
                    isSelected
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <UserAvatar
                    src={member.avatarUrl}
                    alt=""
                    className="h-5 w-5 rounded-full"
                  />
                  <span>{member.name}</span>
                </button>
              )
            })}
          </div>

          <ul className="space-y-2">
            {selected.games.map((game) => (
              <GameRow key={game.appId} game={game} />
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

export default function GroupProfileSection({
  profile,
}: {
  profile: GroupProfile
}) {
  const [openMemberId, setOpenMemberId] = useState<string | null>(null)
  const [openTag, setOpenTag] = useState<string | null>(null)

  const openMember = profile.members.find(
    (member) => member.steamId === openMemberId,
  )

  return (
    <div className="space-y-8">
      {profile.members.length > 0 && (
        <div className="space-y-3">
          <p className="text-muted-foreground text-sm font-medium">
            Miembros: {profile.members.length}
          </p>
          <div className="flex flex-wrap gap-2">
            {profile.members.map((member) => {
              const isOpen = member.steamId === openMemberId

              return (
                <button
                  key={member.steamId}
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpenMemberId(isOpen ? null : member.steamId)}
                  className="bg-muted text-muted-foreground hover:text-foreground flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm"
                >
                  <UserAvatar
                    src={member.avatarUrl}
                    alt=""
                    className="h-5 w-5 rounded-full"
                  />
                  <span>{member.name}</span>
                  <ChevronDown
                    className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  />
                </button>
              )
            })}
          </div>
          {openMember && <MemberGames member={openMember} />}
        </div>
      )}

      <div className="space-y-2">
        <p className="text-muted-foreground text-sm">Gustos del grupo</p>
        <div className="flex flex-wrap gap-2">
          {profile.topGroupTags.map((tag) => {
            const isOpen = tag === openTag

            return (
              <button
                key={tag}
                type="button"
                aria-pressed={isOpen}
                onClick={() => setOpenTag(isOpen ? null : tag)}
                className={`cursor-pointer rounded-md px-2 py-1 text-xs ${
                  isOpen
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                {tag}
              </button>
            )
          })}
        </div>
        {openTag && <TagDetail key={openTag} tag={openTag} profile={profile} />}
      </div>
    </div>
  )
}
