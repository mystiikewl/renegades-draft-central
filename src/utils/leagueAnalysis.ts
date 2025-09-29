import { Tables } from '@/integrations/supabase/types';
import { calculateFantasyScore } from '@/utils/fantasyScore';
import { getCombinedPlayersForTeam as getCombinedPlayers, transformDraftedPlayerData, transformKeeperData } from '@/utils/playerDataUtils';

type KeeperPlayer = Tables<'keepers'> & { player: Tables<'players'> };

// Helper to combine drafted players and keepers for a team
export const getCombinedPlayersForTeam = (
  teamId: string,
  season: string,
  draftPicks: (Tables<'draft_picks'> & { player: Tables<'players'> | null; original_team: Tables<'teams'>; current_team: Tables<'teams'>; })[],
  keepersData: KeeperPlayer[]
) => {
  try {
    const teamDraftPicks = draftPicks.filter(pick => pick.current_team_id === teamId && pick.player);

    const mappedDraftedPlayers = teamDraftPicks.map(pick => ({
      ...pick.player!,
      round: pick.round,
      pick: pick.pick_number,
      overallPick: draftPicks.findIndex(dp => dp.id === pick.id) + 1,
      nbaTeam: pick.player!.nba_team,
    })) as (Tables<'players'> & { round: number; pick: number; overallPick: number; nbaTeam: string; })[];

    // Filter keepers by team and transform to consistent structure
    const teamKeepers = keepersData.filter(keeper => {
      if ('team_id' in keeper) {
        return keeper.team_id === teamId;
      }
      return false;
    });

    // Transform keepers data to ensure consistency
    const transformedKeepers = transformKeeperData(teamKeepers);

    const allPlayers: (Tables<'players'> | KeeperPlayer)[] = [
      ...transformedKeepers,
      ...mappedDraftedPlayers,
    ];

    return allPlayers;
  } catch (error) {
    console.error('Error in getCombinedPlayersForTeam:', error);
    // Fallback: return only drafted players if there's an error
    const teamDraftPicks = draftPicks.filter(pick => pick.current_team_id === teamId && pick.player);
    const mappedDraftedPlayers = teamDraftPicks.map(pick => ({
      ...pick.player!,
      round: pick.round,
      pick: pick.pick_number,
      overallPick: draftPicks.findIndex(dp => dp.id === pick.id) + 1,
      nbaTeam: pick.player!.nba_team,
    })) as (Tables<'players'> & { round: number; pick: number; overallPick: number; nbaTeam: string; })[];

    return mappedDraftedPlayers;
  }
};

// Helper to calculate team stats
export interface TeamStats {
  teamId: string;
  teamName: string;
  totalFantasyScore: number;
  avgFantasyScore: number;
  playerCount: number;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  three_pointers_made: number;
  players: (Tables<'players'> | KeeperPlayer)[]; // Add players array
}

export const calculateTeamStats = (teamId: string, teamName: string, players: (Tables<'players'> | KeeperPlayer)[]): TeamStats => {
  let totalFantasyScore = 0;
  let totalPoints = 0;
  let totalRebounds = 0;
  let totalAssists = 0;
  let totalSteals = 0;
  let totalBlocks = 0;
  let totalTurnovers = 0;
  let totalThreePointersMade = 0;

  players.forEach(p => {
    const playerData = 'player' in p ? p.player : p;
    totalFantasyScore += calculateFantasyScore(playerData);
    totalPoints += playerData.points || 0;
    totalRebounds += playerData.total_rebounds || 0;
    totalAssists += playerData.assists || 0;
    totalSteals += playerData.steals || 0;
    totalBlocks += playerData.blocks || 0;
    totalTurnovers += playerData.turnovers || 0;
    totalThreePointersMade += playerData.three_pointers_made || 0;
  });

  return {
    teamId,
    teamName,
    totalFantasyScore: parseFloat(totalFantasyScore.toFixed(2)),
    avgFantasyScore: players.length > 0 ? parseFloat((totalFantasyScore / players.length).toFixed(2)) : 0,
    playerCount: players.length,
    points: totalPoints,
    rebounds: totalRebounds,
    assists: totalAssists,
    steals: totalSteals,
    blocks: totalBlocks,
    turnovers: totalTurnovers,
    three_pointers_made: totalThreePointersMade,
    players: players, // Include the players array
  };
};

