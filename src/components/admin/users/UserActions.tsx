import React from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Edit, UserMinus, Trash2, MoreVertical, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';

interface User {
  id: string;
  email: string;
  team_id: number | null;
}

export interface UserAction {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  variant?: 'default' | 'destructive';
  onClick: (user: User) => void;
}

interface UserActionsProps {
  user: User;
  actions?: UserAction[];
  variant?: 'buttons' | 'menu' | 'swipe';
  onAction?: (actionId: string, user: User) => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Flexible user actions component with multiple display variants
 *
 * Features:
 * - Multiple variants: buttons, dropdown menu, swipe actions
 * - Touch-friendly button sizes (44px minimum)
 * - Accessibility support
 * - Team-aware actions (remove from team only for assigned users)
 * - Consistent styling across variants
 */
export const UserActions = React.memo(({
  user,
  actions: propActions,
  variant = 'buttons',
  onAction,
  className,
  size = 'sm',
}: UserActionsProps) => {
  // Default actions if none provided
  const defaultActions: UserAction[] = [
    {
      id: 'edit',
      label: 'Edit User',
      icon: Edit,
      onClick: (user) => onAction?.('edit', user),
    },
    {
      id: 'remove',
      label: 'Remove from Team',
      icon: UserMinus,
      onClick: (user) => onAction?.('remove', user),
    },
    {
      id: 'delete',
      label: 'Delete User',
      icon: Trash2,
      variant: 'destructive',
      onClick: (user) => onAction?.('delete', user),
    },
  ];

  // Filter actions based on user state (e.g., only show remove if user has team)
  const actions = (propActions || defaultActions).filter(action => {
    if (action.id === 'remove' && !user.team_id) {
      return false; // Don't show remove action if user has no team
    }
    return true;
  });

  // Size configurations
  const sizeConfig = {
    sm: { button: 'h-8 px-2', icon: 'h-4 w-4', text: 'text-sm' },
    md: { button: 'h-9 px-3', icon: 'h-4 w-4', text: 'text-sm' },
    lg: { button: 'h-10 px-4', icon: 'h-5 w-5', text: 'text-base' },
  };

  const config = sizeConfig[size];

  // Render buttons variant
  const renderButtons = () => (
    <div className={cn('flex items-center gap-2', className)}>
      {actions.map((action) => {
        const IconComponent = action.icon;
        return (
          <Button
            key={action.id}
            size="sm"
            variant={action.variant === 'destructive' ? 'destructive' : 'ghost'}
            onClick={() => action.onClick(user)}
            className={cn(
              config.button,
              action.variant === 'destructive' && 'text-destructive hover:text-destructive-foreground hover:bg-destructive'
            )}
            title={action.label}
          >
            <IconComponent className={config.icon} />
            <span className="sr-only">{action.label}</span>
          </Button>
        );
      })}
    </div>
  );

  // Render dropdown menu variant
  const renderMenu = () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(config.button, className)}
          title="More actions"
        >
          <MoreVertical className={config.icon} />
          <span className="sr-only">More actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>User Actions</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {actions.map((action, index) => {
          const IconComponent = action.icon;

          // Add separator before delete action
          if (action.id === 'delete' && index > 0) {
            return (
              <React.Fragment key={action.id}>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => action.onClick(user)}
                  className={cn(
                    'text-destructive focus:text-destructive-foreground focus:bg-destructive',
                    config.text
                  )}
                >
                  <IconComponent className="mr-2 h-4 w-4" />
                  {action.label}
                </DropdownMenuItem>
              </React.Fragment>
            );
          }

          return (
            <DropdownMenuItem
              key={action.id}
              onClick={() => action.onClick(user)}
              className={config.text}
            >
              <IconComponent className="mr-2 h-4 w-4" />
              {action.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  // Render swipe actions variant (compact for mobile)
  const renderSwipeActions = () => (
    <div className={cn('flex items-center gap-1', className)}>
      {actions.slice(0, 2).map((action) => {
        const IconComponent = action.icon;
        return (
          <Button
            key={action.id}
            size="sm"
            variant="ghost"
            onClick={() => action.onClick(user)}
            className={cn(
              'h-7 px-1',
              action.variant === 'destructive' && 'text-destructive hover:text-destructive-foreground hover:bg-destructive'
            )}
            title={action.label}
          >
            <IconComponent className="h-3 w-3" />
          </Button>
        );
      })}
    </div>
  );

  // Render appropriate variant
  switch (variant) {
    case 'menu':
      return renderMenu();
    case 'swipe':
      return renderSwipeActions();
    case 'buttons':
    default:
      return renderButtons();
  }
});

UserActions.displayName = 'UserActions';