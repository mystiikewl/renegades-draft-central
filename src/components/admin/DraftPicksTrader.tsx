import React, { useState, useCallback, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useTeams } from '@/hooks/useTeams';
import { useDraftState } from '@/hooks/useDraftState';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Repeat, Users, RefreshCw } from 'lucide-react';

export const DraftPicksTrader: React.FC = () => {
  const { draftPicks, isLoadingDraftState, mutateDraftSettings } = useDraftState();
  const { data: teamsData = [], isLoading: isLoadingTeams } = useTeams();
  const [selectedRound, setSelectedRound] = useState<string>('');
  const [selectedPickNumber, setSelectedPickNumber] = useState<string>('');
  const [originalTeamId, setOriginalTeamId] = useState<string>('');
  const [newTeamId, setNewTeamId] = useState<string>('');
  const [isTrading, setIsTrading] = useState(false);
  const [roundToAssign, setRoundToAssign] = useState<string>('');
  const [teamToAssign, setTeamToAssign] = useState<string>('');
  const [isAssigning, setIsAssigning] = useState(false);
  // Separate state for reassign functionality
  const [reassignRound, setReassignRound] = useState<string>('');
  const [reassignPickNumber, setReassignPickNumber] = useState<string>('');
  const [reassignTeamId, setReassignTeamId] = useState<string>('');
  const [isReassigning, setIsReassigning] = useState(false);
  const { toast } = useToast();

  const availableRounds = Array.from(new Set(draftPicks.map(pick => pick.round))).sort((a, b) => a - b);
  const availablePickNumbers = selectedRound
    ? Array.from(new Set(draftPicks.filter(pick => pick.round === parseInt(selectedRound)).map(pick => pick.pick_number)))
        .sort((a, b) => a - b)
    : [];
  const reassignAvailablePickNumbers = reassignRound
    ? Array.from(new Set(draftPicks.filter(pick => pick.round === parseInt(reassignRound)).map(pick => pick.pick_number)))
        .sort((a, b) => a - b)
    : [];

  useEffect(() => {
    if (selectedRound && selectedPickNumber) {
      const pick = draftPicks.find(p => p.round === parseInt(selectedRound) && p.pick_number === parseInt(selectedPickNumber));
      if (pick) {
        setOriginalTeamId(pick.current_team_id);
        setNewTeamId(pick.current_team_id); // Default new team to original team
      }
    } else {
      setOriginalTeamId('');
      setNewTeamId('');
    }
  }, [selectedRound, selectedPickNumber, draftPicks]);

  const handleTradePick = useCallback(async () => {
    if (!selectedRound || !selectedPickNumber || !originalTeamId || !newTeamId) {
      toast({
        title: "Error",
        description: "Please select a round, pick number, and both teams.",
        variant: "destructive"
      });
      return;
    }

    if (originalTeamId === newTeamId) {
      toast({
        title: "Info",
        description: "The new team is the same as the original team. No trade needed.",
        variant: "default"
      });
      return;
    }

    setIsTrading(true);
    try {
      const { error } = await supabase
        .from('draft_picks')
        .update({ current_team_id: newTeamId })
        .eq('round', parseInt(selectedRound))
        .eq('pick_number', parseInt(selectedPickNumber))
        .eq('current_team_id', originalTeamId); // Ensure we only update the pick if it still belongs to the original team

      if (error) throw error;

      await mutateDraftSettings(); // Re-fetch draft state to reflect changes

      toast({
        title: "Success",
        description: `Pick R${selectedRound}P${selectedPickNumber} successfully traded to ${teamsData.find(t => t.id === newTeamId)?.name}.`,
      });
      
      // Reset form after successful trade
      setSelectedRound('');
      setSelectedPickNumber('');
      setOriginalTeamId('');
      setNewTeamId('');
    } catch (error: unknown) {
      console.error('Error trading pick:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast({
        title: "Error",
        description: `Failed to trade pick: ${errorMessage}`,
        variant: "destructive"
      });
    } finally {
      setIsTrading(false);
    }
  }, [selectedRound, selectedPickNumber, originalTeamId, newTeamId, teamsData, mutateDraftSettings, toast]);

  const handleAssignRound = useCallback(async () => {
    if (!roundToAssign || !teamToAssign) {
      toast({
        title: "Error",
        description: "Please select a round and a team to assign.",
        variant: "destructive"
      });
      return;
    }

    if (!confirm(`Are you sure you want to assign all picks in Round ${roundToAssign} to ${teamsData.find(t => t.id === teamToAssign)?.name}? This will overwrite existing pick owners for this round.`)) {
      return;
    }

    setIsAssigning(true);
    try {
      const { error } = await supabase
        .from('draft_picks')
        .update({ current_team_id: teamToAssign })
        .eq('round', parseInt(roundToAssign));

      if (error) throw error;

      await mutateDraftSettings(); // Re-fetch draft state to reflect changes

      toast({
        title: "Success",
        description: `All picks in Round ${roundToAssign} successfully assigned to ${teamsData.find(t => t.id === teamToAssign)?.name}.`,
      });
      
      // Reset form after successful assignment
      setRoundToAssign('');
      setTeamToAssign('');
    } catch (error: unknown) {
      console.error('Error assigning round:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast({
        title: "Error",
        description: `Failed to assign round: ${errorMessage}`,
        variant: "destructive"
      });
    } finally {
      setIsAssigning(false);
    }
  }, [roundToAssign, teamToAssign, teamsData, mutateDraftSettings, toast]);

  const handleReassignPick = useCallback(async () => {
    if (!reassignRound || !reassignPickNumber || !reassignTeamId) {
      toast({
        title: "Error",
        description: "Please select a round, pick number, and team.",
        variant: "destructive"
      });
      return;
    }

    setIsReassigning(true);
    try {
      const { error } = await supabase
        .from('draft_picks')
        .update({ current_team_id: reassignTeamId })
        .eq('round', parseInt(reassignRound))
        .eq('pick_number', parseInt(reassignPickNumber));

      if (error) throw error;

      await mutateDraftSettings(); // Re-fetch draft state to reflect changes

      toast({
        title: "Success",
        description: `Pick R${reassignRound}P${reassignPickNumber} successfully reassigned to ${teamsData.find(t => t.id === reassignTeamId)?.name}.`,
      });
      
      // Reset form after successful reassignment
      setReassignRound('');
      setReassignPickNumber('');
      setReassignTeamId('');
    } catch (error: unknown) {
      console.error('Error reassigning pick:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast({
        title: "Error",
        description: `Failed to reassign pick: ${errorMessage}`,
        variant: "destructive"
      });
    } finally {
      setIsReassigning(false);
    }
  }, [reassignRound, reassignPickNumber, reassignTeamId, teamsData, mutateDraftSettings, toast]);

  if (isLoadingDraftState || isLoadingTeams) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Draft Picks Trading</CardTitle>
          <CardDescription>Loading picks and teams...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Draft Picks Trading</CardTitle>
        <CardDescription>Adjust draft pick ownership due to trades.</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="trade" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="trade" className="flex items-center gap-2">
              <Repeat className="h-4 w-4" />
              Trade Pick
            </TabsTrigger>
            <TabsTrigger value="assign-round" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Assign Round
            </TabsTrigger>
            <TabsTrigger value="reassign" className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Reassign Pick
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="trade" className="mt-6 space-y-6">
            <Alert>
              <AlertTitle>Trade Individual Picks</AlertTitle>
              <AlertDescription>
                Trade a specific draft pick between teams. Select the round and pick number, then choose the new team.
              </AlertDescription>
            </Alert>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="select-round">Round</Label>
                <Select onValueChange={setSelectedRound} value={selectedRound}>
                  <SelectTrigger id="select-round">
                    <SelectValue placeholder="Select Round" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableRounds.map(round => (
                      <SelectItem key={round} value={String(round)}>
                        Round {round}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="select-pick-number">Pick Number</Label>
                <Select onValueChange={setSelectedPickNumber} value={selectedPickNumber} disabled={!selectedRound}>
                  <SelectTrigger id="select-pick-number">
                    <SelectValue placeholder="Select Pick" />
                  </SelectTrigger>
                  <SelectContent>
                    {availablePickNumbers.map(pickNum => (
                      <SelectItem key={pickNum} value={String(pickNum)}>
                        Pick {pickNum}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {selectedRound && selectedPickNumber && (
              <div className="space-y-4 p-4 bg-muted rounded-lg">
                <div className="space-y-2">
                  <Label htmlFor="original-team">Original Team</Label>
                  <Input id="original-team" value={teamsData.find(t => t.id === originalTeamId)?.name || 'N/A'} readOnly />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-team">New Team</Label>
                  <Select onValueChange={setNewTeamId} value={newTeamId}>
                    <SelectTrigger id="new-team">
                      <SelectValue placeholder="Select New Team" />
                    </SelectTrigger>
                    <SelectContent>
                      {teamsData.map(team => (
                        <SelectItem key={team.id} value={team.id}>
                          {team.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={handleTradePick}
                  disabled={isTrading || !selectedRound || !selectedPickNumber || !newTeamId}
                  className="w-full"
                >
                  {isTrading ? 'Trading...' : 'Trade Pick'}
                </Button>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="assign-round" className="mt-6 space-y-6">
            <Alert>
              <AlertTitle>Assign All Picks in a Round</AlertTitle>
              <AlertDescription>
                Assign all draft picks in a specific round to a single team. This will overwrite existing pick owners for this round.
              </AlertDescription>
            </Alert>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="assign-round">Round</Label>
                <Select onValueChange={setRoundToAssign} value={roundToAssign}>
                  <SelectTrigger id="assign-round">
                    <SelectValue placeholder="Select Round" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableRounds.map(round => (
                      <SelectItem key={round} value={String(round)}>
                        Round {round}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="assign-team">Team</Label>
                <Select onValueChange={setTeamToAssign} value={teamToAssign}>
                  <SelectTrigger id="assign-team">
                    <SelectValue placeholder="Select Team" />
                  </SelectTrigger>
                  <SelectContent>
                    {teamsData.map(team => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              onClick={handleAssignRound}
              disabled={isAssigning || !roundToAssign || !teamToAssign}
              className="w-full"
            >
              {isAssigning ? 'Assigning...' : 'Assign Round to Team'}
            </Button>
          </TabsContent>
          
          <TabsContent value="reassign" className="mt-6 space-y-6">
            <Alert>
              <AlertTitle>Reassign Specific Pick</AlertTitle>
              <AlertDescription>
                Reassign a specific draft pick to a chosen team. This is similar to trading but for administrative reassignment.
              </AlertDescription>
            </Alert>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="reassign-round">Round</Label>
                <Select onValueChange={setReassignRound} value={reassignRound}>
                  <SelectTrigger id="reassign-round">
                    <SelectValue placeholder="Select Round" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableRounds.map(round => (
                      <SelectItem key={round} value={String(round)}>
                        Round {round}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reassign-pick-number">Pick Number</Label>
                <Select onValueChange={setReassignPickNumber} value={reassignPickNumber} disabled={!reassignRound}>
                  <SelectTrigger id="reassign-pick-number">
                    <SelectValue placeholder="Select Pick" />
                  </SelectTrigger>
                  <SelectContent>
                    {reassignAvailablePickNumbers.map(pickNum => (
                      <SelectItem key={pickNum} value={String(pickNum)}>
                        Pick {pickNum}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reassign-team">Team to Assign</Label>
              <Select onValueChange={setReassignTeamId} value={reassignTeamId}>
                <SelectTrigger id="reassign-team">
                  <SelectValue placeholder="Select Team" />
                </SelectTrigger>
                <SelectContent>
                  {teamsData.map(team => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleReassignPick}
              disabled={isReassigning || !reassignRound || !reassignPickNumber || !reassignTeamId}
              className="w-full"
            >
              {isReassigning ? 'Reassigning...' : 'Reassign Pick'}
            </Button>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
