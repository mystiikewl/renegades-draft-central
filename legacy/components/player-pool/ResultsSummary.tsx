import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Filter } from 'lucide-react';

interface ResultsSummaryProps {
  playerCount: number;
  hasFilters: boolean;
}

export const ResultsSummary = ({ playerCount, hasFilters }: ResultsSummaryProps) => {
  return (
    <div className="flex justify-between items-center">
      <div className="text-sm text-muted-foreground">
        {playerCount} player{playerCount !== 1 ? 's' : ''} found
      </div>
      {hasFilters && (
        <div className="text-sm">
          <Badge variant="secondary" className="flex items-center gap-1">
            <Filter className="h-3 w-3" />
            Filters Active
          </Badge>
        </div>
      )}
    </div>
  );
};