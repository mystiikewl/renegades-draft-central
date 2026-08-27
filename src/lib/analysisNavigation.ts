const FOCUSED_PLAYER_KEY = 'renegades:analysis:focused-player';

export function rememberFocusedPlayer(playerId: string): void {
  try {
    sessionStorage.setItem(FOCUSED_PLAYER_KEY, playerId);
  } catch {
    // Storage can be unavailable in strict/private browser contexts.
  }
}

export function readFocusedPlayer(): string | null {
  try {
    return sessionStorage.getItem(FOCUSED_PLAYER_KEY);
  } catch {
    return null;
  }
}

export function clearFocusedPlayer(): void {
  try {
    sessionStorage.removeItem(FOCUSED_PLAYER_KEY);
  } catch {
    // Storage can be unavailable in strict/private browser contexts.
  }
}
