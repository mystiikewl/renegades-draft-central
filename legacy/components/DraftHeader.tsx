import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Filter, BarChart3, LayoutGrid } from 'lucide-react';

interface DraftHeaderProps {
  viewMode: 'board' | 'analytics';
  setViewMode: (mode: 'board' | 'analytics') => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedTeam: string;
  setSelectedTeam: (team: string) => void;
  selectedPosition: string;
  setSelectedPosition: (position: string) => void;
  sortBy: string;
  setSortBy: (sort: string) => void;
  clearFilters: () => void;
  filteredPicksLength: number;
  picksLength: number;
}

export function DraftHeader({
  viewMode,
  setViewMode,
  searchQuery,
  setSearchQuery,
  selectedTeam,
  setSelectedTeam,
  selectedPosition,
  setSelectedPosition,
  sortBy,
  setSortBy,
  clearFilters,
  filteredPicksLength,
  picksLength,
}: DraftHeaderProps) {
  return (
    <div className="mb-6 space-y-4">
      {/* View Mode Toggle */}
      <div className="flex justify-center">
        <div className="flex bg-card rounded-lg p-1 shadow-sm">
          <Button
            variant={viewMode === 'board' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('board')}
            className="flex items-center gap-2"
          >
            <LayoutGrid className="h-4 w-4" />
            Draft Board
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

      {viewMode === 'board' && (
        <>
          {/* Search and Filter Controls */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search-input"
                  placeholder="Search players, teams, or NBA teams..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <select
                value={selectedTeam}
                onChange={(e) => setSelectedTeam(e.target.value)}
                className="px-3 py-2 border rounded-md bg-background text-sm"
              >
                <option value="">All Teams</option>
                {teams.map((team) => (
                  <option key={team} value={team}>{team}</option>
                ))}
              </select>

              <select
                value={selectedPosition}
                onChange={(e) => setSelectedPosition(e.target.value)}
                className="px-3 py-2 border rounded-md bg-background text-sm"
              >
                <option value="">All Positions</option>
                <option value="PG">PG</option>
                <option value="SG">SG</option>
                <option value="SF">SF</option>
                <option value="PF">PF</option>
                <option value="C">C</option>
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-2 border rounded-md bg-background text-sm"
              >
                <option value="overall">Sort by Pick</option>
                <option value="team">Sort by Team</option>
                <option value="value">Sort by Value</option>
              </select>

              {(searchQuery || selectedTeam || selectedPosition) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearFilters}
                  className="flex items-center gap-1"
                >
                  Clear
                </Button>
              )}
            </div>
          </div>

          {/* Filter Summary */}
          <div className="text-sm text-muted-foreground">
            Showing {filteredPicksLength} of {picksLength} picks
            {searchQuery && ` • Searching "${searchQuery}"`}
            {selectedTeam && ` • Team: ${selectedTeam}`}
            {selectedPosition && ` • Position: ${selectedPosition}`}
          </div>
        </>
      )}
    </div>
  );
}