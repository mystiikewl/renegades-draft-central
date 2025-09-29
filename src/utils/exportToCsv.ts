import { Tables } from '@/integrations/supabase/types';

type KeeperPlayer = Tables<'keepers'> & { player: Tables<'players'> };

// Helper function to flatten player data for CSV export
function flattenPlayerData(player: Tables<'players'> | KeeperPlayer) {
  const playerData = ('player' in player ? player.player : player) as Tables<'players'>;
  const isKeeper = 'player' in player; // Check if it's a KeeperPlayer

  return {
    name: playerData.name,
    position: playerData.position,
    nba_team: playerData.nba_team,
    is_keeper: isKeeper ? 'Yes' : 'No',
    points: playerData.points,
    rebounds: playerData.total_rebounds,
    assists: playerData.assists,
    steals: playerData.steals,
    blocks: playerData.blocks,
    turnovers: playerData.turnovers,
    three_pointers_made: playerData.three_pointers_made,
    age: playerData.age,
    games_played: playerData.games_played,
    minutes_per_game: playerData.minutes_per_game,
    field_goal_percentage: playerData.field_goal_percentage,
    free_throw_percentage: playerData.free_throw_percentage,
    is_rookie: playerData.is_rookie ? 'Yes' : 'No',
    // Add other relevant fields you want to export
  };
}

export function exportToCsv(filename: string, data: (Tables<'players'> | KeeperPlayer)[]) {
  if (data.length === 0) {
    console.warn('No data to export.');
    return;
  }

  const flattenedData = data.map(flattenPlayerData);

  // Get headers from the first flattened object
  const headers = Object.keys(flattenedData[0]);

  // Create CSV rows
  const csvRows = [];
  csvRows.push(headers.join(',')); // Add header row

  for (const row of flattenedData) {
    const values = headers.map(header => {
      const value = row[header as keyof typeof row];
      // Handle commas and quotes in values
      const escapedValue = String(value).includes(',') || String(value).includes('"') ? `"${String(value).replace(/"/g, '""')}"` : String(value);
      return escapedValue;
    });
    csvRows.push(values.join(','));
  }

  const csvString = csvRows.join('\n');
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });

  // Create a link element and trigger download
  const link = document.createElement('a');
  if (link.download !== undefined) { // Feature detection for download attribute
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } else {
    // Fallback for browsers that don't support download attribute
    window.open('data:text/csv;charset=utf-8,' + encodeURIComponent(csvString));
  }
}
