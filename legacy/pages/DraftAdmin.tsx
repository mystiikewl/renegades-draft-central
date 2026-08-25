import React, { useState, useCallback, Suspense } from 'react';
import ErrorBoundary from '@/components/ErrorBoundary';
import {
  PageContainer,
  PageHeaderContainer,
  MainContentContainer,
  SectionContainer
} from '@/components/layouts/PageContainer';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useDraftState } from '@/hooks/useDraftState';
import { Skeleton } from '@/components/ui/skeleton';
import { Settings, ListOrdered, UserRound, Users, RefreshCw, BarChart3, Shield, Activity, RotateCcw } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePerformanceMonitoring } from '@/hooks/usePerformanceMonitoring';
import { useIsMobile } from '@/hooks/use-mobile';
import { usePullToRefresh } from '@/hooks/useTouchInteractions';

// Loading skeleton component
const DraftAdminLoadingSkeleton = () => {
  const isMobile = useIsMobile();

  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="text-center space-y-2">
        <Skeleton className="h-8 w-64 mx-auto" />
        <Skeleton className="h-6 w-48 mx-auto" />
      </div>

      {/* Status cards skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>

      {/* Alert skeleton */}
      <Skeleton className="h-24 w-full" />

      {/* Configuration sections skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
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

const DraftAdmin: React.FC = () => {
  const { resetDraft, isDraftComplete, totalPicks, completedPicks, isLoadingDraftState } = useDraftState();
  const [isResetting, setIsResetting] = useState(false);
  const { toast } = useToast();
  const isMobile = useIsMobile();

  // Performance monitoring
  usePerformanceMonitoring('DraftAdminPage');

  // Pull to refresh functionality
  usePullToRefresh(() => {
    window.location.reload();
  });

  // SEO Meta Tags Effect
  React.useEffect(() => {
    document.title = 'Draft Admin | Renegades Draft';

    // Add meta description
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.setAttribute('name', 'description');
      document.head.appendChild(metaDesc);
    }
    metaDesc.setAttribute('content', 'Manage draft settings, order, and operations for your fantasy basketball league.');

    // Add viewport meta tag
    let viewport = document.querySelector('meta[name="viewport"]');
    if (!viewport) {
      viewport = document.createElement('meta');
      viewport.setAttribute('name', 'viewport');
      document.head.appendChild(viewport);
    }
    viewport.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=5');

    // Cleanup function (not needed since we're updating existing tags)
    return () => {
      // Cleanup not needed since we're updating existing tags
    };
  }, []);

  const handleRefresh = useCallback(() => {
    window.location.reload();
  }, []);

  const handleResetDraft = useCallback(async () => {
    if (!confirm('Are you sure you want to reset the entire draft? This will remove all picks and mark all players as undrafted.')) {
      return;
    }

    setIsResetting(true);
    await resetDraft();
    setIsResetting(false);
    toast({
      title: "Success",
      description: "Draft has been reset.",
    });
  }, [resetDraft, toast]);

  if (isLoadingDraftState) {
    return (
      <>
        {/* Accessibility Skip Links */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-primary text-primary-foreground px-4 py-2 rounded-md z-50 transition-all duration-200 hover:bg-primary/90"
        >
          Skip to main content
        </a>

        <PageContainer maxWidth="7xl" padding="none">
          <div className="min-h-screen bg-background">
            <div className="text-center space-y-3 p-8">
              <div className="flex items-center justify-center gap-3 mb-4">
                <Activity className="h-12 w-12 text-primary animate-pulse" />
                <div>
                  <h1 className="text-4xl font-bold text-primary">Draft Admin Dashboard</h1>
                  <p className="text-xl text-muted-foreground">Loading draft data...</p>
                </div>
              </div>
            </div>
            <DraftAdminLoadingSkeleton />
          </div>
        </PageContainer>
      </>
    );
  }

  return (
    <>
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
                  <h1 className="text-xl font-bold">Draft Admin Dashboard</h1>
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
              <Suspense fallback={<DraftAdminLoadingSkeleton />}>
                <div className="space-y-8">
                  {/* Header Section */}
                  <div className="text-center space-y-3">
                    <div className="flex items-center justify-center gap-3 mb-4">
                      <Shield className="h-12 w-12 text-primary" />
                      <div>
                        <h1 className="text-4xl font-bold text-primary">Draft Admin Dashboard</h1>
                        <p className="text-xl text-muted-foreground">Manage all draft-related settings and operations.</p>
                      </div>
                    </div>
                  </div>

        <div className="space-y-6">
          {/* Draft Status Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Draft Status
              </CardTitle>
              <CardDescription>Current state of the draft and reset functionality.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
                <div className="text-center">
                  <div className="text-2xl font-bold">{totalPicks}</div>
                  <div className="text-sm text-muted-foreground">Total Picks</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{completedPicks}</div>
                  <div className="text-sm text-muted-foreground">Completed</div>
                </div>
                <div className="text-center">
                  <div className={`text-2xl font-bold ${isDraftComplete ? 'text-green-600' : 'text-yellow-600'}`}>
                    {isDraftComplete ? 'Complete' : 'In Progress'}
                  </div>
                  <div className="text-sm text-muted-foreground">Status</div>
                </div>
              </div>

              <Alert variant="destructive" className="border-destructive/50">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Danger Zone</AlertTitle>
                <AlertDescription>
                  Resetting the draft will remove all picks and mark all players as undrafted. This action cannot be undone.
                </AlertDescription>
                <div className="mt-4">
                  <Button
                    variant="destructive"
                    onClick={handleResetDraft}
                    disabled={isResetting}
                    className="w-full"
                  >
                    <RefreshCw className={`mr-2 h-4 w-4 ${isResetting ? 'animate-spin' : ''}`} />
                    {isResetting ? 'Resetting...' : 'Reset Entire Draft'}
                  </Button>
                </div>
              </Alert>
            </CardContent>
          </Card>

          {/* Configuration Section */}
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">Configuration</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="p-4 hover:shadow-md transition-shadow">
                <CardHeader className="p-0 mb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    General Settings
                  </CardTitle>
                  <CardDescription>Configure overall draft settings.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <Button asChild className="w-full">
                    <Link to="/admin/draft/settings">Go to General Settings</Link>
                  </Button>
                </CardContent>
              </Card>

              <Card className="p-4 hover:shadow-md transition-shadow">
                <CardHeader className="p-0 mb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ListOrdered className="h-5 w-5" />
                    Draft Order
                  </CardTitle>
                  <CardDescription>Manage the draft order for all rounds.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <Button asChild className="w-full">
                    <Link to="/admin/draft/order">Go to Draft Order</Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Operations Section */}
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">Operations</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Card className="p-4 hover:shadow-md transition-shadow">
                <CardHeader className="p-0 mb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <UserRound className="h-5 w-5" />
                    Picks Trading
                  </CardTitle>
                  <CardDescription>Facilitate trading of draft picks between teams.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <Button asChild className="w-full">
                    <Link to="/admin/draft/trades">Go to Picks Trading</Link>
                  </Button>
                </CardContent>
              </Card>

              <Card className="p-4 hover:shadow-md transition-shadow">
                <CardHeader className="p-0 mb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Keeper Management
                  </CardTitle>
                  <CardDescription>Manage player keepers for each team.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <Button asChild className="w-full">
                    <Link to="/admin/draft/keepers">Go to Keeper Management</Link>
                  </Button>
                </CardContent>
              </Card>

              <Card className="p-4 hover:shadow-md transition-shadow">
                <CardHeader className="p-0 mb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <RotateCcw className="h-5 w-5" />
                    Draft Rollback
                  </CardTitle>
                  <CardDescription>Rollback draft picks to correct mistakes or restart from a specific point.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <Button asChild className="w-full">
                    <Link to="/admin/draft/rollback">Go to Draft Rollback</Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

                  {/* Navigation Actions */}
                  <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-8">
                    <Button
                      asChild
                      variant="outline"
                      size={isMobile ? "lg" : "default"}
                      className="w-full sm:w-auto"
                    >
                      <Link to="/admin" className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Back to Admin Dashboard
                      </Link>
                    </Button>
                  </div>
                </div>
              </Suspense>
            </ErrorBoundary>
          </MainContentContainer>
        </div>
      </PageContainer>
    </>
  );
};

export default DraftAdmin;
