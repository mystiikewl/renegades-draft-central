import React from 'react';
import { Button } from '@/components/ui/button';

interface PositionFilterProps {
  selectedPositions: string[];
  togglePosition: (position: string) => void;
}

const allPositions = ['PG', 'SG', 'SF', 'PF', 'C'];

export const PositionFilter = ({ selectedPositions, togglePosition }: PositionFilterProps) => {
  return (
    <div>
      <label className="text-sm font-medium mb-2 block">Positions</label>
      <div className="flex gap-2 flex-wrap">
        {allPositions.map((position) => (
          <Button
            key={position}
            variant={selectedPositions.includes(position) ? "default" : "outline"}
            size="sm"
            onClick={() => togglePosition(position)}
            className="min-w-[60px]"
          >
            {position}
          </Button>
        ))}
      </div>
    </div>
  );
};