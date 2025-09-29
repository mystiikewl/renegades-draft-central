import React, { memo, useMemo } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Users, Globe, Shield } from 'lucide-react';

interface Tab {
  value: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavigationTabsProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isAdmin: boolean;
  isMobile: boolean;
}

export const NavigationTabs = memo(({
  activeTab,
  setActiveTab,
  isAdmin,
  isMobile
}: NavigationTabsProps) => {
  const tabs = useMemo<Tab[]>(() => [
    { value: 'my-team', label: 'My Team', icon: Users },
    { value: 'all-teams', label: 'All Teams', icon: Globe },
    ...(isAdmin ? [{ value: 'admin', label: 'Admin', icon: Shield }] : [])
  ], [isAdmin]);

  if (isMobile) {
    return (
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-2 z-10">
        <div className="flex justify-around">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <Button
                key={tab.value}
                variant={activeTab === tab.value ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab(tab.value)}
                className="flex flex-col items-center gap-1 h-auto py-2 px-1"
              >
                <Icon className="h-4 w-4" />
                <span className="text-xs">{tab.label}</span>
              </Button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="grid w-full grid-cols-2 md:grid-cols-3">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="flex items-center gap-2"
            >
              <Icon className="h-4 w-4" />
              {!isMobile && tab.label}
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
});