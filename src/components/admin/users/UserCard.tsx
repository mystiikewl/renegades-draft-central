import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit, UserMinus, Trash2, Mail } from 'lucide-react';
import { TouchActions } from '@/components/admin/shared/TouchActions';
import { cn } from '@/lib/utils';
import { Tables } from '@/integrations/supabase/types';

type Profile = Tables<'profiles'>;

interface Team {
  id: string;
  name: string;
  owner_email: string | null;
}

interface UserCardProps {
  user: Profile;
  team?: Team;
  variant?: 'default' | 'compact';
  onEdit?: (user: Profile) => void;
  onDelete?: (userId: string) => void;
  onRemoveFromTeam?: (userId: string) => void;
  showActions?: boolean;
  className?: string;
}

/**
 * Mobile-optimized user card component
 *
 * Features:
 * - Touch-friendly design with swipe actions
 * - Team assignment display with badges
 * - Swipe gestures for common actions
 * - Visual feedback for touch interactions
 * - Accessibility support
 */
export const UserCard = React.memo(({
  user,
  team,
  variant = 'default',
  onEdit,
  onDelete,
  onRemoveFromTeam,
  showActions = true,
  className,
}: UserCardProps) => {
  const handleEdit = () => {
    onEdit?.(user);
  };

  const handleDelete = () => {
    onDelete?.(user.id);
  };

  const handleRemoveFromTeam = () => {
    onRemoveFromTeam?.(user.id);
  };

  const handleSwipeLeft = () => {
    // Swipe left for edit
    onEdit?.(user);
  };

  const handleSwipeRight = () => {
    // Swipe right for delete
    onDelete?.(user.id);
  };

  const handleLongPress = () => {
    // Long press to show context menu or additional actions
    if (user.team_id) {
      onRemoveFromTeam?.(user.id);
    }
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
            {/* User Header */}
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Mail className="h-4 w-4 text-primary flex-shrink-0" />
                  <h3 className={cn(
                    'font-semibold text-foreground truncate',
                    variant === 'compact' ? 'text-sm' : 'text-base'
                  )}>
                    {user.email}
                  </h3>
                </div>

                {/* Team Assignment */}
                {team ? (
                  <Badge variant="secondary" className="text-xs">
                    {team.name}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs">
                    No Team
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

                    {onRemoveFromTeam && user.team_id && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleRemoveFromTeam}
                        className={cn(
                          'flex items-center gap-1 flex-shrink-0',
                          variant === 'compact' ? 'h-7 px-2 text-xs' : 'h-8 px-3'
                        )}
                      >
                        <UserMinus className="h-3 w-3" />
                        {variant === 'default' && 'Remove'}
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

UserCard.displayName = 'UserCard';