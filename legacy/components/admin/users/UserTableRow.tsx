import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  TableCell,
  TableRow,
} from '@/components/ui/table';
import { Edit, UserMinus, Trash2, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tables } from '@/integrations/supabase/types';

type Profile = Tables<'profiles'>;

interface Team {
  id: string;
  name: string;
  owner_email: string | null;
}

interface UserTableRowProps {
  user: Profile;
  team?: Team;
  onEdit?: (user: Profile) => void;
  onDelete?: (userId: string) => void;
  onRemoveFromTeam?: (userId: string) => void;
  showActions?: boolean;
  className?: string;
}

/**
 * Desktop-optimized user table row component
 *
 * Features:
 * - Clean table layout for desktop screens
 * - Hover effects and visual feedback
 * - Team assignment display with badges
 * - Consistent spacing and typography
 * - Accessibility support with proper table semantics
 */
export const UserTableRow = React.memo(({
  user,
  team,
  onEdit,
  onDelete,
  onRemoveFromTeam,
  showActions = true,
  className,
}: UserTableRowProps) => {
  return (
    <TableRow
      className={cn(
        'hover:bg-muted/50 transition-colors duration-200',
        className
      )}
    >
      <TableCell className="font-medium">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-primary flex-shrink-0" />
          <span className="truncate max-w-xs" title={user.email}>
            {user.email}
          </span>
        </div>
      </TableCell>

      <TableCell>
        {team ? (
          <Badge variant="secondary" className="text-xs">
            {team.name}
          </Badge>
        ) : (
          <Badge variant="outline" className="text-xs">
            No Team
          </Badge>
        )}
      </TableCell>

      {showActions && (
        <TableCell className="min-w-[200px]">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {onEdit && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onEdit(user)}
                  className="h-8 px-2 flex-shrink-0"
                  title="Edit user"
                >
                  <Edit className="h-4 w-4" />
                  <span className="sr-only">Edit {user.email}</span>
                </Button>
              )}

              {onRemoveFromTeam && user.team_id && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onRemoveFromTeam(user.id)}
                  className="h-8 px-2 flex-shrink-0"
                  title="Remove from team"
                >
                  <UserMinus className="h-4 w-4" />
                  <span className="sr-only">Remove {user.email} from team</span>
                </Button>
              )}
            </div>

            {onDelete && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onDelete(user.id)}
                className="h-8 px-2 text-destructive hover:text-destructive-foreground hover:bg-destructive flex-shrink-0 ml-auto"
                title="Delete user"
              >
                <Trash2 className="h-4 w-4" />
                <span className="sr-only">Delete {user.email}</span>
              </Button>
            )}
          </div>
        </TableCell>
      )}
    </TableRow>
  );
});

UserTableRow.displayName = 'UserTableRow';