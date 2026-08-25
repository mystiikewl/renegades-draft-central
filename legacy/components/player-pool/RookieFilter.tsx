import React from 'react';
import { Button } from '@/components/ui/button';

interface RookieFilterProps {
  showRookies: boolean;
  setShowRookies: (show: boolean) => void;
}

export const RookieFilter = ({ showRookies, setShowRookies }: RookieFilterProps) => {
  return (
    <div>
      <label className="text-sm font-medium mb-2 block">Player Type</label>
      <div className="flex gap-2 flex-wrap">
        <Button
          variant={showRookies ? "default" : "outline"}
          size="sm"
          onClick={() => setShowRookies(!showRookies)}
          className="min-w-[60px]"
        >
          Rookies
        </Button>
      </div>
    </div>
  );
};