export const prepareRadarChartData = (
  selectedTeamForRadar: string,
  allTeamStats: TeamStats[],
  selectedTeamName: string
) => {
  if (!selectedTeamForRadar || allTeamStats.length === 0) return [];

  const selectedTeamStats = allTeamStats.find(ts => ts.teamId === selectedTeamForRadar);
  if (!selectedTeamStats) return [];

  // Calculate max values for normalization
  const maxPoints = Math.max(...allTeamStats.map(s => s.points));
  const maxRebounds = Math.max(...allTeamStats.map(s => s.rebounds));
  const maxAssists = Math.max(...allTeamStats.map(s => s.assists));
  const maxSteals = Math.max(...allTeamStats.map(s => s.steals));
  const maxBlocks = Math.max(...allTeamStats.map(s => s.blocks));
  const maxThreePointersMade = Math.max(...allTeamStats.map(s => s.three_pointers_made));
  const minTurnovers = Math.min(...allTeamStats.map(s => s.turnovers)); // For turnovers, lower is better
  const maxTurnovers = Math.max(...allTeamStats.map(s => s.turnovers)); // Also need max for inverse normalization

  // Calculate league averages
  const leagueAvg = allTeamStats.reduce((acc, curr) => {
    acc.points += curr.points;
    acc.rebounds += curr.rebounds;
    acc.assists += curr.assists;
    acc.steals += curr.steals;
    acc.blocks += curr.blocks;
    acc.turnovers += curr.turnovers;
    acc.three_pointers_made += curr.three_pointers_made;
    return acc;
  }, {
    points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0, turnovers: 0, three_pointers_made: 0
  });

  const numTeams = allTeamStats.length;
  const avgPoints = leagueAvg.points / numTeams;
  const avgRebounds = leagueAvg.rebounds / numTeams;
  const avgAssists = leagueAvg.assists / numTeams;
  const avgSteals = leagueAvg.steals / numTeams;
  const avgBlocks = leagueAvg.blocks / numTeams;
  const avgTurnovers = leagueAvg.turnovers / numTeams;
  const avgThreePointersMade = leagueAvg.three_pointers_made / numTeams;

  // Normalize data for radar chart (0-100 scale)
  const normalize = (value: number, max: number, isInverse = false) => {
    if (max === 0) return 50; // Avoid division by zero, set to mid-point
    if (isInverse) {
      // For inverse metrics (like turnovers), higher value means worse, so normalize inversely
      return 100 - ((value - minTurnovers) / (maxTurnovers - minTurnovers)) * 100;
    }
    return (value / max) * 100;
  };

  return [
    {
      subject: 'Points',
      [selectedTeamName]: normalize(selectedTeamStats.points, maxPoints),
      'League Average': normalize(avgPoints, maxPoints),
      fullMark: 100,
    },
    {
      subject: 'Rebounds',
      [selectedTeamName]: normalize(selectedTeamStats.rebounds, maxRebounds),
      'League Average': normalize(avgRebounds, maxRebounds),
      fullMark: 100,
    },
    {
      subject: 'Assists',
      [selectedTeamName]: normalize(selectedTeamStats.assists, maxAssists),
      'League Average': normalize(avgAssists, maxAssists),
      fullMark: 100,
    },
    {
      subject: 'Steals',
      [selectedTeamName]: normalize(selectedTeamStats.steals, maxSteals),
      'League Average': normalize(avgSteals, maxSteals),
      fullMark: 100,
    },
    {
      subject: 'Blocks',
      [selectedTeamName]: normalize(selectedTeamStats.blocks, maxBlocks),
      'League Average': normalize(avgBlocks, maxBlocks),
      fullMark: 100,
    },
    {
      subject: '3PM',
      [selectedTeamName]: normalize(selectedTeamStats.three_pointers_made, maxThreePointersMade),
      'League Average': normalize(avgThreePointersMade, maxThreePointersMade),
      fullMark: 100,
    },
    {
      subject: 'Turnovers',
      [selectedTeamName]: normalize(selectedTeamStats.turnovers, maxTurnovers, true), // Inverse normalization
      'League Average': normalize(avgTurnovers, maxTurnovers, true),
      fullMark: 100,
    },
  ];
};

// New data processing functions for the three new visualizations

export interface DraftEfficiencyData {
  pickNumber: number;
  fantasyScore: number;
  playerName: string;
  teamName: string;
  position: string;
}

export interface PositionalBalanceData {
  position: string;
  count: number;
  teamName: string;
  idealCount: number;
}

/**
 * Calculate draft efficiency data for scatter plot
 */
export function calculateDraftEfficiencyData(
  draftPicks: (Tables<'draft_picks'> & { player: Tables<'players'> | null; original_team: Tables<'teams'>; current_team: Tables<'teams'>; })[]
): DraftEfficiencyData[] {
  return draftPicks
    .filter(pick => pick.player)
    .map(pick => ({
      pickNumber: pick.pick_number,
      fantasyScore: calculateFantasyScore(pick.player!),
      playerName: pick.player!.name,
      teamName: pick.current_team.name,
      position: pick.player!.position || 'Unknown',
    }))
    .sort((a, b) => a.pickNumber - b.pickNumber);
}

/**
 * Calculate positional balance data for radar chart
 */
export function calculatePositionalBalanceData(
  teamId: string,
  season: string,
  draftPicks: (Tables<'draft_picks'> & { player: Tables<'players'> | null; original_team: Tables<'teams'>; current_team: Tables<'teams'>; })[],
  keepersData: KeeperPlayer[],
  teamName: string
): PositionalBalanceData[] {
  const teamPlayers = getCombinedPlayersForTeam(teamId, season, draftPicks, keepersData);

  // Count players by position
  const positionCounts: Record<string, number> = {};
  teamPlayers.forEach(player => {
    const position = 'position' in player ? player.position : (player as any).position || 'Unknown';
    positionCounts[position] = (positionCounts[position] || 0) + 1;
  });

  // Standard NBA positions
  const standardPositions = ['PG', 'SG', 'SF', 'PF', 'C'];
  const idealRosterSize = 12; // Assuming 12-player rosters
  const idealPerPosition = Math.floor(idealRosterSize / standardPositions.length);

  return standardPositions.map(position => ({
    position,
    count: positionCounts[position] || 0,
    teamName,
    idealCount: idealPerPosition,
  }));
}

/**
 * Prepare positional balance data for radar chart
 */
export function preparePositionalBalanceChartData(
  positionalData: PositionalBalanceData[]
): Array<{ position: string; [key: string]: number | string }> {
  if (positionalData.length === 0) return [];

  const teamName = positionalData[0].teamName;
  const maxCount = Math.max(...positionalData.map(d => d.count));
  const maxIdeal = Math.max(...positionalData.map(d => d.idealCount));

  return positionalData.map(data => ({
    position: data.position,
    [teamName]: data.count,
    'Ideal Balance': data.idealCount,
    fullMark: Math.max(maxCount, maxIdeal) + 1,
  }));
}
