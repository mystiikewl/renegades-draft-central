import React, { useState, useMemo, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, X, Filter, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface Team {
  id: string;
  name: string;
  owner_email: string | null;
}

interface TeamSearchFilterProps {
  teams: Team[];
  onFilteredTeams: (filteredTeams: Team[]) => void;
  className?: string;
  placeholder?: string;
  showFilters?: boolean;
}

/**
 * Search and filter component for teams
 *
 * Features:
 * - Real-time search with debouncing
 * - Filter by owner status (has owner, no owner)
 * - Clear filters functionality
 * - Mobile-optimized interface
 * - Visual feedback for active filters
 */
export const TeamSearchFilter = React.memo(({
  teams,
  onFilteredTeams,
  className,
  placeholder = "Search teams...",
  showFilters = true,
}: TeamSearchFilterProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilters, setActiveFilters] = useState<string[]>([]);

  // Debounced search term to avoid excessive filtering
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Filter options
  const filterOptions = [
    { id: 'has-owner', label: 'Has Owner', filter: (team: Team) => !!team.owner_email },
    { id: 'no-owner', label: 'No Owner', filter: (team: Team) => !team.owner_email },
  ];

  // Apply filters and search
  const filteredTeams = useMemo(() => {
    let filtered = teams;

    // Apply search filter
    if (debouncedSearchTerm) {
      const searchLower = debouncedSearchTerm.toLowerCase();
      filtered = filtered.filter(team =>
        team.name.toLowerCase().includes(searchLower) ||
        team.owner_email?.toLowerCase().includes(searchLower)
      );
    }

    // Apply active filters
    activeFilters.forEach(filterId => {
      const filterOption = filterOptions.find(opt => opt.id === filterId);
      if (filterOption) {
        filtered = filtered.filter(filterOption.filter);
      }
    });

    return filtered;
  }, [teams, debouncedSearchTerm, activeFilters]);

  // Update parent with filtered teams
  React.useEffect(() => {
    onFilteredTeams(filteredTeams);
  }, [filteredTeams, onFilteredTeams]);

  // Toggle filter
  const toggleFilter = useCallback((filterId: string) => {
    setActiveFilters(prev =>
      prev.includes(filterId)
        ? prev.filter(id => id !== filterId)
        : [...prev, filterId]
    );
  }, []);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setActiveFilters([]);
    setSearchTerm('');
  }, []);

  // Check if any filters are active
  const hasActiveFilters = activeFilters.length > 0 || !!searchTerm;

  return (
    <div className={cn('space-y-4', className)}>
      {/* Search and Filter Row */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            type="text"
            placeholder={placeholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-10"
          />
          {searchTerm && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSearchTerm('')}
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0"
              title="Clear search"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>

        {/* Filter Dropdown */}
        {showFilters && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Filters
                {activeFilters.length > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {activeFilters.length}
                  </Badge>
                )}
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Filter Teams</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {filterOptions.map((option) => (
                <DropdownMenuItem
                  key={option.id}
                  onClick={() => toggleFilter(option.id)}
                  className="flex items-center justify-between"
                >
                  <span>{option.label}</span>
                  {activeFilters.includes(option.id) && (
                    <Badge variant="secondary" className="text-xs">✓</Badge>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">Active filters:</span>

          {/* Search term badge */}
          {searchTerm && (
            <Badge variant="secondary" className="flex items-center gap-1">
              Search: {searchTerm}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSearchTerm('')}
                className="h-4 w-4 p-0 hover:bg-transparent"
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          )}

          {/* Active filter badges */}
          {activeFilters.map(filterId => {
            const option = filterOptions.find(opt => opt.id === filterId);
            if (!option) return null;

            return (
              <Badge key={filterId} variant="secondary" className="flex items-center gap-1">
                {option.label}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleFilter(filterId)}
                  className="h-4 w-4 p-0 hover:bg-transparent"
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            );
          })}

          {/* Clear all button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="text-xs h-auto p-1"
          >
            Clear all
          </Button>
        </div>
      )}

      {/* Results Summary */}
      <div className="text-sm text-muted-foreground">
        Showing {filteredTeams.length} of {teams.length} teams
        {hasActiveFilters && (
          <span className="ml-1">
            ({teams.length - filteredTeams.length} filtered out)
          </span>
        )}
      </div>
    </div>
  );
});

TeamSearchFilter.displayName = 'TeamSearchFilter';