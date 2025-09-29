import React from 'react';
import { User } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface NoResultsProps {
  hasFilters: boolean;
  clearFilters: () => void;
}

export const NoResults = ({ hasFilters, clearFilters }: NoResultsProps) => {
  return (
    <div className="text-center py-8 text-muted-foreground">
      <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
      <p>No players found matching your criteria</p>
      {hasFilters && (
        <Button variant="link" onClick={clearFilters} className="mt-2">
          Clear filters
        </Button>
      )}
    </div>
  );
};