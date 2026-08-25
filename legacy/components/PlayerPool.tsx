import React, { useState, useMemo, useEffect, memo, useCallback } from 'react';
import { usePerformanceMonitoring } from '@/hooks/usePerformanceMonitoring';
import { PlayerDetailsModal } from '@/components/PlayerDetailsModal';
import type { Tables } from '@/integrations/supabase/types';
import { PlayerCard } from './player-pool/PlayerCard';
import { SearchBar } from './player-pool/SearchBar';
import { FilterPanel } from './player-pool/FilterPanel';
import { ResultsSummary } from './player-pool/ResultsSummary';
import { NoResults } from './player-pool/NoResults';
import { Button } from '@/components/ui/button';
import { LayoutGrid, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { calculateFantasyScore } from '@/utils/fantasyScore';
import { useFavourites } from '@/hooks/useFavourites';
import { useAuth } from '@/contexts/AuthContext';

export type Player = Tables<'players'>;

interface PlayerPoolProps {
  players: Player[];
  onSelectPlayer?: (player: Player) => void;
  selectedPlayer?: Player | null;
  canMakePick?: boolean;
}

export const PlayerPool = memo(({ players, onSelectPlayer, selectedPlayer, canMakePick }: PlayerPoolProps) => {
   usePerformanceMonitoring('PlayerPool');
   const { user } = useAuth();
   const { favouriteIds, toggleFavouriteMutation, isFavourite } = useFavourites();
   const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [selectedPositions, setSelectedPositions] = useState<string[]>([]);
  const [sortOption, setSortOption] = useState('rank');
  const [showFilters, setShowFilters] = useState(false);
  const [minPoints, setMinPoints] = useState('');
  const [maxPoints, setMaxPoints] = useState('');
  const [minRebounds, setMinRebounds] = useState('');
  const [maxRebounds, setMaxRebounds] = useState('');
  const [showRookies, setShowRookies] = useState(false);
  const [showPlayerDetails, setShowPlayerDetails] = useState(false);
  const [selectedPlayerForDetails, setSelectedPlayerForDetails] = useState<Player | null>(null);

  // New availability filter states
  const [showAvailable, setShowAvailable] = useState(true);
  const [showDrafted, setShowDrafted] = useState(false);
  const [showKeepers, setShowKeepers] = useState(false);

  // View mode state
  const [viewMode, setViewMode] = useState<'pool' | 'analytics'>('pool');

  // Enhanced state management
  const [focusedPlayerIndex, setFocusedPlayerIndex] = useState<number>(-1);
  const [lastInteractionTime, setLastInteractionTime] = useState<number>(Date.now());

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    
    return () => {
      clearTimeout(timer);
    };
  }, [searchTerm]);
  
  // Toggle position selection
  const togglePosition = (position: string) => {
    setSelectedPositions(prev => 
      prev.includes(position) 
        ? prev.filter(p => p !== position)
        : [...prev, position]
    );
  };
  
  // Clear all filters
  const clearFilters = () => {
    setSearchTerm('');
    setDebouncedSearchTerm('');
    setSelectedPositions([]);
    setMinPoints('');
    setMaxPoints('');
    setMinRebounds('');
    setMaxRebounds('');
    setShowRookies(false);
    // Reset availability filters to default
    setShowAvailable(true);
    setShowDrafted(false);
    setShowKeepers(false);
  };
  
  // Check if any filters are applied
  const hasFilters = useMemo(() => {
    return debouncedSearchTerm !== '' ||
           selectedPositions.length > 0 ||
           minPoints !== '' ||
           maxPoints !== '' ||
           minRebounds !== '' ||
           maxRebounds !== '' ||
           showRookies ||
           !showAvailable ||
           showDrafted ||
           showKeepers;
  }, [debouncedSearchTerm, selectedPositions, minPoints, maxPoints, minRebounds, maxRebounds, showRookies, showAvailable, showDrafted, showKeepers]);

  // Filter and sort players
  const filteredAndSortedPlayers = useMemo(() => {
    let result = players.filter(player => {
      // Apply availability filters
      const isAvailable = !player.is_drafted && !player.is_keeper;
      const isDrafted = player.is_drafted;
      const isKeeper = player.is_keeper;

      const matchesAvailability =
        (showAvailable && isAvailable) ||
        (showDrafted && isDrafted) ||
        (showKeepers && isKeeper);

      return matchesAvailability;
    });
    
    // Apply search filter
    if (debouncedSearchTerm) {
      const term = debouncedSearchTerm.toLowerCase();
      result = result.filter(player => 
        player.name.toLowerCase().includes(term) ||
        player.nba_team.toLowerCase().includes(term)
      );
    }
    
    // Apply position filter
    if (selectedPositions.length > 0) {
      result = result.filter(player => 
        selectedPositions.some(pos => player.position.includes(pos))
      );
    }
    
    // Apply points filter
    if (minPoints) {
      const min = parseFloat(minPoints);
      result = result.filter(player => 
        player.points !== null && player.points >= min
      );
    }
    
    if (maxPoints) {
      const max = parseFloat(maxPoints);
      result = result.filter(player => 
        player.points !== null && player.points <= max
      );
    }
    
    // Apply rebounds filter
    if (minRebounds) {
      const min = parseFloat(minRebounds);
      result = result.filter(player => 
        player.total_rebounds !== null && player.total_rebounds >= min
      );
    }
    
    if (maxRebounds) {
      const max = parseFloat(maxRebounds);
      result = result.filter(player => 
        player.total_rebounds !== null && player.total_rebounds <= max
      );
    }

    // Apply rookie filter
    if (showRookies) {
      result = result.filter(player => player.is_rookie);
    }
    
    // Apply sorting
    result.sort((a, b) => {
      switch (sortOption) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'points':
          return (b.points || 0) - (a.points || 0);
        case 'rebounds':
          return (b.total_rebounds || 0) - (a.total_rebounds || 0);
        case 'assists':
          return (b.assists || 0) - (a.assists || 0);
        case 'blocks':
          return (b.blocks || 0) - (a.blocks || 0);
        case 'steals':
          return (b.steals || 0) - (a.steals || 0);
        case 'turnovers':
          return (a.turnovers || 0) - (b.turnovers || 0); // Lower turnovers is better
        case 'fieldGoalPercentage':
          return (b.field_goal_percentage || 0) - (a.field_goal_percentage || 0);
        case 'threePointPercentage':
          return (b.three_point_percentage || 0) - (a.three_point_percentage || 0);
        case 'freeThrowPercentage':
          return (b.free_throw_percentage || 0) - (a.free_throw_percentage || 0);
        case 'gamesPlayed':
          return (b.games_played || 0) - (a.games_played || 0);
        case 'minutesPerGame':
          return (b.minutes_per_game || 0) - (a.minutes_per_game || 0);
        case 'fantasyScore':
          const aFantasyScore = calculateFantasyScore(a);
          const bFantasyScore = calculateFantasyScore(b);
          return bFantasyScore - aFantasyScore;
        case 'rank':
        default:
          return (a.rank || 0) - (b.rank || 0);
      }
    });
    
    return result;
  }, [players, debouncedSearchTerm, selectedPositions, minPoints, maxPoints, minRebounds, maxRebounds, showRookies, sortOption, showAvailable, showDrafted, showKeepers]);

  const handlePlayerCardClick = (player: Player) => {
    if (canMakePick && !player.is_drafted && !player.is_keeper) {
      setSelectedPlayerForDetails(player);
      setShowPlayerDetails(true);
      setLastInteractionTime(Date.now());
    }
  };

  const handleToggleFavourite = async (playerId: string) => {
    if (!user) return; // Only authenticated users can favourite

    try {
      await toggleFavouriteMutation.mutateAsync(playerId);
    } catch (error) {
      console.error('Failed to toggle favourite:', error);
    }
  };

  // Keyboard navigation
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (viewMode !== 'pool') return;

    const availablePlayers = filteredAndSortedPlayers.filter(p => !p.is_drafted && !p.is_keeper);

    if (event.key === 'ArrowDown' && focusedPlayerIndex < availablePlayers.length - 1) {
      event.preventDefault();
      setFocusedPlayerIndex(prev => prev + 1);
    } else if (event.key === 'ArrowUp' && focusedPlayerIndex > 0) {
      event.preventDefault();
      setFocusedPlayerIndex(prev => prev - 1);
    } else if (event.key === 'Enter' && focusedPlayerIndex >= 0 && focusedPlayerIndex < availablePlayers.length) {
      event.preventDefault();
      handlePlayerCardClick(availablePlayers[focusedPlayerIndex]);
    } else if (event.key === 'Escape') {
      setFocusedPlayerIndex(-1);
    }
  }, [viewMode, focusedPlayerIndex, filteredAndSortedPlayers, handlePlayerCardClick]);

  return (
    <div className="space-y-4" onKeyDown={handleKeyDown} tabIndex={0}>
      {/* View Mode Toggle */}
      <div className="flex justify-center">
        <div className="flex bg-card rounded-lg p-1 shadow-sm border">
          <Button
            variant={viewMode === 'pool' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('pool')}
            className="flex items-center gap-2"
          >
            <LayoutGrid className="h-4 w-4" />
            Player Pool
          </Button>
          <Button
            variant={viewMode === 'analytics' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('analytics')}
            className="flex items-center gap-2"
          >
            <BarChart3 className="h-4 w-4" />
            Analytics
          </Button>
        </div>
      </div>

      {viewMode === 'pool' && (
        <>
          <SearchBar
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            showFilters={showFilters}
            setShowFilters={setShowFilters}
          />
      
      {showFilters && (
        <FilterPanel
          hasFilters={hasFilters}
          clearFilters={clearFilters}
          selectedPositions={selectedPositions}
          togglePosition={togglePosition}
          showRookies={showRookies}
          setShowRookies={setShowRookies}
          minPoints={minPoints}
          maxPoints={maxPoints}
          setMinPoints={setMinPoints}
          setMaxPoints={setMaxPoints}
          minRebounds={minRebounds}
          maxRebounds={maxRebounds}
          setMinRebounds={setMinRebounds}
          setMaxRebounds={setMaxRebounds}
          sortOption={sortOption}
          setSortOption={setSortOption}
          // New availability filter props
          showAvailable={showAvailable}
          showDrafted={showDrafted}
          showKeepers={showKeepers}
          setShowAvailable={setShowAvailable}
          setShowDrafted={setShowDrafted}
          setShowKeepers={setShowKeepers}
        />
      )}

      <ResultsSummary
        playerCount={filteredAndSortedPlayers.length}
        hasFilters={hasFilters}
      />

      {/* Player Grid */}
      <div className="max-h-[500px] overflow-y-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
          {filteredAndSortedPlayers.map((player, index) => {
            const availablePlayers = filteredAndSortedPlayers.filter(p => !p.is_drafted && !p.is_keeper);
            const availableIndex = availablePlayers.findIndex(p => p.id === player.id);
            const isFocused = viewMode === 'pool' && availableIndex === focusedPlayerIndex;

            return (
              <PlayerCard
                key={player.id}
                player={player}
                isSelected={selectedPlayer?.id === player.id}
                isFocused={isFocused}
                canMakePick={canMakePick}
                onClick={() => handlePlayerCardClick(player)}
                sortOption={sortOption}
                calculateFantasyScore={calculateFantasyScore}
                isFavourite={user ? isFavourite(player.id) : false}
                onToggleFavourite={user ? handleToggleFavourite : undefined}
              />
            );
          })}
        </div>
      </div>

      {filteredAndSortedPlayers.length === 0 && (
        <NoResults
          hasFilters={hasFilters}
          clearFilters={clearFilters}
        />
      )}

      {/* Player Details Modal */}
      <PlayerDetailsModal
        player={selectedPlayerForDetails}
        isOpen={showPlayerDetails}
        onClose={() => setShowPlayerDetails(false)}
        onConfirm={(player) => {
          onSelectPlayer?.(player);
          // setShowPlayerDetails(false) is handled in PlayerDetailsModal
        }}
        canMakePick={canMakePick}
      />
        </>
      )}

      {viewMode === 'analytics' && (
        <div className="text-center py-8 text-muted-foreground">
          <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Analytics view coming soon...</p>
          <p className="text-sm mt-2">This will show pool statistics and insights</p>
        </div>
      )}
    </div>
  );
});
