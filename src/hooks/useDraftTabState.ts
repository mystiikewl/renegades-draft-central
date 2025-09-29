import { useState, useCallback } from 'react';
import type { DraftTabValue } from '@/config/draftTabsConfig';

interface UseDraftTabStateProps {
  initialTab: DraftTabValue;
  onTabChange?: (tab: DraftTabValue) => void;
}

export const useDraftTabState = ({ initialTab, onTabChange }: UseDraftTabStateProps) => {
  const [activeTab, setActiveTab] = useState<DraftTabValue>(initialTab);

  const handleTabChange = useCallback((tab: DraftTabValue) => {
    setActiveTab(tab);
    onTabChange?.(tab);
  }, [onTabChange]);

  return {
    activeTab,
    setActiveTab: handleTabChange
  };
};