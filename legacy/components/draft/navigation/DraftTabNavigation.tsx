import React from 'react';
import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { TabConfig } from '@/config/draftTabsConfig';
import { getTeamColorPalette } from '@/lib/teams';
import { getTeamCardStyle } from '@/lib/teamStyling';

interface DraftTabNavigationProps {
  tabs: readonly TabConfig[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  isMobile: boolean;
  navigate?: (path: string) => void;
  currentTeam?: { name: string };
  teams: string[];
}

export const DraftTabNavigation: React.FC<DraftTabNavigationProps> = ({
  tabs,
  activeTab,
  onTabChange,
  isMobile,
  navigate,
  currentTeam,
  teams
}) => {
  const handleTabChange = (value: string) => {
    const tab = tabs.find(t => t.value === value);
    if (tab?.isRoute && navigate) {
      navigate('/league-analysis');
    } else {
      onTabChange(value);
    }
  };

  // Compute team palette for styling
  const teamPalette = currentTeam?.name ? getTeamColorPalette(currentTeam.name, teams) : null;

  // Get base team styling with fallback to neutral theme
  const baseTeamStyle = currentTeam?.name ? getTeamCardStyle(currentTeam.name, teams) : {
    background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
    border: '2px solid #3b82f6',
    boxShadow: '0 4px 20px #3b82f620'
  };

  // Merge with custom textShadow if teamPalette exists
  const teamStyle = teamPalette
    ? { ...baseTeamStyle, textShadow: `0 0 10px ${teamPalette.accent}60` }
    : { ...baseTeamStyle, textShadow: 'none' };

  if (isMobile) {
    return (
      <div className="space-y-4">
        <Select value={activeTab} onValueChange={handleTabChange}>
          <SelectTrigger
            className="w-full rounded-lg border-2 font-bold text-white animate-pulse"
            style={teamStyle}
          >
            <SelectValue placeholder="Select a tab" />
          </SelectTrigger>
          <SelectContent>
            {tabs.map((tab) => (
              <SelectItem key={tab.value} value={tab.value}>
                {tab.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <TabsList className="grid w-full grid-cols-5">
      {tabs.map((tab) => (
        <TabsTrigger
          key={tab.value}
          value={tab.value}
          onClick={() => handleTabChange(tab.value)}
        >
          {tab.label}
        </TabsTrigger>
      ))}
    </TabsList>
  );
};
