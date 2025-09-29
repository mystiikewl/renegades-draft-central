import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

interface Profile {
  id: string;
  email: string;
  team_id: number | null;
}

interface AddTeamDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  refetchTeams: () => void;
  allProfiles: Profile[];
}

export const AddTeamDialog = ({ isOpen, onOpenChange, refetchTeams, allProfiles }: AddTeamDialogProps) => {
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamOwnerEmail, setNewTeamOwnerEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) {
      toast({ title: "Error", description: "Please enter a team name", variant: "destructive" });
      return;
    }

    setLoading(true);
    const { error } = await supabase
      .from('teams')
      .insert([{ name: newTeamName, owner_email: newTeamOwnerEmail || null }]);

    if (error) {
      toast({ title: "Error", description: "Failed to create team", variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Team created successfully" });
      setNewTeamName('');
      setNewTeamOwnerEmail('');
      refetchTeams();
      onOpenChange(false);
    }
    setLoading(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card text-card-foreground">
        <DialogHeader>
          <DialogTitle className="text-foreground">Add New Team</DialogTitle>
          <DialogDescription className="text-muted-foreground">Enter the details for the new fantasy team.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="newTeamName" className="text-foreground">Team Name</Label>
            <Input
              id="newTeamName"
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              placeholder="e.g., My Awesome Team"
              className="bg-input text-foreground border-border"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="newTeamOwnerEmail" className="text-foreground">Owner Email (Optional)</Label>
            <Select onValueChange={setNewTeamOwnerEmail} value={newTeamOwnerEmail}>
              <SelectTrigger className="bg-input text-foreground border-border">
                <SelectValue placeholder="Select an owner or leave blank" />
              </SelectTrigger>
              <SelectContent className="bg-popover text-popover-foreground border-border">
                {allProfiles.map((profile) => (
                  <SelectItem key={profile.id} value={profile.email}>
                    {profile.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleCreateTeam} disabled={loading}>
            {loading ? "Adding..." : "Add Team"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
