import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit, Users, Shield, Trash2 } from 'lucide-react';
import { TouchActions } from '@/components/admin/shared/TouchActions';
import { cn } from '@/lib/utils';

interface Team {
  id: string;
  name: string;
  owner_email: string | null;
}

interface TeamCardProps {
  team: Team;
  variant?: 'default' | 'compact';
  onEdit?: (team: Team) => void;
  onDelete?: (teamId: string) => void;
  onManageRoster?: (team: Team) => void;
  onManageKeepers?: (team: Team) => void;
  showActions?: boolean;
  className?: string;
}

/**
 * Mobile-optimized team card component
 *
 * Features:
 * - Touch-friendly design with swipe actions
 * - Responsive typography and spacing
 * - Visual feedback for interactions
 * - Accessibility support
 * - Compact and default variants
 */
export const TeamCard = React.memo(({
  team,
  variant = 'default',
  onEdit,
  onDelete,
  onManageRoster,
  onManageKeepers,
  showActions = true,
  className,
}: TeamCardProps) => {
  const handleEdit = () => {
    onEdit?.(team);
  };

  const handleDelete = () => {
    onDelete?.(team.id);
  };

  const handleManageRoster = () => {
    onManageRoster?.(team);
  };

  const handleManageKeepers = () => {
    onManageKeepers?.(team);
  };

  const handleSwipeLeft = () => {
    // Swipe left for delete
    onDelete?.(team.id);
  };

  const handleSwipeRight = () => {
    // Swipe right for edit
    onEdit?.(team);
  };

  const handleLongPress = () => {
    // Long press to show context menu or additional actions
    onManageRoster?.(team);
  };

  return (
    <TouchActions
      onSwipeLeft={handleSwipeLeft}
      onSwipeRight={handleSwipeRight}
      onLongPress={handleLongPress}
      className={className}
    >
      <Card className={cn(
        'transition-all duration-200 hover:shadow-md active:scale-95',
        variant === 'compact' ? 'p-3' : 'p-4'
      )}>
        <CardContent className="p-0">
          <div className="space-y-3">
            {/* Team Header */}
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Shield className="h-4 w-4 text-primary flex-shrink-0" />
                  <h3 className={cn(
                    'font-semibold text-foreground truncate',
                    variant === 'compact' ? 'text-sm' : 'text-base'
                  )}>
                    {team.name}
                  </h3>
                </div>

                {team.owner_email && (
                  <p className={cn(
                    'text-muted-foreground truncate',
                    variant === 'compact' ? 'text-xs' : 'text-sm'
                  )}>
                    {team.owner_email}
                  </p>
                )}

                {!team.owner_email && (
                  <Badge variant="outline" className="text-xs">
                    No Owner
                  </Badge>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            {showActions && (
              <div className="pt-2 border-t">
                <div className="flex flex-wrap gap-2 overflow-x-auto scrollbar-hide">
                  <div className="flex gap-2 min-w-0 flex-1">
                    {onEdit && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleEdit}
                        className={cn(
                          'flex items-center gap-1 flex-shrink-0',
                          variant === 'compact' ? 'h-7 px-2 text-xs' : 'h-8 px-3'
                        )}
                      >
                        <Edit className="h-3 w-3" />
                        {variant === 'default' && 'Edit'}
                      </Button>
                    )}

                    {onManageRoster && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleManageRoster}
                        className={cn(
                          'flex items-center gap-1 flex-shrink-0',
                          variant === 'compact' ? 'h-7 px-2 text-xs' : 'h-8 px-3'
                        )}
                      >
                        <Users className="h-3 w-3" />
                        {variant === 'default' && 'Roster'}
                      </Button>
                    )}

                    {onManageKeepers && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleManageKeepers}
                        className={cn(
                          'flex items-center gap-1 flex-shrink-0',
                          variant === 'compact' ? 'h-7 px-2 text-xs' : 'h-8 px-3'
                        )}
                      >
                        <Shield className="h-3 w-3" />
                        {variant === 'default' && 'Keepers'}
                      </Button>
                    )}
                  </div>

                  {onDelete && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={handleDelete}
                      className={cn(
                        'flex items-center gap-1 flex-shrink-0 ml-auto',
                        variant === 'compact' ? 'h-7 px-2 text-xs' : 'h-8 px-3'
                      )}
                    >
                      <Trash2 className="h-3 w-3" />
                      {variant === 'default' && 'Delete'}
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Swipe Hints */}
            <div className="flex justify-between text-xs text-muted-foreground/50">
              <span>← Swipe to edit</span>
              <span>Swipe to delete →</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </TouchActions>
  );
});

TeamCard.displayName = 'TeamCard';