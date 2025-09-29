import React, { memo, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { LayoutDashboard, BarChart3, Search, X } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

interface ViewModeToggleProps {
  viewMode: 'dashboard' | 'analytics';
  setViewMode: (mode: 'dashboard' | 'analytics') => void;
}

export const ViewModeToggle = memo(({ viewMode, setViewMode }: ViewModeToggleProps) => {
  return (
    <div className="flex justify-center">
      <div className="flex bg-card rounded-lg p-1 shadow-sm border">
        <Button
          variant={viewMode === 'dashboard' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setViewMode('dashboard')}
          className="flex items-center gap-2"
        >
          <LayoutDashboard className="h-4 w-4" />
          Dashboard
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
  );
});

interface DashboardHeaderProps {
  viewMode: 'dashboard' | 'analytics';
  setViewMode: (mode: 'dashboard' | 'analytics') => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  isMobile: boolean;
}

export const DashboardHeader = memo(({
  viewMode,
  setViewMode,
  searchQuery,
  setSearchQuery,
  isMobile
}: DashboardHeaderProps) => {
  const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery);

  // Debounce local search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(localSearchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [localSearchQuery, setSearchQuery]);

  const clearSearch = () => {
    setLocalSearchQuery('');
    setSearchQuery('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className={cn(
          "font-bold text-primary",
          isMobile ? "text-2xl" : "text-3xl"
        )}>
          Team Hub
        </h1>
        <p className={cn(
          "text-muted-foreground",
          isMobile ? "text-sm" : "text-base"
        )}>
          Manage your team and explore the league.
        </p>
      </div>

      {/* View Mode Toggle */}
      <div className="flex justify-center">
        <div className="flex bg-card rounded-lg p-1 shadow-sm border">
          <Button
            variant={viewMode === 'dashboard' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('dashboard')}
            className="flex items-center gap-2"
          >
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
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

      {/* Search Bar */}
      <div className="max-w-md mx-auto">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search teams, players, or content..."
            value={localSearchQuery}
            onChange={(e) => setLocalSearchQuery(e.target.value)}
            className="pl-10 pr-10 bg-background/50 border rounded-lg"
          />
          {localSearchQuery && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearSearch}
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0 hover:bg-background/80"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        {localSearchQuery && (
          <p className="text-xs text-muted-foreground mt-1">
            Searching for "{localSearchQuery}"
          </p>
        )}
      </div>
    </div>
  );
});