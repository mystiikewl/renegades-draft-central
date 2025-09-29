import React, { Suspense, useCallback } from 'react';
import ErrorBoundary from '@/components/ErrorBoundary';
import {
  PageContainer,
  PageHeaderContainer,
  MainContentContainer
} from '@/components/layouts/PageContainer';
import { PlayerImportAdmin } from '@/components/PlayerImportAdmin';
import { Button } from '@/components/ui/button';
import AdminSettings from '@/components/admin/AdminSettings';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw, Shield, Users, Settings, Database } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePerformanceMonitoring } from '@/hooks/usePerformanceMonitoring';
import { useIsMobile } from '@/hooks/use-mobile';
import { usePullToRefresh } from '@/hooks/useTouchInteractions';

// Loading skeleton component
const AdminLoadingSkeleton = () => {
  const isMobile = useIsMobile();

  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="text-center space-y-2">
        <Skeleton className="h-8 w-64 mx-auto" />
        <Skeleton className="h-6 w-48 mx-auto" />
      </div>

      {/* Settings skeleton */}
      <Skeleton className="h-96 w-full" />

      {/* Cards skeleton */}
      <div className="space-y-4">
        <Skeleton className="h-48 w-full" />
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

const Admin = () => {
  const isMobile = useIsMobile();

  // Performance monitoring
  usePerformanceMonitoring('AdminPage');

  // Pull to refresh functionality
  usePullToRefresh(() => {
    window.location.reload();
  });

  const handleRefresh = useCallback(() => {
    window.location.reload();
  }, []);

  return (
    <>
      {/* SEO Meta Tags */}
      {(() => {
        React.useEffect(() => {
          document.title = 'Admin Dashboard | Renegades Draft';

          // Add meta description
          let metaDesc = document.querySelector('meta[name="description"]');
          if (!metaDesc) {
            metaDesc = document.createElement('meta');
            metaDesc.setAttribute('name', 'description');
            document.head.appendChild(metaDesc);
          }
          metaDesc.setAttribute('content', 'Manage your fantasy basketball league settings, players, and teams with powerful admin tools.');

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
          {/* Mobile-specific header */}
          {isMobile && (
            <PageHeaderContainer sticky withBackdrop>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Shield className="h-6 w-6 text-primary" />
                  <h1 className="text-xl font-bold">Admin Dashboard</h1>
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
                    <h1 className="text-4xl font-bold text-primary">League Admin Dashboard</h1>
                    <p className="text-xl text-muted-foreground">Manage your league settings, players, and teams.</p>
                  </div>
                </div>
              </div>

              <ErrorBoundary>
                <Suspense fallback={<AdminLoadingSkeleton />}>
                  {/* Admin Settings Navigation Hub */}
                  <div className="space-y-8">
                    <Card className="border-primary/20 shadow-lg">
                      <CardHeader className="text-center">
                        <CardTitle className="flex items-center justify-center gap-2 text-xl">
                          <Settings className="h-6 w-6" />
                          League Management Tools
                        </CardTitle>
                        <CardDescription>
                          Access all administrative functions and league management tools from this central hub.
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <AdminSettings />
                      </CardContent>
                    </Card>

                    {/* Player Management Section */}
                    <Card className="border-primary/20 shadow-lg hover:shadow-xl transition-shadow duration-300">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-3 text-xl">
                          <Database className="h-6 w-6 text-primary" />
                          Player Management
                        </CardTitle>
                        <CardDescription>
                          Import, update, and manage player data for your fantasy basketball league.
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <PlayerImportAdmin />
                      </CardContent>
                    </Card>
                  </div>
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
                  <Link to="/" className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Back to Draft
                  </Link>
                </Button>
              </div>
            </div>
          </MainContentContainer>
        </div>
      </PageContainer>
    </>
  );
};

export default Admin;
