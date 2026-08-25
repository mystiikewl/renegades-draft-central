import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useTeams } from '@/hooks/useTeams';

interface Team {
  id: string;
  name: string;
  owner_email: string | null;
}

interface TeamOwnerControlsProps {
  userTeam: Team;
  refetchTeams: () => void;
}

export const TeamOwnerControls = ({ userTeam, refetchTeams }: TeamOwnerControlsProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const updateTeamName = async (teamId: string, newName: string, newOwnerEmail: string) => {
    setLoading(true);
    const { error } = await supabase
      .from('teams')
      .update({ name: newName, owner_email: newOwnerEmail })
      .eq('id', teamId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update team name",
        variant: "destructive"
      });
    } else {
      toast({
        title: "Success",
        description: "Team name updated"
      });
      refetchTeams();
    }
    setLoading(false);
  };

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="update-team-name">Update Team Name</Label>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            id="update-team-name"
            placeholder="New team name"
            defaultValue={userTeam.name}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const input = e.target as HTMLInputElement;
                const emailInput = document.getElementById('update-team-email') as HTMLInputElement;
                if (input.value.trim()) {
                  updateTeamName(userTeam.id, input.value.trim(), emailInput.value.trim());
                  input.value = '';
                }
              }
            }}
          />
          <Button 
            onClick={() => {
              const nameInput = document.getElementById('update-team-name') as HTMLInputElement;
              const emailInput = document.getElementById('update-team-email') as HTMLInputElement;
              if (nameInput.value.trim()) {
                updateTeamName(userTeam.id, nameInput.value.trim(), emailInput.value.trim());
                nameInput.value = '';
              }
            }}
            disabled={loading}
          >
            {loading ? "Updating..." : "Update"}
          </Button>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="update-team-email">Update Owner Email</Label>
        <Input
          id="update-team-email"
          type="email"
          placeholder="New owner email"
          defaultValue={userTeam.owner_email || ''}
          disabled={loading}
        />
      </div>
    </>
  );
};
