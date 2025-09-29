import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PositionFilter } from './PositionFilter';
import { RookieFilter } from './RookieFilter';
import { StatsFilter } from './StatsFilter';
import { SortOptions } from './SortOptions';
import { AvailabilityFilter } from './AvailabilityFilter';

interface FilterPanelProps {
  hasFilters: boolean;
  clearFilters: () => void;
  selectedPositions: string[];
  togglePosition: (position: string) => void;
  showRookies: boolean;
  setShowRookies: (show: boolean) => void;
  minPoints: string;
  maxPoints: string;
  setMinPoints: (value: string) => void;
  setMaxPoints: (value: string) => void;
  minRebounds: string;
  maxRebounds: string;
  setMinRebounds: (value: string) => void;
  setMaxRebounds: (value: string) => void;
  sortOption: string;
  setSortOption: (option: string) => void;
  // New availability filter props
  showAvailable: boolean;
  showDrafted: boolean;
  showKeepers: boolean;
  setShowAvailable: (show: boolean) => void;
  setShowDrafted: (show: boolean) => void;
  setShowKeepers: (show: boolean) => void;
}

export const FilterPanel = ({
  hasFilters,
  clearFilters,
  selectedPositions,
  togglePosition,
  showRookies,
  setShowRookies,
  minPoints,
  maxPoints,
  setMinPoints,
  setMaxPoints,
  minRebounds,
  maxRebounds,
  setMinRebounds,
  setMaxRebounds,
  sortOption,
  setSortOption,
  // New availability filter props
  showAvailable,
  showDrafted,
  showKeepers,
  setShowAvailable,
  setShowDrafted,
  setShowKeepers
}: FilterPanelProps) => {
  return (
    <Card className="p-4 space-y-4 bg-gradient-card shadow-card">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">Advanced Filters</h3>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear All
          </Button>
        )}
      </div>
      
      <AvailabilityFilter
        showAvailable={showAvailable}
        showDrafted={showDrafted}
        showKeepers={showKeepers}
        setShowAvailable={setShowAvailable}
        setShowDrafted={setShowDrafted}
        setShowKeepers={setShowKeepers}
      />

      <PositionFilter
        selectedPositions={selectedPositions}
        togglePosition={togglePosition}
      />

      <RookieFilter
        showRookies={showRookies}
        setShowRookies={setShowRookies}
      />
      
      <StatsFilter
        minPoints={minPoints}
        maxPoints={maxPoints}
        setMinPoints={setMinPoints}
        setMaxPoints={setMaxPoints}
        minRebounds={minRebounds}
        maxRebounds={maxRebounds}
        setMinRebounds={setMinRebounds}
        setMaxRebounds={setMaxRebounds}
      />
      
      <SortOptions 
        sortOption={sortOption} 
        setSortOption={setSortOption} 
      />
    </Card>
  );
};