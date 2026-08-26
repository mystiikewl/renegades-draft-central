import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  TableCell,
  TableRow,
} from '@/components/ui/table';
import { Edit, Users, Shield, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Team {
  id: string;
  name: string;
  owner_email: string | null;
}

interface TeamTableRowProps {
  team: Team;
  onEdit?: (team: Team) => void;
  onDelete?: (teamId: string) => void;
  onManageRoster?: (team: Team) => void;
  onManageKeepers?: (team: Team) => void;
  showActions?: boolean;
  className?: string;
}

/**
 * Desktop-optimized team table row component
 *
 * Features:
 * - Clean table layout for desktop screens
 * - Hover effects and visual feedback
 * - Consistent spacing and typography
 * - Accessibility support with proper table semantics
 * - Responsive text truncation
 */
export const TeamTableRow = React.memo(({
  team,
  onEdit,
  onDelete,
  onManageRoster,
  onManageKeepers,
  showActions = true,
  className,
}: TeamTableRowProps) => {
  return (
    <TableRow
      className={cn(
        'hover:bg-muted/50 transition-colors duration-200',
        className
      )}
    >
      <TableCell className="font-medium">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary flex-shrink-0" />
          <span className="truncate max-w-xs" title={team.name}>
            {team.name}
          </span>
        </div>
      </TableCell>

      <TableCell className="text-muted-foreground">
        {team.owner_email ? (
          <span className="truncate max-w-xs" title={team.owner_email}>
            {team.owner_email}
          </span>
        ) : (
          <Badge variant="outline" className="text-xs">
            No Owner
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
                  onClick={() => onEdit(team)}
                  className="h-8 px-2 flex-shrink-0"
                  title="Edit team"
                >
                  <Edit className="h-4 w-4" />
                  <span className="sr-only">Edit {team.name}</span>
                </Button>
              )}

              {onManageRoster && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onManageRoster(team)}
                  className="h-8 px-2 flex-shrink-0"
                  title="Manage roster"
                >
                  <Users className="h-4 w-4" />
                  <span className="sr-only">Manage roster for {team.name}</span>
                </Button>
              )}

              {onManageKeepers && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onManageKeepers(team)}
                  className="h-8 px-2 flex-shrink-0"
                  title="Manage keepers"
                >
                  <Shield className="h-4 w-4" />
                  <span className="sr-only">Manage keepers for {team.name}</span>
                </Button>
              )}
            </div>

            {onDelete && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onDelete(team.id)}
                className="h-8 px-2 text-destructive hover:text-destructive-foreground hover:bg-destructive flex-shrink-0 ml-auto"
                title="Delete team"
              >
                <Trash2 className="h-4 w-4" />
                <span className="sr-only">Delete {team.name}</span>
              </Button>
            )}
          </div>
        </TableCell>
      )}
    </TableRow>
  );
});

TeamTableRow.displayName = 'TeamTableRow';