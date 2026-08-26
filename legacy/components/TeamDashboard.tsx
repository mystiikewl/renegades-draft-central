import React, { useState, useEffect, useCallback, memo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { usePerformanceMonitoring } from '@/hooks/usePerformanceMonitoring';
import { DashboardHeader } from './team-dashboard/DashboardHeader';
import { NavigationTabs } from './team-dashboard/NavigationTabs';
import { DashboardContent } from './team-dashboard/DashboardContent';
import { TeamAnalyticsPanel } from './team-dashboard/TeamAnalyticsPanel';

export const TeamDashboard = memo(() => {
  const { profile } = useAuth();
  const isAdmin = profile?.is_admin;
  const isMobile = useIsMobile();

  // Enhanced state management
  const [activeTab, setActiveTab] = useState('my-team');
  const [viewMode, setViewMode] = useState<'dashboard' | 'analytics'>('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

  // Performance monitoring
  usePerformanceMonitoring('TeamDashboard');

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Keyboard navigation
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Handle global keyboard shortcuts
    if (event.key === 'd' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      setViewMode('dashboard');
    } else if (event.key === 'a' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      setViewMode('analytics');
    } else if (event.key === 'f' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      // Focus search input - this would need a ref to the search input
      document.getElementById('dashboard-search')?.focus();
    }
  }, []);

  // Add keyboard event listener
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Enhanced Header with View Mode Toggle and Search */}
        <DashboardHeader
          viewMode={viewMode}
          setViewMode={setViewMode}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          isMobile={isMobile}
        />

        {/* Enhanced Navigation */}
        <NavigationTabs
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isAdmin={isAdmin}
          isMobile={isMobile}
        />

        {/* Main Content Area */}
        <DashboardContent
          activeTab={activeTab}
          viewMode={viewMode}
          searchQuery={debouncedSearchQuery}
          isAdmin={isAdmin}
          isMobile={isMobile}
        />

        {/* Analytics Panel (shown when in analytics mode) */}
        {viewMode === 'analytics' && (
          <TeamAnalyticsPanel isMobile={isMobile} />
        )}
      </div>
    </div>
  );
});
