import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

export const PlayerImport = () => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [playerCount, setPlayerCount] = useState<number | null>(null);
  const { toast } = useToast();

  const parseCSV = (csvText: string) => {
    const lines = csvText.split('\n');
    const headers = lines[0].split(',');
    const players = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = line.split(',');
      if (values.length < headers.length) continue;

      const player = {
        rank: parseInt(values[0]) || null,
        overall_rank: parseInt(values[1]) || null,
        conference_rank: parseInt(values[2]) || null,
        regional_rank: parseInt(values[3]) || null,
        name: values[4]?.replace(/"/g, '') || '',
        position: values[5]?.replace(/"/g, '') || '',
        age: parseFloat(values[6]) || null,
        nba_team: values[7]?.replace(/"/g, '') || '',
        games_played: parseInt(values[8]) || null,
        minutes_per_game: parseFloat(values[9]) || null,
        field_goals_made: parseFloat(values[10]) || null,
        field_goal_percentage: parseFloat(values[11]) || null,
        free_throw_percentage: parseFloat(values[12]) || null,
        three_pointers_made: parseFloat(values[13]) || null,
        three_point_percentage: parseFloat(values[14]) || null,
        points: parseFloat(values[15]) || null,
        total_rebounds: parseFloat(values[16]) || null,
        assists: parseFloat(values[17]) || null,
        steals: parseFloat(values[18]) || null,
        blocks: parseFloat(values[19]) || null,
        turnovers: parseFloat(values[20]) || null,
        double_doubles: parseFloat(values[21]) || null,
        total_score: parseFloat(values[22]) || null
      };

      if (player.name) {
        players.push(player);
      }
    }

    return players;
  };

  const handleFileUpload = async () => {
    if (!file) {
      toast({
        title: "Error",
        description: "Please select a CSV file",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    
    try {
      const csvText = await file.text();
      const players = parseCSV(csvText);

      if (players.length === 0) {
        toast({
          title: "Error",
          description: "No valid players found in CSV file",
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      // Clear existing players first
      await supabase.from('players').delete().gte('id', '00000000-0000-0000-0000-000000000000');

      // Insert new players
      const { error } = await supabase
        .from('players')
        .insert(players);

      if (error) {
        throw error;
      }

      toast({
        title: "Success",
        description: `Successfully imported ${players.length} players`
      });

      setPlayerCount(players.length);
      setFile(null);
      
    } catch (error) {
      console.error('Import error:', error);
      toast({
        title: "Error",
        description: "Failed to import players. Please check your CSV format.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchPlayerCount = async () => {
    const { count, error } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.error('Error fetching player count:', error);
    } else {
      setPlayerCount(count);
    }
  };

  useEffect(() => {
    fetchPlayerCount();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Player Database</CardTitle>
        <CardDescription>
          Import players from CSV file. Current players: {playerCount !== null ? playerCount : 'Loading...'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="csv-file">Select CSV File</Label>
          <Input
            id="csv-file"
            type="file"
            accept=".csv"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </div>
        
        <div className="text-sm text-muted-foreground">
          <p className="font-medium">Expected CSV format:</p>
          <p className="break-words">Rank,Overall,Conference,Regional,Player,Position,Age,Team,GP,MPG,FGM,FG%,FT%,3PM,3P%,PTS,TREB,AST,STL,BLK,TO,DD,Total</p>
        </div>

        <Button 
          onClick={handleFileUpload} 
          disabled={!file || loading}
          className="w-full"
        >
          {loading ? "Importing..." : "Import Players"}
        </Button>

        {playerCount !== null && playerCount > 0 && (
          <div className="text-center text-sm text-muted-foreground">
            <p>Database contains {playerCount} players</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
