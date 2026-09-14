import { useEffect, useRef } from 'react';

/**
 * "You're on the clock" alert (backlog P3 #11).
 *
 * Local Notification API only: fires when the board rotates onto the user's
 * team while the tab is hidden (phone in pocket during an in-person draft).
 * No server push — the remote/web-push half stays unspecced until the league
 * drafts remotely; the permission grant doubles as the on/off preference.
 */

export type NotificationState = 'unsupported' | 'default' | 'granted' | 'denied';

export function notificationState(): NotificationState {
  // typeof, not `in`: environments that define Notification = undefined exist
  // (and `in` would then report a permission of undefined instead of unsupported).
  if (typeof window === 'undefined' || typeof window.Notification === 'undefined') return 'unsupported';
  return Notification.permission as NotificationState;
}

export async function requestOnClockPermission(): Promise<NotificationState> {
  if (notificationState() !== 'default') return notificationState();
  try {
    return (await Notification.requestPermission()) as NotificationState;
  } catch {
    return 'denied';
  }
}

export function useOnTheClockNotification(options: {
  isMyTurn: boolean;
  pickNumber?: number | null;
  seasonLabel?: string | null;
}) {
  const { isMyTurn, pickNumber, seasonLabel } = options;
  const wasMyTurn = useRef(false);

  useEffect(() => {
    const becameMyTurn = isMyTurn && !wasMyTurn.current;
    wasMyTurn.current = isMyTurn;
    if (
      !becameMyTurn ||
      typeof document === 'undefined' ||
      !document.hidden ||
      notificationState() !== 'granted'
    ) {
      return;
    }
    const pick = pickNumber ? `Pick #${pickNumber}` : 'Your pick';
    try {
      new Notification("You're on the clock", {
        body: `${pick}${seasonLabel ? ` · ${seasonLabel}` : ''} — tap to open the board`,
        tag: 'on-the-clock',
      });
    } catch {
      /* some platforms restrict constructor use; the visible UI still shows the turn */
    }
  }, [isMyTurn, pickNumber, seasonLabel]);
}
