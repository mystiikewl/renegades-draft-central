import { Tables } from '@/integrations/supabase/types';

// Define weights for each statistical category
const FANTASY_WEIGHTS = {
  points: 1.0,
  total_rebounds: 1.2,
  assists: 1.5,
  steals: 2.0,
  blocks: 2.0,
  turnovers: -1.0, // Negative for turnovers
  three_pointers_made: 0.5,
};

export function calculateFantasyScore(player: Tables<'players'>): number {
  let score = 0;

  score += (player.points || 0) * FANTASY_WEIGHTS.points;
  score += (player.total_rebounds || 0) * FANTASY_WEIGHTS.total_rebounds;
  score += (player.assists || 0) * FANTASY_WEIGHTS.assists;
  score += (player.steals || 0) * FANTASY_WEIGHTS.steals;
  score += (player.blocks || 0) * FANTASY_WEIGHTS.blocks;
  score += (player.turnovers || 0) * FANTASY_WEIGHTS.turnovers;
  score += (player.three_pointers_made || 0) * FANTASY_WEIGHTS.three_pointers_made;

  // Add more complex scoring logic if needed, e.g., for percentages or efficiency
  // For simplicity, we're focusing on raw stats for now.

  return score;
}
