import React from 'react';
import { Button } from '@/components/ui/button';
import { Trophy, Target, Activity, Zap, Shield } from 'lucide-react';

interface SortOptionsProps {
  sortOption: string;
  setSortOption: (option: string) => void;
}

export const SortOptions = ({ sortOption, setSortOption }: SortOptionsProps) => {
  const sortButtons = [
    { key: 'rank', label: 'Rank', icon: Trophy },
    { key: 'name', label: 'Name', icon: null },
    { key: 'points', label: 'Points', icon: Target },
    { key: 'rebounds', label: 'Rebounds', icon: Activity },
    { key: 'assists', label: 'Assists', icon: null },
    { key: 'blocks', label: 'Blocks', icon: Shield },
    { key: 'steals', label: 'Steals', icon: Zap },
    { key: 'turnovers', label: 'Turnovers', icon: null },
    { key: 'fieldGoalPercentage', label: 'FG%', icon: Target },
    { key: 'threePointPercentage', label: '3P%', icon: Target },
    { key: 'freeThrowPercentage', label: 'FT%', icon: Target },
    { key: 'gamesPlayed', label: 'Games', icon: Activity },
    { key: 'minutesPerGame', label: 'MPG', icon: Activity },
    { key: 'fantasyScore', label: 'Fantasy', icon: Trophy },
  ];

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium block">Sort By</label>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {sortButtons.map(({ key, label, icon: Icon }) => (
          <Button
            key={key}
            variant={sortOption === key ? "default" : "outline"}
            size="sm"
            onClick={() => setSortOption(key)}
            className="flex items-center gap-1 text-xs h-8"
          >
            {Icon && <Icon className="h-3 w-3" />}
            {label}
          </Button>
        ))}
      </div>
    </div>
  );
};