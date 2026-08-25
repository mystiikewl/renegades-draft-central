import { useState, useEffect } from 'react';
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

interface Profile {
  id: string;
  email: string;
  team_id: number | null;
}

interface EditUserDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  teamsData: Team[];
  fetchAllProfiles: () => void;
  currentEditingUser: Profile | null;
}

export const EditUserDialog = ({ isOpen, onOpenChange, teamsData, fetchAllProfiles, currentEditingUser }: EditUserDialogProps) => {
  const [editedUserEmail, setEditedUserEmail] = useState('');
  const [editedUserTeamId, setEditedUserTeamId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (currentEditingUser) {
      setEditedUserEmail(currentEditingUser.email);
      setEditedUserTeamId(currentEditingUser.team_id ? String(currentEditingUser.team_id) : null);
    }
  }, [currentEditingUser]);

  const handleUpdateUser = async () => {
    if (!currentEditingUser) return;

    setLoading(true);

    const { error } = await supabase.functions.invoke('admin-actions', {
      body: {
        action: 'ASSIGN_USER_TO_TEAM',
        userId: currentEditingUser.id,
        teamId: editedUserTeamId,
      },
    });

    if (error) {
      toast({ title: "Error", description: `Failed to update user: ${error.message}`, variant: "destructive" });
    } else {
      toast({ title: "Success", description: `User ${editedUserEmail} updated successfully` });
      fetchAllProfiles();
      onOpenChange(false);
    }
    setLoading(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card text-card-foreground">
        <DialogHeader>
          <DialogTitle className="text-foreground">Edit User</DialogTitle>
          <DialogDescription className="text-muted-foreground">Edit the user's email and team assignment.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="editedUserEmail" className="text-foreground">Email</Label>
            <Input
              id="editedUserEmail"
              type="email"
              value={editedUserEmail}
              onChange={(e) => setEditedUserEmail(e.target.value)}
              placeholder="user@example.com"
              className="bg-input text-foreground border-border"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="editedUserTeamId" className="text-foreground">Assigned Team</Label>
            <Select onValueChange={setEditedUserTeamId} value={editedUserTeamId || ''}>
              <SelectTrigger className="bg-input text-foreground border-border">
                <SelectValue placeholder="Select a team or unassign" />
              </SelectTrigger>
              <SelectContent className="bg-popover text-popover-foreground border-border">
                <SelectItem value="null">Unassigned</SelectItem>
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
          <Button onClick={handleUpdateUser} disabled={loading}>
            {loading ? "Updating..." : "Update User"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
