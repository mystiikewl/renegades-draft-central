import { useEffect, useRef } from 'react';

/**
 * "You're on the clock" alert (backlog P3 #11).
 *
 * Fires when the board rotates onto the user's team while the app is hidden.
 * The service worker path is required by installed mobile PWAs; the browser
 * Notification constructor remains as a fallback for desktop browsers.
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

function notificationOptions(pickNumber?: number | null, seasonLabel?: string | null): NotificationOptions {
  const pick = pickNumber ? `Pick #${pickNumber}` : 'Your pick';
  return {
    body: `${pick}${seasonLabel ? ` · ${seasonLabel}` : ''} — tap to open the board`,
    tag: 'on-the-clock',
    icon: '/favicon.svg',
    data: { url: '/' },
  };
}

function showBrowserNotification(title: string, options: NotificationOptions) {
  try {
    new Notification(title, options);
  } catch {
    // Some mobile browsers only allow notifications through a service worker.
  }
}

function showOnClockNotification(pickNumber?: number | null, seasonLabel?: string | null) {
  const title = "You're on the clock";
  const options = notificationOptions(pickNumber, seasonLabel);

  if ('serviceWorker' in navigator) {
    void navigator.serviceWorker.ready
      .then((registration) => registration.showNotification(title, options))
      .catch(() => {
        showBrowserNotification(title, options);
      });
    return;
  }

  showBrowserNotification(title, options);
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
    try {
      showOnClockNotification(pickNumber, seasonLabel);
    } catch {
      /* some platforms restrict constructor use; the visible UI still shows the turn */
    }
  }, [isMyTurn, pickNumber, seasonLabel]);
}
