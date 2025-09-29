import { supabase } from '../../../src/integrations/supabase/client';

import type { Team } from '../../../src/types/team';

import type { DraftSettings } from '../../../src/hooks/useDraftState';

export interface DraftPickInsert {
  round: number;
  pick_number: number;
  original_team_id: string;
  current_team_id: string;
}

export async function createDraftPicks(teams: Team[], settings: DraftSettings): Promise<void> {
  const picksToInsert: DraftPickInsert[] = [];
  const orderedTeamIds = settings.draftOrder.length > 0 ? settings.draftOrder : teams.map(team => team.id);
  
  for (let round = 1; round <= settings.roundCount; round++) {
    for (let pickIndex = 0; pickIndex < settings.teamCount; pickIndex++) {
      const isEvenRound = round % 2 === 0;
      let teamIdForPick: string;
      
      if (settings.draftType === 'snake') {
        teamIdForPick = isEvenRound ? orderedTeamIds[settings.teamCount - pickIndex - 1] : orderedTeamIds[pickIndex];
      } else if (settings.draftType === 'linear') {
        teamIdForPick = orderedTeamIds[pickIndex];
      } else {
        teamIdForPick = isEvenRound ? orderedTeamIds[settings.teamCount - pickIndex - 1] : orderedTeamIds[pickIndex];
      }
      
      const team = teams.find(t => t.id === teamIdForPick);
      if (team) {
        picksToInsert.push({
          round,
          pick_number: pickIndex + 1,
          original_team_id: team.id,
          current_team_id: team.id,
        });
      }
    }
  }
  
  const { error } = await supabase.from('draft_picks').insert(picksToInsert);
  if (error) {
    throw error;
  }
}

export async function resetDraftPlayers(): Promise<void> {
  const { error } = await supabase
    .from('players')
    .update({ 
      is_drafted: false,
      drafted_by_team_id: null,
      is_keeper: false
    })
    .is('is_drafted', true);
  if (error) {
    throw error;
  }
}

export async function clearDraftPicks(): Promise<void> {
  const { error } = await supabase
    .from('draft_picks')
    .delete();
  if (error) {
    throw error;
  }
}

export async function updatePlayerDrafted(playerId: string, teamId: string): Promise<void> {
  const { error } = await supabase
    .from('players')
    .update({
      is_drafted: true,
      drafted_by_team_id: teamId
    })
    .eq('id', playerId);
  if (error) {
    throw error;
  }
}

export async function getLeagueAverages(season: string): Promise<any> {
  const { data: players } = await supabase
    .from('players')
    .select('*')
    .gte('games_played', 10)
    .order('season', { ascending: false })
    .limit(500);

  if (!players || players.length === 0) {
    return {
      points: 0,
      rebounds: 0,
      assists: 0,
      steals: 0,
      blocks: 0,
      three_pointers_made: 0,
      field_goal_percentage: 0,
      free_throw_percentage: 0,
      turnovers: 0,
      games_played: 60,
      playerCount: 0,
    };
  }

  const avgPPG = players.reduce((sum, p) => sum + ((p.points || 0) / Math.max(1, p.games_played || 1)), 0) / players.length;
  const avgRPG = players.reduce((sum, p) => sum + ((p.total_rebounds || 0) / Math.max(1, p.games_played || 1)), 0) / players.length;
  const avgAPG = players.reduce((sum, p) => sum + ((p.assists || 0) / Math.max(1, p.games_played || 1)), 0) / players.length;
  const avgSPG = players.reduce((sum, p) => sum + ((p.steals || 0) / Math.max(1, p.games_played || 1)), 0) / players.length;
  const avgBPG = players.reduce((sum, p) => sum + ((p.blocks || 0) / Math.max(1, p.games_played || 1)), 0) / players.length;
  const avg3PMG = players.reduce((sum, p) => sum + ((p.three_pointers_made || 0) / Math.max(1, p.games_played || 1)), 0) / players.length;
  const avgTOV = players.reduce((sum, p) => sum + ((p.turnovers || 0) / Math.max(1, p.games_played || 1)), 0) / players.length;
  const avgFG = players.reduce((sum, p) => sum + (p.field_goal_percentage || 0), 0) / players.length;
  const avgFT = players.reduce((sum, p) => sum + (p.free_throw_percentage || 0), 0) / players.length;

  const standardGames = 60;
  return {
    points: avgPPG * standardGames,
    rebounds: avgRPG * standardGames,
    assists: avgAPG * standardGames,
    steals: avgSPG * standardGames,
    blocks: avgBPG * standardGames,
    three_pointers_made: avg3PMG * standardGames,
    field_goal_percentage: avgFG,
    free_throw_percentage: avgFT,
    turnovers: avgTOV * standardGames,
    games_played: standardGames,
    playerCount: 9,
  };
}

export async function fetchTeamPlayers(teamId: string, season: string): Promise<any[]> {
  const { data: picksData } = await supabase
    .from('draft_picks')
    .select('player_id')
    .eq('current_team_id', teamId)
    .eq('season', season);

  const { data: keepersData } = await supabase
    .from('keepers')
    .select('player_id')
    .eq('team_id', teamId)
    .eq('season', season);

  const draftPlayerIds = picksData?.map(pick => pick.player_id).filter(Boolean) || [];
  const keeperPlayerIds = keepersData?.map(keeper => keeper.player_id) || [];
  const playerIds = [...new Set([...draftPlayerIds, ...keeperPlayerIds])];

  if (playerIds.length === 0) {
    return [];
  }

  const { data: playersData } = await supabase
    .from('players')
    .select('*')
    .in('id', playerIds.filter((id): id is string => id != null));

  return playersData || [];
}