import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useDraftState } from '@/hooks/useDraftState';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';

export const DraftSettingsGeneral: React.FC = () => {
  const { draftSettings, isLoadingDraftState, mutateDraftSettings } = useDraftState();
  const [leagueSize, setLeagueSize] = useState<number>(draftSettings.teamCount);
  const [rosterSize, setRosterSize] = useState<number>(draftSettings.roundCount);
  const [draftType, setDraftType] = useState<string>(draftSettings.draftType || 'snake');
  const [pickTimeLimit, setPickTimeLimit] = useState<number>(draftSettings.pickTimeLimitSeconds || 120);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!isLoadingDraftState) {
      setLeagueSize(draftSettings.teamCount);
      setRosterSize(draftSettings.roundCount);
      setDraftType(draftSettings.draftType || 'snake');
      setPickTimeLimit(draftSettings.pickTimeLimitSeconds || 120);
    }
  }, [draftSettings, isLoadingDraftState]);

  const handleSaveSettings = async () => {
    if (!confirm('Saving new settings will reset the current draft. Are you sure you want to continue?')) {
      return;
    }

    setIsSavingSettings(true);
    try {
      const { data: existingSettings, error: fetchError } = await supabase
        .from('draft_settings')
        .select('id')
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }

      const newSettings = {
        league_size: leagueSize,
        roster_size: rosterSize,
        draft_type: draftType,
        pick_time_limit_seconds: pickTimeLimit,
        // Don't include created_at or updated_at to avoid trigger issues
      };

      if (existingSettings) {
        // For updates, we need to be careful about the updated_at field
        const { error } = await supabase
          .from('draft_settings')
          .update(newSettings)
          .eq('id', existingSettings.id)
          .select();
          
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('draft_settings')
          .insert(newSettings);
        if (error) throw error;
      }

      await mutateDraftSettings(); // Re-fetch draft settings after saving

      toast({
        title: "Success",
        description: "Draft settings saved and draft has been reset.",
      });
    } catch (error: unknown) {
      console.error('Error saving draft settings:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast({
        title: "Error",
        description: `Failed to save draft settings: ${errorMessage}`,
        variant: "destructive"
      });
    } finally {
      setIsSavingSettings(false);
    }
  };

  if (isLoadingDraftState) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>General Draft Settings</CardTitle>
          <CardDescription>Loading settings...</CardDescription>
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
        <CardTitle>General Draft Settings</CardTitle>
        <CardDescription>Define the overall league, roster, and draft behavior.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Important</AlertTitle>
          <AlertDescription>
            Saving new settings will reset the current draft. All picks will be cleared and players will be marked as undrafted.
          </AlertDescription>
        </Alert>

        <div className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-lg font-medium">League Configuration</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="league-size">League Size (Number of Teams)</Label>
                <Input
                  id="league-size"
                  type="number"
                  value={leagueSize}
                  onChange={(e) => setLeagueSize(parseInt(e.target.value) || 0)}
                  min="1"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="roster-size">Roster Size (Players per Team)</Label>
                <Input
                  id="roster-size"
                  type="number"
                  value={rosterSize}
                  onChange={(e) => setRosterSize(parseInt(e.target.value) || 0)}
                  min="1"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium">Draft Mechanics</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="draft-type">Draft Type</Label>
                <Select onValueChange={setDraftType} value={draftType}>
                  <SelectTrigger id="draft-type">
                    <SelectValue placeholder="Select draft type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="snake">Snake</SelectItem>
                    <SelectItem value="linear">Linear</SelectItem>
                    <SelectItem value="manual">Manual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pick-time-limit">Pick Time Limit (Seconds)</Label>
                <Input
                  id="pick-time-limit"
                  type="number"
                  value={pickTimeLimit}
                  onChange={(e) => setPickTimeLimit(parseInt(e.target.value) || 0)}
                  min="0"
                />
              </div>
            </div>
          </div>
        </div>

        <Button
          onClick={handleSaveSettings}
          disabled={isSavingSettings}
          className="w-full"
        >
          {isSavingSettings ? 'Saving...' : 'Save General Settings'}
        </Button>
      </CardContent>
    </Card>
  );
};
