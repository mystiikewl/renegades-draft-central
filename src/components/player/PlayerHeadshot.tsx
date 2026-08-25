import { useState } from 'react';

interface PlayerHeadshotProps {
  espnId: string | null;
  name: string;
  size?: number; // px, rendered CSS size
}

const HEADSHOT_URL = (espnId: string, size: number) =>
  `https://a.espncdn.com/combiner/i?img=/i/headshots/nba/players/full/${espnId}.png&w=${size}&h=${size}`;

/** ESPN headshot with initials-circle fallback on error/missing id. */
export function PlayerHeadshot({ espnId, name, size = 32 }: PlayerHeadshotProps) {
  const [failed, setFailed] = useState(false);
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  if (!espnId || failed) {
    return (
      <span
        aria-hidden
        className="flex shrink-0 items-center justify-center rounded-full bg-muted font-semibold leading-none text-muted-foreground ring-1 ring-border/40"
        style={{ width: size, height: size, fontSize: Math.max(9, Math.round(size / 3)) }}
      >
        {initials}
      </span>
    );
  }

  // srcSet at 1x/2x/4x so retina/zoomed displays pick a sharp source instead
  // of an upscaled (compressed-looking) render. Base multiplier bumped so
  // desktop/dialog sizes get genuinely high-res sources from ESPN's combiner.
  const src = HEADSHOT_URL(espnId, size * 4);
  const srcSet = [
    `${HEADSHOT_URL(espnId, size * 2)} 1x`,
    `${src} 2x`,
    `${HEADSHOT_URL(espnId, size * 6)} 4x`,
  ].join(', ');

  return (
    <img
      src={src}
      srcSet={srcSet}
      alt={name}
      loading="lazy"
      decoding="async"
      className="shrink-0 rounded-full bg-muted object-cover ring-1 ring-border/40"
      style={{ width: size, height: size }}
      onError={() => setFailed(true)}
    />
  );
}
