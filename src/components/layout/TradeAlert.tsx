import { useNavigate } from '@tanstack/react-router';
import { CircleAlert } from 'lucide-react';
import { useUnreadNotificationCount } from '@/api/notifications';
import { Button } from '@/components/ui/button';

/**
 * Header trade alert: a quiet exclamation icon when everything is read;
 * once unread trade activity exists it fills red and carries the unread
 * count (IG-style). Clicking opens the Trade Center, which marks it read —
 * so the number means "trade activity not yet seen there".
 */
export function TradeAlert() {
  const navigate = useNavigate();
  const { data: unread = 0 } = useUnreadNotificationCount();
  const hasUnread = unread > 0;

  return (
    <Button
      variant="outline"
      size="icon"
      className="relative size-9 shrink-0"
      aria-label={hasUnread ? `Trades — ${unread} unread notification${unread === 1 ? '' : 's'}` : 'Trades'}
      title="Trades"
      onClick={() => navigate({ to: '/trades' })}
    >
      <CircleAlert
        className={`size-5 ${hasUnread ? 'fill-destructive text-destructive-foreground' : ''}`}
      />
      {hasUnread && (
        <span className="absolute -right-1.5 -top-1.5 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-4 text-destructive-foreground">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </Button>
  );
}
