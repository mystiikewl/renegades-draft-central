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

interface EditTeamDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  refetchTeams: () => void;
  allProfiles: Profile[];
  currentEditingTeam: Team | null;
  handleUpdateTeam: (teamId: string, editedTeamName: string, editedTeamOwnerEmail: string) => Promise<void>;
}

export const EditTeamDialog = ({ isOpen, onOpenChange, refetchTeams, allProfiles, currentEditingTeam, handleUpdateTeam }: EditTeamDialogProps) => {
  const [editedTeamName, setEditedTeamName] = useState('');
  const [editedTeamOwnerEmail, setEditedTeamOwnerEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (currentEditingTeam) {
      setEditedTeamName(currentEditingTeam.name);
      setEditedTeamOwnerEmail(currentEditingTeam.owner_email || '');
    }
  }, [currentEditingTeam]);

  const onUpdateClick = async () => {
    if (!currentEditingTeam) return;
    setLoading(true);
    await handleUpdateTeam(currentEditingTeam.id, editedTeamName, editedTeamOwnerEmail);
    setLoading(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card text-card-foreground">
        <DialogHeader>
          <DialogTitle className="text-foreground">Edit Team</DialogTitle>
          <DialogDescription className="text-muted-foreground">Modify the team's name and owner.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="editedTeamName" className="text-foreground">Team Name</Label>
            <Input
              id="editedTeamName"
              value={editedTeamName}
              onChange={(e) => setEditedTeamName(e.target.value)}
              className="bg-input text-foreground border-border"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="editedTeamOwnerEmail" className="text-foreground">Owner Email</Label>
            <Select onValueChange={(value) => setEditedTeamOwnerEmail(value === "__unassign__" ? "" : value)} value={editedTeamOwnerEmail || "__unassign__"}>
              <SelectTrigger className="bg-input text-foreground border-border">
                <SelectValue placeholder="Select a new owner" />
              </SelectTrigger>
              <SelectContent className="bg-popover text-popover-foreground border-border">
                <SelectItem value="__unassign__">Unassign Owner</SelectItem>
                {allProfiles.map((profile) => (
                  <SelectItem key={profile.id} value={profile.email || `__profile_${profile.id}__`}>
                    {profile.email || 'No Email'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onUpdateClick} disabled={loading}>
            {loading ? "Updating..." : "Update Team"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
