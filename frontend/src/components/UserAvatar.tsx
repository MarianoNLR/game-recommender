const FALLBACK_AVATAR = `${import.meta.env.BASE_URL}default-avatar.svg`

type UserAvatarProps = {
  src?: string | null
  alt: string
  className?: string
}

// El avatar viene de una URL de Steam que puede faltar o dejar de existir
// (por ejemplo, si el usuario cambió la foto después de guardarla en la caché).
export function UserAvatar({ src, alt, className }: UserAvatarProps) {
  return (
    <img
      src={src || FALLBACK_AVATAR}
      alt={alt}
      className={className}
      onError={(e) => {
        if (!e.currentTarget.src.endsWith(FALLBACK_AVATAR)) {
          e.currentTarget.src = FALLBACK_AVATAR
        }
      }}
    />
  )
}
