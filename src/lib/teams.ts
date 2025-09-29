export interface TeamColorPalette {
  primary: string;
  secondary: string;
  accent: string;
  text: string;
  background: string;
}

export const TEAM_COLOR_PALETTES: TeamColorPalette[] = [
  {
    // Fiery Red/Orange Team
    primary: '#FF4136',     // Fiery Red
    secondary: '#FF851B',   // Orange
    accent: '#FFDC00',      // Yellow
    text: '#FFFFFF',        // White
    background: '#85144b'   // Dark Red
  },
  {
    // Electric Green Team
    primary: '#2ECC40',     // Electric Green
    secondary: '#39CCCC',   // Teal
    accent: '#01FF70',      // Lime Green
    text: '#FFFFFF',        // White
    background: '#001f3f'   // Navy
  },
  {
    // Royal Blue Team
    primary: '#0074D9',     // Royal Blue
    secondary: '#7FDBFF',   // Light Blue
    accent: '#3D9970',      // Olive Green
    text: '#FFFFFF',        // White
    background: '#001f3f'   // Dark Blue
  },
  {
    // Hot Pink Team
    primary: '#FF41B4',     // Hot Pink
    secondary: '#F012BE',   // Fuschia
    accent: '#FF851B',      // Orange
    text: '#FFFFFF',        // White
    background: '#B10DC9'   // Purple
  },
  {
    // Vibrant Purple Team
    primary: '#B10DC9',     // Purple
    secondary: '#85144b',   // Maroon
    accent: '#FF4136',      // Red
    text: '#FFFFFF',        // White
    background: '#111111'   // Black
  },
  {
    // Aqua Blue Team
    primary: '#39CCCC',     // Aqua
    secondary: '#2ECC40',   // Green
    accent: '#0074D9',      // Blue
    text: '#FFFFFF',        // White
    background: '#001f3f'   // Dark Blue
  },
  {
    // Gold Team
    primary: '#FFD700',     // Gold
    secondary: '#FF851B',   // Orange
    accent: '#FF4136',      // Red
    text: '#001f3f',        // Navy (dark text for contrast)
    background: '#FFDC00'   // Light Gold
  },
  {
    // Tangerine Team
    primary: '#FF851B',     // Tangerine
    secondary: '#FF4136',   // Red
    accent: '#FFDC00',      // Yellow
    text: '#FFFFFF',        // White
    background: '#85144b'   // Dark Red
  },
  {
    // Indigo Team
    primary: '#663399',     // Indigo
    secondary: '#7FDBFF',   // Light Blue
    accent: '#2ECC40',      // Green
    text: '#FFFFFF',        // White
    background: '#111111'   // Black
  },
  {
    // Mint Green Team
    primary: '#3D9970',     // Mint Green
    secondary: '#2ECC40',   // Green
    accent: '#39CCCC',      // Teal
    text: '#FFFFFF',        // White
    background: '#001f3f'   // Dark Blue
  }
];

export const getTeamColor = (teamName: string, teams: string[]) => {
  const index = teams.indexOf(teamName);
  return TEAM_COLOR_PALETTES[index % TEAM_COLOR_PALETTES.length].primary;
};

export const getTeamColorPalette = (teamName: string, teams: string[]): TeamColorPalette => {
  const index = teams.indexOf(teamName);
  return TEAM_COLOR_PALETTES[index % TEAM_COLOR_PALETTES.length];
};
