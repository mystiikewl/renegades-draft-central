const TEAM_COLOURS = [
  '#2563EB',
  '#DB2777',
  '#7C3AED',
  '#0891B2',
  '#16A34A',
  '#D97706',
  '#DC2626',
  '#4F46E5',
] as const;

export function getTeamColour(teamId: string) {
  const total = [...teamId].reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return TEAM_COLOURS[total % TEAM_COLOURS.length];
}
