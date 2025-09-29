import { LayoutGrid, Users, TrendingUp, Star } from 'lucide-react';

export interface TabConfig {
  value: string;
  label: string;
  icon: React.ComponentType<any>;
  isRoute?: boolean;
}

export const DRAFT_TAB_CONFIG = {
  tabs: [
    { value: 'board', label: 'Draft Board', icon: LayoutGrid },
    { value: 'players', label: 'Player Pool', icon: Users },
    { value: 'favourites', label: 'My Favourites', icon: Star },
    { value: 'teams', label: 'Team Rosters', icon: Users },
    { value: 'league-analysis', label: 'League Analysis', icon: TrendingUp, isRoute: true }
  ],
  features: {
    showDraftViewToggle: true,
    showTeamSelection: true,
    enableRealTimeUpdates: true
  }
} as const;

export type DraftTabValue = typeof DRAFT_TAB_CONFIG.tabs[number]['value'];