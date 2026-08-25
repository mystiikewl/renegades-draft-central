import { useState, useMemo } from 'react';
import type { DraftPick } from '../components/DraftBoard';

interface UseDraftFiltersProps {
  picks: DraftPick[];
  teams: string[];
}

interface UseDraftFiltersReturn {
  filteredPicks: DraftPick[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedTeam: string;
  setSelectedTeam: (team: string) => void;
  selectedPosition: string;
  setSelectedPosition: (position: string) => void;
  sortBy: 'overall' | 'team' | 'value';
  setSortBy: (sort: 'overall' | 'team' | 'value') => void;
  clearFilters: () => void;
  getPlayerValueScore: (player?: DraftPick['player']) => number;
  getPlayerTrend: (player?: DraftPick['player']) => string | null;
}

export function useDraftFilters({ picks, teams }: UseDraftFiltersProps): UseDraftFiltersReturn {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('');
  const [selectedPosition, setSelectedPosition] = useState('');
  const [sortBy, setSortBy] = useState<'overall' | 'team' | 'value'>('overall');

  const getPlayerValueScore = (player?: DraftPick['player']) => {
    if (!player) return 0;
    const points = player.points || 0;
    const rebounds = player.rebounds || 0;
    const assists = player.assists || 0;
    const blocks = player.blocks || 0;
    const steals = player.steals || 0;
    return (points * 0.4) + (rebounds * 0.3) + (assists * 0.2) + (blocks * 0.05) + (steals * 0.05);
  };

  const getPlayerTrend = (player?: DraftPick['player']) => {
    if (!player) return null;
    // Simple trend calculation based on recent performance
    const recentGames = player.gamesPlayed || 0;
    const mpg = player.minutesPerGame || 0;
    return recentGames > 50 && mpg > 25 ? 'trending-up' : recentGames > 30 ? 'stable' : 'trending-down';
  };

  const filteredPicks = useMemo(() => {
    return picks.filter((pick) => {
      const matchesSearch = !searchQuery ||
        pick.team.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (pick.player?.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (pick.player?.nbaTeam.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesTeam = !selectedTeam || pick.team === selectedTeam;

      const matchesPosition = !selectedPosition || pick.player?.position === selectedPosition;

      return matchesSearch && matchesTeam && matchesPosition;
    }).sort((a, b) => {
      switch (sortBy) {
        case 'team':
          return a.team.localeCompare(b.team);
        case 'value':
          const valueA = getPlayerValueScore(a.player);
          const valueB = getPlayerValueScore(b.player);
          return valueB - valueA;
        default:
          return a.overallPick - b.overallPick;
      }
    });
  }, [picks, searchQuery, selectedTeam, selectedPosition, sortBy, getPlayerValueScore]);

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedTeam('');
    setSelectedPosition('');
  };

  return {
    filteredPicks,
    searchQuery,
    setSearchQuery,
    selectedTeam,
    setSelectedTeam,
    selectedPosition,
    setSelectedPosition,
    sortBy,
    setSortBy,
    clearFilters,
    getPlayerValueScore,
    getPlayerTrend,
  };
}