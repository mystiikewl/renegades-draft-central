import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { Checkbox } from '@/components/ui/checkbox';

type Player = Tables<'players'>;

interface PlayerEditingProps {
  onBackToImport: () => void;
}

export const PlayerEditing: React.FC<PlayerEditingProps> = ({ onBackToImport }) => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  const fetchPlayers = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching players:', error);
      toast({ title: "Error", description: "Failed to load players.", variant: "destructive" });
    } else {
      setPlayers(data);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchPlayers();
  }, [fetchPlayers]);

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  const filteredPlayers = players.filter(player =>
    player.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    player.nba_team.toLowerCase().includes(searchTerm.toLowerCase()) ||
    player.position.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEditClick = (player: Player) => {
    setEditingPlayer({ ...player });
    setIsDialogOpen(true);
  };

  const handleDeleteClick = async (playerId: string) => {
    if (!window.confirm('Are you sure you want to delete this player?')) {
      return;
    }
    setLoading(true);
    const { error } = await supabase
      .from('players')
      .delete()
      .eq('id', playerId);

    if (error) {
      console.error('Error deleting player:', error);
      toast({ title: "Error", description: "Failed to delete player.", variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Player deleted successfully." });
      fetchPlayers(); // Re-fetch players after deletion
    }
    setLoading(false);
  };

  const handleSavePlayer = async () => {
    if (!editingPlayer) return;

    setLoading(true);
    const { data, error } = await supabase
      .from('players')
      .update(editingPlayer)
      .eq('id', editingPlayer.id)
      .select();

    if (error) {
      console.error('Error saving player:', error);
      toast({ title: "Error", description: "Failed to save player.", variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Player saved successfully." });
      setIsDialogOpen(false);
      setEditingPlayer(null);
      fetchPlayers(); // Re-fetch players after update
    }
    setLoading(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setEditingPlayer(prev => {
      if (!prev) return null;
      return {
        ...prev,
        [name]: type === 'checkbox' ? checked : (type === 'number' ? parseFloat(value) : value)
      };
    });
  };

  const playerFields = [
    { key: 'name', label: 'Name', type: 'text' },
    { key: 'position', label: 'Position', type: 'text' },
    { key: 'nba_team', label: 'NBA Team', type: 'text' },
    { key: 'age', label: 'Age', type: 'number' },
    { key: 'rank', label: 'Rank', type: 'number' },
    { key: 'games_played', label: 'GP', type: 'number' },
    { key: 'minutes_per_game', label: 'MPG', type: 'number' },
    { key: 'field_goals_made', label: 'FGM', type: 'number' },
    { key: 'field_goal_percentage', label: 'FG%', type: 'number' },
    { key: 'free_throw_percentage', label: 'FT%', type: 'number' },
    { key: 'three_pointers_made', label: '3PM', type: 'number' },
    { key: 'three_point_percentage', label: '3P%', type: 'number' },
    { key: 'points', label: 'PTS', type: 'number' },
    { key: 'total_rebounds', label: 'TREB', type: 'number' },
    { key: 'assists', label: 'AST', type: 'number' },
    { key: 'steals', label: 'STL', type: 'number' },
    { key: 'blocks', label: 'BLK', type: 'number' },
    { key: 'turnovers', label: 'TO', type: 'number' },
    { key: 'is_rookie', label: 'Rookie', type: 'checkbox' },
    { key: 'is_drafted', label: 'Drafted', type: 'checkbox' },
    { key: 'is_keeper', label: 'Keeper', type: 'checkbox' },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit Player Data</CardTitle>
        <CardDescription>Search, view, and edit individual player records in the database.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-between items-center">
          <Input
            placeholder="Search players..."
            value={searchTerm}
            onChange={handleSearchChange}
            className="max-w-sm"
          />
          <Button onClick={onBackToImport}>Back to Import</Button>
        </div>

        {loading ? (
          <p>Loading players...</p>
        ) : (
          <div className="max-h-[600px] overflow-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  {playerFields.map(field => (
                    <TableHead key={field.key}>{field.label}</TableHead>
                  ))}
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPlayers.map(player => (
                  <TableRow key={player.id}>
                    {playerFields.map(field => (
                      <TableCell key={field.key}>
                        {field.type === 'checkbox' ? (player[field.key as keyof Player] ? 'Yes' : 'No') : String(player[field.key as keyof Player] || '')}
                      </TableCell>
                    ))}
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button variant="outline" size="sm" onClick={() => handleEditClick(player)}>Edit</Button>
                        <Button variant="destructive" size="sm" onClick={() => handleDeleteClick(player.id)}>Delete</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Edit Player: {editingPlayer?.name}</DialogTitle>
              <DialogDescription>Make changes to the player's data.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {editingPlayer && playerFields.map(field => (
                <div key={field.key} className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor={field.key} className="text-right">
                    {field.label}
                  </Label>
                  {field.type === 'checkbox' ? (
                    <Checkbox
                      id={field.key}
                      name={field.key}
                      checked={!!editingPlayer[field.key as keyof Player]}
                      onCheckedChange={(checked) => handleInputChange({ target: { name: field.key, value: String(checked), type: 'checkbox', checked: !!checked } } as React.ChangeEvent<HTMLInputElement>)}
                      className="col-span-3"
                    />
                  ) : (
                    <Input
                      id={field.key}
                      name={field.key}
                      type={field.type}
                      value={String(editingPlayer[field.key as keyof Player] || '')}
                      onChange={handleInputChange}
                      className="col-span-3"
                    />
                  )}
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSavePlayer} disabled={loading}>
                {loading ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};
