import { useEffect, useState } from 'react';
import { Bell, BellOff, BellRing } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  notificationState,
  requestOnClockPermission,
  type NotificationState,
} from '@/hooks/useOnTheClockNotification';

const STATUS: Record<NotificationState, string> = {
  unsupported: 'Browser alerts unavailable here',
  default: 'Permission not requested',
  granted: 'Permission granted',
  denied: 'Notifications blocked',
};

/** Keep setup reachable even when the browser has no Notifications API. */
export function OnClockNotifyToggle() {
  const [state, setState] = useState<NotificationState>(notificationState);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const refresh = () => setState(notificationState());
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);

  const granted = state === 'granted';
  const label = granted ? 'On-the-clock alerts on'
    : state === 'denied' ? 'On-the-clock alerts blocked'
      : state === 'unsupported' ? 'On-the-clock alert setup' : 'Enable on-the-clock alerts';

  return (
    <Dialog onOpenChange={(open) => { if (open) setState(notificationState()); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" className="size-11 shrink-0" aria-label={label} title="Draft alert settings">
          {granted ? <BellRing className="size-4 text-primary" aria-hidden="true" />
            : state === 'denied' ? <BellOff className="size-4" aria-hidden="true" />
              : <Bell className="size-4" aria-hidden="true" />}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] overflow-y-auto rounded-lg">
        <DialogHeader className="pr-8 text-left">
          <DialogTitle>Draft alerts</DialogTitle>
          <DialogDescription>Know when your team is on the clock.</DialogDescription>
        </DialogHeader>
        <div className="rounded-md border bg-muted/40 p-3 text-sm" role="status" aria-live="polite">
          <p className="font-medium">{STATUS[state]}</p>
          <p className="mt-1 text-muted-foreground">The on-screen turn banner works without notification permission.</p>
        </div>
        {state === 'denied' && (
          <p className="text-sm">To allow alerts, check this site's notification permission in your browser's site permissions. On Android, also check system notification settings for your browser. For an installed iPhone app, check Settings → Notifications → Renegades. Return here after changing it.</p>
        )}
        {/* ponytail: show both guides; capability checks gate actions, not user-agent guesses. */}
        {(state === 'unsupported' || state === 'default') && (
          <div className="space-y-3 text-sm">
            <section aria-label="iPhone and iPad setup">
              <h3 className="font-medium">iPhone / iPad</h3>
              <p className="mt-1 text-muted-foreground">On iOS 16.4 or newer, use Share → Add to Home Screen, then open Renegades from that icon and enable alerts here. If Chrome does not offer installation, open the site in Safari and use Share. If already installed, update iOS and reopen the app.</p>
            </section>
            <section aria-label="Android setup">
              <h3 className="font-medium">Android</h3>
              <p className="mt-1 text-muted-foreground">Open Renegades in an up-to-date Chrome browser, then enable alerts here and choose Allow. Installing from Chrome's menu is optional. If alerts are unavailable, leave private browsing or an in-app browser and reopen the site in Chrome.</p>
            </section>
            {state === 'unsupported' && <p className="text-muted-foreground">Other browsers: try an updated browser with notification support.</p>}
          </div>
        )}
        <p className="text-sm text-muted-foreground">Keep Renegades open and connected during the draft. Alerts depend on the app running; they are not reliable when your phone is locked or the app is closed. Permission does not enable background push delivery.</p>
        <div className="flex flex-wrap justify-end gap-2">
          <DialogClose asChild><Button variant="outline" className="min-h-11">Done</Button></DialogClose>
          {state === 'default' && (
            <Button className="min-h-11 transition-transform active:scale-[0.98]" disabled={pending}
              onClick={async () => {
                setPending(true);
                try { setState(await requestOnClockPermission()); }
                finally { setPending(false); }
              }}>
              {pending ? 'Waiting for permission…' : 'Enable alerts'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
