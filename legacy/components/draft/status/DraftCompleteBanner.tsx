import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface DraftStats {
  totalPicks: number;
  completedPicks: number;
  availablePlayers: number;
  progress: number;
}

interface DraftCompleteBannerProps {
  draftStats: DraftStats;
  isMobile: boolean;
}

export const DraftCompleteBanner: React.FC<DraftCompleteBannerProps> = ({
  draftStats,
  isMobile
}) => {
  if (isMobile) {
    return (
      <div className="p-4 bg-green-600/20 border border-green-600 rounded-lg">
        <div className="flex flex-col items-center justify-between text-center">
          <div className="mb-2">
            <h3 className="text-lg font-bold text-green-500 mb-1 font-montserrat">
              Draft Complete!
            </h3>
            <p className="text-primary-foreground/80">
              All {draftStats.totalPicks} picks have been made
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-green-600/20 border border-green-600 rounded-lg">
      <div className="flex flex-col md:flex-row items-center justify-between text-center md:text-left">
        <div className="mb-4 md:mb-0">
          <h3 className="text-xl md:text-2xl font-bold text-green-500 mb-2 font-montserrat">
            Draft Complete!
          </h3>
          <p className="text-primary-foreground/80 text-lg">
            All {draftStats.totalPicks} picks have been made
          </p>
        </div>
      </div>
    </div>
  );
};