import React, { memo } from 'react';
import { TeamManagement } from '@/components/TeamManagement';
import { TeamSwitcher } from '@/components/TeamSwitcher';
import { TeamAdminDashboard } from '@/components/admin/TeamAdminDashboard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Globe, Shield, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DashboardContentProps {
  activeTab: string;
  viewMode: 'dashboard' | 'analytics';
  searchQuery: string;
  isAdmin: boolean;
  isMobile: boolean;
}

export const DashboardContent = memo(({
  activeTab,
  viewMode,
  searchQuery,
  isAdmin,
  isMobile
}: DashboardContentProps) => {
  // Filter content based on search query
  const shouldShowContent = !searchQuery || searchQuery.trim() === '';

  if (!shouldShowContent) {
    return (
      <Card className="bg-gradient-card shadow-card mt-6">
        <CardContent className={cn(
          "flex flex-col items-center justify-center",
          isMobile ? "py-8" : "py-12"
        )}>
          <Search className="h-12 w-12 text-muted-foreground mb-4" />
          <CardTitle className="text-lg mb-2">No results found</CardTitle>
          <p className="text-muted-foreground text-center max-w-md">
            No content matches your search for "{searchQuery}". Try adjusting your search terms.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (viewMode === 'analytics') {
    return (
      <Card className="bg-gradient-card shadow-card mt-6">
        <CardContent className={cn(
          "flex flex-col items-center justify-center",
          isMobile ? "py-8" : "py-12"
        )}>
          <CardTitle className="text-lg mb-2">Analytics Coming Soon</CardTitle>
          <p className="text-muted-foreground text-center max-w-md">
            Advanced analytics and insights for your team will be available here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn(
      "mt-6 space-y-6",
      isMobile && "pb-20" // Add bottom padding for mobile nav
    )}>
      {/* My Team Tab */}
      {activeTab === 'my-team' && (
        <Card className="bg-gradient-card shadow-card">
          <CardHeader className={cn(isMobile ? 'p-3' : 'p-4 md:p-6')}>
            <CardTitle className={cn(
              "flex items-center gap-2 font-bold",
              isMobile ? "text-lg" : "text-xl"
            )}>
              <Users className="h-5 w-5" />
              My Team
            </CardTitle>
          </CardHeader>
          <CardContent className={isMobile ? 'p-3 pt-0' : 'p-4 md:p-6 pt-0'}>
            <TeamManagement />
          </CardContent>
        </Card>
      )}

      {/* All Teams Tab */}
      {activeTab === 'all-teams' && (
        <Card className="bg-gradient-card shadow-card">
          <CardHeader className={cn(isMobile ? 'p-3' : 'p-4 md:p-6')}>
            <CardTitle className={cn(
              "flex items-center gap-2 font-bold",
              isMobile ? "text-lg" : "text-xl"
            )}>
              <Globe className="h-5 w-5" />
              All Teams
            </CardTitle>
          </CardHeader>
          <CardContent className={isMobile ? 'p-3 pt-0' : 'p-4 md:p-6 pt-0'}>
            <TeamSwitcher />
          </CardContent>
        </Card>
      )}

      {/* Admin Tab */}
      {activeTab === 'admin' && isAdmin && (
        <Card className="bg-gradient-card shadow-card">
          <CardHeader className={cn(isMobile ? 'p-3' : 'p-4 md:p-6')}>
            <CardTitle className={cn(
              "flex items-center gap-2 font-bold",
              isMobile ? "text-lg" : "text-xl"
            )}>
              <Shield className="h-5 w-5" />
              Admin Dashboard
            </CardTitle>
          </CardHeader>
          <CardContent className={isMobile ? 'p-3 pt-0' : 'p-4 md:p-6 pt-0'}>
            <TeamAdminDashboard />
          </CardContent>
        </Card>
      )}
    </div>
  );
});