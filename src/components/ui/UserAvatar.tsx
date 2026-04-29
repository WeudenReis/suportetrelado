import { useEffect, useState, useSyncExternalStore } from 'react'
import { getAvatarSignedUrl } from '../../lib/api/userAvatars'

interface Props {
  name: string
  avatarColor?: string | null
  avatarUrl?: string | null
  size?: number
  fontSize?: number
  borderRadius?: number
  boxShadow?: string
  className?: string
  style?: React.CSSProperties
  title?: string
}

const TTL_MS = 50 * 60 * 1000 // 50 min — signed URLs expiram em 60 min

interface CacheEntry { url: string; ts: number }
const cache = new Map<string, CacheEntry>()
const inflight = new Map<string, Promise<void>>()
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
function emit() { listeners.forEach(l => l()) }

function ensureFetched(path: string) {
  if (cache.has(path) || inflight.has(path)) return
  const p = getAvatarSignedUrl(path).then(url => {
    if (url) {
      cache.set(path, { url, ts: Date.now() })
      emit()
    }
  }).finally(() => {
    inflight.delete(path)
  })
  inflight.set(path, p)
}

/**
 * Avatar reutilizável. Se `avatarUrl` (path do bucket `avatars`) estiver
 * presente, gera signed URL e renderiza a imagem; senão cai no fallback
 * de iniciais sobre o `avatarColor`.
 */
export default function UserAvatar({
  name,
  avatarColor,
  avatarUrl,
  size = 32,
  fontSize,
  borderRadius,
  boxShadow,
  className,
  style,
  title,
}: Props) {
  const isDirect = !!avatarUrl && /^(https?:|data:|blob:)/i.test(avatarUrl)
  const bucketPath = !isDirect && avatarUrl ? avatarUrl : null

  // Snapshot reativo do cache de signed URLs
  const cached = useSyncExternalStore(
    subscribe,
    () => bucketPath ? cache.get(bucketPath)?.url ?? null : null,
    () => null,
  )

  // Garante que paths de bucket sejam buscados (efeito puro de side-effect externo)
  useEffect(() => {
    if (!bucketPath) return
    const entry = cache.get(bucketPath)
    if (entry && Date.now() - entry.ts >= TTL_MS) {
      cache.delete(bucketPath) // expirado: força nova busca
    }
    ensureFetched(bucketPath)
  }, [bucketPath])

  const resolvedUrl = isDirect ? avatarUrl! : cached

  // Reset de errored é feito via key do <img>; nada de setState reativo aqui.
  const [errored, setErrored] = useState<string | null>(null)
  const showImage = !!resolvedUrl && errored !== resolvedUrl

  const initials = (name || '??').slice(0, 2).toUpperCase()
  const computedFontSize = fontSize ?? Math.max(10, Math.round(size * 0.42))
  const computedRadius = borderRadius ?? Math.round(size / 2)

  const baseStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: size,
    height: size,
    borderRadius: computedRadius,
    background: showImage ? '#1d2125' : (avatarColor || '#579dff'),
    color: '#fff',
    fontFamily: 'var(--font-data)',
    fontSize: computedFontSize,
    fontWeight: 700,
    flexShrink: 0,
    textTransform: 'uppercase',
    overflow: 'hidden',
    boxShadow,
    ...style,
  }

  return (
    <span className={className} style={baseStyle} title={title || name}>
      {showImage ? (
        <img
          key={resolvedUrl}
          src={resolvedUrl!}
          alt={name}
          onError={() => setErrored(resolvedUrl)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
            userSelect: 'none',
            pointerEvents: 'none',
          }}
          draggable={false}
        />
      ) : (
        initials
      )}
    </span>
  )
}
