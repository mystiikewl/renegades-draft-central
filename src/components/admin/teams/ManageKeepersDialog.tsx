import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { KeeperManagement } from '@/components/KeeperManagement';
import { useIsMobile } from '@/hooks/use-mobile';

interface Team {
  id: string;
  name: string;
  owner_email: string | null;
}

interface ManageKeepersDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  currentViewingTeam: Team | null;
}

export const ManageKeepersDialog = ({ isOpen, onOpenChange, currentViewingTeam }: ManageKeepersDialogProps) => {
  const isMobile = useIsMobile();
  
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent 
        className={`flex flex-col max-h-[90vh] ${isMobile ? 'w-[95vw] max-w-[95vw]' : 'max-w-4xl'}`}
      >
        <DialogHeader className={isMobile ? "flex-shrink-0" : ""}>
          <DialogTitle className="text-foreground">Manage Keepers for {currentViewingTeam?.name}</DialogTitle>
          <DialogDescription className="text-muted-foreground">Manage keeper players for this team.</DialogDescription>
        </DialogHeader>
        <div className="flex-grow overflow-y-auto">
          {currentViewingTeam && (
            <KeeperManagement
              teamId={currentViewingTeam.id}
              season="2025-26"
            />
          )}
        </div>
        <DialogFooter className={isMobile ? "flex-shrink-0 mt-4" : ""}>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
