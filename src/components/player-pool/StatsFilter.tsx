import React from 'react';
import { Input } from '@/components/ui/input';

interface StatsFilterProps {
  minPoints: string;
  maxPoints: string;
  setMinPoints: (value: string) => void;
  setMaxPoints: (value: string) => void;
  minRebounds: string;
  maxRebounds: string;
  setMinRebounds: (value: string) => void;
  setMaxRebounds: (value: string) => void;
}

export const StatsFilter = ({
  minPoints,
  maxPoints,
  setMinPoints,
  setMaxPoints,
  minRebounds,
  maxRebounds,
  setMinRebounds,
  setMaxRebounds
}: StatsFilterProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label className="text-sm font-medium mb-2 block">Points Per Game</label>
        <div className="flex gap-2">
          <Input
            placeholder="Min"
            type="number"
            value={minPoints}
            onChange={(e) => setMinPoints(e.target.value)}
            className="w-full"
          />
          <Input
            placeholder="Max"
            type="number"
            value={maxPoints}
            onChange={(e) => setMaxPoints(e.target.value)}
            className="w-full"
          />
        </div>
      </div>
      
      <div>
        <label className="text-sm font-medium mb-2 block">Rebounds Per Game</label>
        <div className="flex gap-2">
          <Input
            placeholder="Min"
            type="number"
            value={minRebounds}
            onChange={(e) => setMinRebounds(e.target.value)}
            className="w-full"
          />
          <Input
            placeholder="Max"
            type="number"
            value={maxRebounds}
            onChange={(e) => setMaxRebounds(e.target.value)}
            className="w-full"
          />
        </div>
      </div>
    </div>
  );
};