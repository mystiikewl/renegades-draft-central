import { useState } from 'react';

interface PlayerHeadshotProps {
  espnId: string | null;
  name: string;
  size?: number; // px
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
        className="flex shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground"
        style={{ width: size, height: size }}
      >
        {initials}
      </span>
    );
  }
  return (
    <img
      src={HEADSHOT_URL(espnId, size * 2)}
      alt={name}
      width={size}
      height={size}
      loading="lazy"
      className="shrink-0 rounded-full bg-muted object-cover"
      onError={() => setFailed(true)}
    />
  );
}
