import { useState } from 'react';
import { Bell, BellOff, BellRing } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  notificationState,
  requestOnClockPermission,
  type NotificationState,
} from '@/hooks/useOnTheClockNotification';

/**
 * Bell toggle for on-the-clock alerts (backlog P3 #11). The permission grant
 * is the preference: granted = alerts on, denied = off (re-enable in browser
 * settings), default = one tap to ask.
 */
export function OnClockNotifyToggle() {
  const [state, setState] = useState<NotificationState>(notificationState);

  if (state === 'unsupported') return null;

  if (state === 'denied') {
    return (
      <Button variant="outline" size="icon" className="size-9" disabled aria-label="On-the-clock alerts blocked">
        <BellOff className="size-4" />
      </Button>
    );
  }

  const granted = state === 'granted';
  return (
    <Button
      variant="outline"
      size="icon"
      className="size-9"
      aria-pressed={granted}
      aria-label={granted ? 'On-the-clock alerts on' : 'Enable on-the-clock alerts'}
      title={granted ? 'On-the-clock alerts are on' : 'Get notified when your pick is up'}
      onClick={async () => {
        const next = await requestOnClockPermission();
        setState(next);
        if (next === 'granted') toast.success("On-the-clock alerts on — we'll ping you when your pick is up");
        else if (next === 'denied') toast.error('Notifications are blocked in browser settings');
      }}
    >
      {granted ? <BellRing className="size-4 text-primary" /> : <Bell className="size-4" />}
    </Button>
  );
}
