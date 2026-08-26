import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

interface Team {
  id: string;
  name: string;
  owner_email: string | null;
}

interface AddUserDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  teamsData: Team[];
  fetchAllProfiles: () => void;
}

export const AddUserDialog = ({ isOpen, onOpenChange, teamsData, fetchAllProfiles }: AddUserDialogProps) => {
  const [newUserEmail, setNewUserEmail] = useState('');
  const [selectedTeamIdForNewUser, setSelectedTeamIdForNewUser] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleInviteAndAssignUser = async () => {
    if (!newUserEmail.trim() || !selectedTeamIdForNewUser) {
      toast({ title: "Error", description: "Please enter an email and select a team", variant: "destructive" });
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.functions.invoke('invite-user', {
      body: {
        email: newUserEmail,
        team_id: parseInt(selectedTeamIdForNewUser, 10)
      },
    });

    if (error) {
      toast({ title: "Error", description: `Failed to invite and assign user: ${error.message}`, variant: "destructive" });
    } else if (data && data.error) {
      toast({ title: "Error", description: `Failed to invite and assign user: ${data.error}`, variant: "destructive" });
    } else {
      toast({ title: "Success", description: `User ${newUserEmail} invited and assigned to team successfully` });
      setNewUserEmail('');
      setSelectedTeamIdForNewUser(null);
      fetchAllProfiles();
      onOpenChange(false);
    }
    setLoading(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card text-card-foreground">
        <DialogHeader>
          <DialogTitle className="text-foreground">Add New User</DialogTitle>
          <DialogDescription className="text-muted-foreground">Invite a new user and assign them to a team.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="newUserEmail" className="text-foreground">Email</Label>
            <Input
              id="newUserEmail"
              type="email"
              value={newUserEmail}
              onChange={(e) => setNewUserEmail(e.target.value)}
              placeholder="user@example.com"
              className="bg-input text-foreground border-border"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="selectTeam" className="text-foreground">Assign to Team</Label>
            <Select onValueChange={setSelectedTeamIdForNewUser} value={selectedTeamIdForNewUser || ''}>
              <SelectTrigger className="bg-input text-foreground border-border">
                <SelectValue placeholder="Select a team" />
              </SelectTrigger>
              <SelectContent className="bg-popover text-popover-foreground border-border">
                {teamsData.map((team) => (
                  <SelectItem key={team.id} value={String(team.id)}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleInviteAndAssignUser} disabled={loading}>
            {loading ? "Inviting & Assigning..." : "Invite & Assign User"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
