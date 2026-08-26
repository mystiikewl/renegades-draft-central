import { useState, useEffect } from 'react';
import { Tables } from '@/integrations/supabase/types';

export interface FantasySettings {
  name: string;
  scoring_rules: {
    points: number;
    rebounds: number;
    assists: number;
    steals: number;
    blocks: number;
    three_pointers_made: number;
    turnovers: number;
  };
  thresholds: {
    points: number;
    rebounds: number;
    assists: number;
    steals: number;
    blocks: number;
    three_pointers_made: number;
    turnovers: number;
  };
}

const DEFAULT_SETTINGS: FantasySettings = {
  name: 'Default Fantasy Settings',
  scoring_rules: {
    points: 1.0,
    rebounds: 1.2,
    assists: 1.5,
    steals: 3.0,
    blocks: 3.0,
    three_pointers_made: 1.0,
    turnovers: -1.0,
  },
  thresholds: {
    points: 20,
    rebounds: 8,
    assists: 6,
    steals: 1.2,
    blocks: 1.0,
    three_pointers_made: 2.5,
    turnovers: 2.5,
  },
};

// Client-side storage key
const FANTASY_SETTINGS_KEY = 'fantasy-settings';

export const useFantasySettings = (leagueId?: string) => {
  const [settings, setSettings] = useState<FantasySettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  // Load settings from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(FANTASY_SETTINGS_KEY);
      if (stored) {
        const parsedSettings = JSON.parse(stored);
        setSettings({ ...DEFAULT_SETTINGS, ...parsedSettings });
      }
    } catch (error) {
      console.error('Error loading fantasy settings:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save settings to localStorage
  const saveSettings = (newSettings: FantasySettings) => {
    try {
      localStorage.setItem(FANTASY_SETTINGS_KEY, JSON.stringify(newSettings));
      setSettings(newSettings);
    } catch (error) {
      console.error('Error saving fantasy settings:', error);
    }
  };

  // Update scoring rules
  const updateScoringRules = (rules: Partial<FantasySettings['scoring_rules']>) => {
    const newSettings = {
      ...settings,
      scoring_rules: { ...settings.scoring_rules, ...rules },
    };
    saveSettings(newSettings);
  };

  // Update thresholds
  const updateThresholds = (thresholds: Partial<FantasySettings['thresholds']>) => {
    const newSettings = {
      ...settings,
      thresholds: { ...settings.thresholds, ...thresholds },
    };
    saveSettings(newSettings);
  };

  // Reset to defaults
  const resetToDefaults = () => {
    saveSettings(DEFAULT_SETTINGS);
  };

  return {
    settings,
    isLoading,
    saveSettings,
    updateScoringRules,
    updateThresholds,
    resetToDefaults,
    isSaving: false,
    error: null,
  };
};

// Hook for getting effective settings (user settings or defaults)
export const useEffectiveFantasySettings = (leagueId?: string) => {
  const { settings, isLoading } = useFantasySettings(leagueId);

  return {
    settings: settings || DEFAULT_SETTINGS,
    isLoading,
  };
};

// Utility function to calculate fantasy score with custom rules
export const calculateFantasyScoreWithRules = (
  player: Tables<'players'>,
  scoringRules: FantasySettings['scoring_rules']
) => {
  return (
    (player.points || 0) * scoringRules.points +
    (player.total_rebounds || 0) * scoringRules.rebounds +
    (player.assists || 0) * scoringRules.assists +
    (player.steals || 0) * scoringRules.steals +
    (player.blocks || 0) * scoringRules.blocks +
    (player.three_pointers_made || 0) * scoringRules.three_pointers_made +
    (player.turnovers || 0) * scoringRules.turnovers
  );
};