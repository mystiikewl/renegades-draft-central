import React, { Suspense } from 'react';
import ErrorBoundary from '@/components/ErrorBoundary';
import {
  PageContainer,
  PageHeaderContainer,
  MainContentContainer
} from '@/components/layouts/PageContainer';
import { TeamAdminDashboard } from '@/components/admin/TeamAdminDashboard';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw, Users, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePerformanceMonitoring } from '@/hooks/usePerformanceMonitoring';
import { useIsMobile } from '@/hooks/use-mobile';
import { usePullToRefresh } from '@/hooks/useTouchInteractions';

// Loading skeleton component
const TeamAdminLoadingSkeleton = () => {
  const isMobile = useIsMobile();

  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="text-center space-y-2">
        <Skeleton className="h-8 w-64 mx-auto" />
        <Skeleton className="h-6 w-48 mx-auto" />
      </div>

      {/* Content skeleton */}
      <div className="space-y-4">
        <Skeleton className="h-96 w-full" />
      </div>

      {/* Button skeleton */}
      <div className="text-center">
        <Skeleton className={cn(
          "h-10 mx-auto",
          isMobile ? "w-full" : "w-32"
        )} />
      </div>
    </div>
  );
};

const TeamAdmin = () => {
  const isMobile = useIsMobile();

  // Performance monitoring
  usePerformanceMonitoring('TeamAdminPage');

  // Pull to refresh functionality
  usePullToRefresh(() => {
    window.location.reload();
  });

  const handleRefresh = React.useCallback(() => {
    window.location.reload();
  }, []);

  return (
    <>
      {/* SEO Meta Tags */}
      {(() => {
        React.useEffect(() => {
          document.title = 'Team Admin | Renegades Draft';

          // Add meta description
          let metaDesc = document.querySelector('meta[name="description"]');
          if (!metaDesc) {
            metaDesc = document.createElement('meta');
            metaDesc.setAttribute('name', 'description');
            document.head.appendChild(metaDesc);
          }
          metaDesc.setAttribute('content', 'Manage teams and league settings as a commissioner with powerful admin tools for your fantasy basketball league.');

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

      <ProtectedRoute adminOnly>
        <PageContainer maxWidth="7xl" padding="none">
          <div className="min-h-screen bg-background">
            {/* Mobile-specific header */}
            {isMobile && (
              <PageHeaderContainer sticky withBackdrop>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Shield className="h-6 w-6 text-primary" />
                    <h1 className="text-xl font-bold">Team Admin</h1>
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
              <div className="space-y-8">
                {/* Header Section */}
                <div className="text-center space-y-3">
                  <div className="flex items-center justify-center gap-3 mb-4">
                    <Shield className="h-12 w-12 text-primary" />
                    <div>
                      <h1 className="text-4xl font-bold text-primary">Team Admin Dashboard</h1>
                      <p className="text-xl text-muted-foreground">Manage all teams and league settings as a commissioner.</p>
                    </div>
                  </div>
                </div>

                <ErrorBoundary>
                  <Suspense fallback={<TeamAdminLoadingSkeleton />}>
                    {/* Team Admin Dashboard */}
                    <TeamAdminDashboard />
                  </Suspense>
                </ErrorBoundary>

                {/* Navigation Actions */}
                <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-8">
                  <Button
                    asChild
                    variant="outline"
                    size={isMobile ? "lg" : "default"}
                    className="w-full sm:w-auto"
                  >
                    <a href="/admin" className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Back to Admin Dashboard
                    </a>
                  </Button>
                </div>
              </div>
            </MainContentContainer>
          </div>
        </PageContainer>
      </ProtectedRoute>
    </>
  );
};

export default TeamAdmin;
