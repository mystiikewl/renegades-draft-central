import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

interface Profile {
  id: string;
  email: string;
  team_id: number | null;
}

interface ConfirmDeleteUserDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  userToDelete: Profile | null;
  fetchAllProfiles: () => void;
}

export const ConfirmDeleteUserDialog = ({ isOpen, onOpenChange, userToDelete, fetchAllProfiles }: ConfirmDeleteUserDialogProps) => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    setLoading(true);
    const { error } = await supabase.functions.invoke('admin-actions', {
      body: {
        action: 'DELETE_USER',
        userId: userToDelete.id,
      },
    });

    if (error) {
      toast({ title: "Error", description: `Failed to delete user: ${error.message}`, variant: "destructive" });
    } else {
      toast({ title: "Success", description: `User ${userToDelete.email} deleted successfully` });
      fetchAllProfiles();
      onOpenChange(false);
    }
    setLoading(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card text-card-foreground">
        <DialogHeader>
          <DialogTitle className="text-foreground">Confirm User Deletion</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Are you sure you want to delete user: <span className="font-bold">{userToDelete?.email}</span>? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" onClick={handleDeleteUser} disabled={loading}>
            {loading ? "Deleting..." : "Delete User"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
