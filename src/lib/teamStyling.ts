import { getTeamColorPalette, type TeamColorPalette } from './teams';

/**
 * Enhanced team styling utilities for consistent team color usage
 */

export interface TeamStylingOptions {
  teamName: string;
  teams: string[];
  intensity?: 'light' | 'normal' | 'intense';
  withAnimations?: boolean;
}

export const getTeamGradient = (
  teamName: string,
  teams: string[],
  intensity: 'light' | 'normal' | 'intense' = 'normal'
): string => {
  const palette = getTeamColorPalette(teamName, teams);
  const alpha = intensity === 'light' ? '20' : intensity === 'intense' ? '80' : '40';

  return `linear-gradient(135deg, ${palette.primary}${alpha}, ${palette.secondary}${alpha}, hsl(var(--background)))`;
};

export const getTeamGlow = (teamName: string, teams: string[]): string => {
  const palette = getTeamColorPalette(teamName, teams);
  return `0 0 20px ${palette.accent}40`;
};

export const getTeamTextStyle = (teamName: string, teams: string[]): React.CSSProperties => {
  const palette = getTeamColorPalette(teamName, teams);
  return {
    color: palette.text,
    textShadow: `0 0 10px ${palette.accent}30`,
  };
};

export const getTeamPulseAnimation = (teamName: string, teams: string[]): React.CSSProperties => {
  const palette = getTeamColorPalette(teamName, teams);
  return {
    animation: 'pulse-glow-team 2s ease-in-out infinite alternate',
    color: palette.primary,
    textShadow: `0 0 10px ${palette.accent}80`,
  };
};

export const getTeamCardStyle = (teamName: string, teams: string[]): React.CSSProperties => {
  const palette = getTeamColorPalette(teamName, teams);
  return {
    background: `linear-gradient(135deg, ${palette.primary}15, ${palette.secondary}10)`,
    backgroundSize: '200% 200%',
    animation: 'gradient-shift 4s ease infinite',
    border: `2px solid ${palette.primary}30`,
    boxShadow: `0 4px 20px ${palette.primary}20`,
  };
};

export const getTeamIconStyle = (teamName: string, teams: string[]): React.CSSProperties => {
  const palette = getTeamColorPalette(teamName, teams);
  return {
    color: palette.primary,
    filter: `drop-shadow(0 0 5px ${palette.accent}60)`,
  };
};

/**
 * Hook for getting consistent team styling
 */
export const useTeamStyling = (options: TeamStylingOptions) => {
  const { teamName, teams, intensity = 'normal', withAnimations = true } = options;

  if (!teamName || !teams.includes(teamName)) {
    return {
      gradient: 'var(--gradient-hero)',
      glow: 'none',
      textStyle: {},
      pulseAnimation: {},
      cardStyle: {},
      iconStyle: {},
    };
  }

  const palette = getTeamColorPalette(teamName, teams);
  const alpha = intensity === 'light' ? '20' : intensity === 'intense' ? '80' : '40';

  return {
    gradient: `linear-gradient(135deg, ${palette.primary}${alpha}, ${palette.secondary}${alpha}, hsl(var(--background)))`,
    glow: `0 0 20px ${palette.accent}40`,
    textStyle: {
      color: palette.text,
      textShadow: `0 0 10px ${palette.accent}30`,
    },
    pulseAnimation: withAnimations ? {
      animation: 'pulse-glow-team 2s ease-in-out infinite alternate',
      color: palette.primary,
      textShadow: `0 0 10px ${palette.accent}80`,
    } : {},
    cardStyle: withAnimations ? {
      background: `linear-gradient(135deg, ${palette.primary}15, ${palette.secondary}10)`,
      backgroundSize: '200% 200%',
      animation: 'gradient-shift 4s ease infinite',
      border: `2px solid ${palette.primary}30`,
      boxShadow: `0 4px 20px ${palette.primary}20`,
    } : {
      background: `linear-gradient(135deg, ${palette.primary}15, ${palette.secondary}10)`,
      border: `2px solid ${palette.primary}30`,
      boxShadow: `0 4px 20px ${palette.primary}20`,
    },
    iconStyle: {
      color: palette.primary,
      filter: `drop-shadow(0 0 5px ${palette.accent}60)`,
    },
  };
};

/**
 * Utility function to get team color with opacity
 */
export const getTeamColorWithOpacity = (
  teamName: string,
  teams: string[],
  opacity: number = 0.5
): string => {
  const palette = getTeamColorPalette(teamName, teams);
  const alpha = Math.round(opacity * 255).toString(16).padStart(2, '0');
  return `${palette.primary}${alpha}`;
};

/**
 * Get team-specific CSS custom properties
 */
export const getTeamCSSVariables = (teamName: string, teams: string[]): Record<string, string> => {
  const palette = getTeamColorPalette(teamName, teams);
  return {
    '--team-primary': palette.primary,
    '--team-secondary': palette.secondary,
    '--team-accent': palette.accent,
    '--team-text': palette.text,
    '--team-background': palette.background,
  };
};