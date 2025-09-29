import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UserCheck, UserX, Shield } from 'lucide-react';

interface AvailabilityFilterProps {
  showAvailable: boolean;
  showDrafted: boolean;
  showKeepers: boolean;
  setShowAvailable: (show: boolean) => void;
  setShowDrafted: (show: boolean) => void;
  setShowKeepers: (show: boolean) => void;
}

export const AvailabilityFilter = ({
  showAvailable,
  showDrafted,
  showKeepers,
  setShowAvailable,
  setShowDrafted,
  setShowKeepers
}: AvailabilityFilterProps) => {
  return (
    <Card className="bg-gradient-card shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <UserCheck className="h-4 w-4" />
          Availability Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="available"
            checked={showAvailable}
            onCheckedChange={(checked) => setShowAvailable(!!checked)}
          />
          <Label htmlFor="available" className="flex items-center gap-2 cursor-pointer">
            <UserCheck className="h-4 w-4 text-green-500" />
            <span className="text-sm">Available Players</span>
          </Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="drafted"
            checked={showDrafted}
            onCheckedChange={(checked) => setShowDrafted(!!checked)}
          />
          <Label htmlFor="drafted" className="flex items-center gap-2 cursor-pointer">
            <UserX className="h-4 w-4 text-red-500" />
            <span className="text-sm">Drafted Players</span>
          </Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="keepers"
            checked={showKeepers}
            onCheckedChange={(checked) => setShowKeepers(!!checked)}
          />
          <Label htmlFor="keepers" className="flex items-center gap-2 cursor-pointer">
            <Shield className="h-4 w-4 text-yellow-500" />
            <span className="text-sm">Keeper Players</span>
          </Label>
        </div>
      </CardContent>
    </Card>
  );
};