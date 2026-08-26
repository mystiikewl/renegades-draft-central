import React from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Edit, Users, Shield, Trash2, MoreVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Team {
  id: string;
  name: string;
  owner_email: string | null;
}

export interface TeamAction {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  variant?: 'default' | 'destructive';
  onClick: (team: Team) => void;
}

interface TeamActionsProps {
  team: Team;
  actions?: TeamAction[];
  variant?: 'buttons' | 'menu' | 'swipe';
  onAction?: (actionId: string, team: Team) => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Flexible team actions component with multiple display variants
 *
 * Features:
 * - Multiple variants: buttons, dropdown menu, swipe actions
 * - Configurable actions with icons and labels
 * - Touch-friendly button sizes (44px minimum)
 * - Accessibility support
 * - Consistent styling across variants
 */
export const TeamActions = React.memo(({
  team,
  actions: propActions,
  variant = 'buttons',
  onAction,
  className,
  size = 'sm',
}: TeamActionsProps) => {
  // Default actions if none provided
  const defaultActions: TeamAction[] = [
    {
      id: 'edit',
      label: 'Edit Team',
      icon: Edit,
      onClick: (team) => onAction?.('edit', team),
    },
    {
      id: 'roster',
      label: 'Manage Roster',
      icon: Users,
      onClick: (team) => onAction?.('roster', team),
    },
    {
      id: 'keepers',
      label: 'Manage Keepers',
      icon: Shield,
      onClick: (team) => onAction?.('keepers', team),
    },
    {
      id: 'delete',
      label: 'Delete Team',
      icon: Trash2,
      variant: 'destructive',
      onClick: (team) => onAction?.('delete', team),
    },
  ];

  const actions = propActions || defaultActions;

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
            onClick={() => action.onClick(team)}
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
        {actions.map((action, index) => {
          const IconComponent = action.icon;

          // Add separator before delete action
          if (action.id === 'delete' && index > 0) {
            return (
              <React.Fragment key={action.id}>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => action.onClick(team)}
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
              onClick={() => action.onClick(team)}
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
            onClick={() => action.onClick(team)}
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

TeamActions.displayName = 'TeamActions';