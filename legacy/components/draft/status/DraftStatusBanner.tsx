import React from 'react';
import { DraftCompleteBanner } from './DraftCompleteBanner';
import { OnClockBanner } from './OnClockBanner';
import { useDraftStatus } from '@/hooks/useDraftStatus';
import type { DraftPickWithRelations } from '@/integrations/supabase/types/draftPicks';

interface DraftStats {
  totalPicks: number;
  completedPicks: number;
  availablePlayers: number;
  progress: number;
}

interface DraftStatusBannerProps {
  draftStats: DraftStats;
  currentPick: DraftPickWithRelations | null;
  teams: string[];
  canMakePick: boolean;
  isMobile: boolean;
  navigate?: (path: string) => void;
  currentPickIndex: number;
}

export const DraftStatusBanner: React.FC<DraftStatusBannerProps> = (props) => {
  const { isComplete, isOnClock } = useDraftStatus({
    draftStats: props.draftStats,
    currentPick: props.currentPick,
    teams: props.teams,
    canMakePick: props.canMakePick
  });

  if (isComplete) {
    return <DraftCompleteBanner {...props} />;
  }

  if (isOnClock) {
    return <OnClockBanner {...props} />;
  }

  return null;
};