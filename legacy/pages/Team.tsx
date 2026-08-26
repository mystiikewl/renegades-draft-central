import React, { Suspense, useCallback } from 'react';
import ErrorBoundary from '@/components/ErrorBoundary';
import {
  PageContainer,
  PageHeaderContainer,
  MainContentContainer
} from '@/components/layouts/PageContainer';
import { TeamDashboard } from '@/components/TeamDashboard';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePerformanceMonitoring } from '@/hooks/usePerformanceMonitoring';
import { useIsMobile } from '@/hooks/use-mobile';
import { useNavigationSwipe, usePullToRefresh } from '@/hooks/useTouchInteractions';

// Loading skeleton component
const TeamLoadingSkeleton = () => {
  const isMobile = useIsMobile();

  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="text-center space-y-2">
        <Skeleton className="h-8 w-64 mx-auto" />
        <Skeleton className="h-6 w-48 mx-auto" />
      </div>

      {/* View mode toggle skeleton */}
      <div className="flex justify-center">
        <Skeleton className="h-10 w-48" />
      </div>

      {/* Search skeleton */}
      <Skeleton className="h-10 w-full max-w-md mx-auto" />

      {/* Navigation skeleton */}
      <Skeleton className={cn(
        "h-10 mx-auto",
        isMobile ? "w-full" : "w-96"
      )} />

      {/* Content skeleton */}
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  );
};

const Team = () => {
  const isMobile = useIsMobile();

  // Performance monitoring
  usePerformanceMonitoring('TeamPage');

  // Mobile navigation swipes
  const { isTouching } = useNavigationSwipe();

  // Pull to refresh functionality
  usePullToRefresh(() => {
    window.location.reload();
  });

  const handleRefresh = useCallback(() => {
    window.location.reload();
  }, []);

  return (
    <>
      {/* SEO Meta Tags (using document API since react-helmet-async is not installed) */}
      {(() => {
        React.useEffect(() => {
          document.title = 'Team Hub | Renegades Draft';

          // Add meta description
          let metaDesc = document.querySelector('meta[name="description"]');
          if (!metaDesc) {
            metaDesc = document.createElement('meta');
            metaDesc.setAttribute('name', 'description');
            document.head.appendChild(metaDesc);
          }
          metaDesc.setAttribute('content', 'Manage your fantasy basketball team, view analytics, and track performance.');

          // Add viewport meta tag
          let viewport = document.querySelector('meta[name="viewport"]');
          if (!viewport) {
            viewport = document.createElement('meta');
            viewport.setAttribute('name', 'viewport');
            document.head.appendChild(viewport);
          }
          viewport.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=5');

          return () => {
            // Cleanup not needed since we're updating existing tags
          };
        }, []);
        return null;
      })()}

      {/* Accessibility Skip Links */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-primary text-primary-foreground px-4 py-2 rounded-md z-50 transition-all duration-200 hover:bg-primary/90"
      >
        Skip to main content
      </a>

      <PageContainer maxWidth="7xl" padding="none">
        <div className="min-h-screen bg-background">
          {/* Mobile-specific header adjustments */}
          {isMobile && (
            <PageHeaderContainer sticky withBackdrop>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-bold">Team Hub</h1>
                  {isTouching && (
                    <div className="text-xs text-muted-foreground animate-pulse">
                      Swipe to navigate
                    </div>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRefresh}
                  className="flex items-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </PageHeaderContainer>
          )}

          {/* Main Content */}
          <MainContentContainer
            id="main-content"
            withBottomPadding={isMobile}
          >
            <ErrorBoundary>
              <Suspense fallback={<TeamLoadingSkeleton />}>
                <TeamDashboard />
              </Suspense>
            </ErrorBoundary>
          </MainContentContainer>
        </div>
      </PageContainer>
    </>
  );
};

export default Team;
