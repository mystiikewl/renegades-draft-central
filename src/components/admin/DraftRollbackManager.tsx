import React, { useState, useCallback, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useDraftState } from '@/hooks/useDraftState';
import { useTeams } from '@/hooks/useTeams';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  RotateCcw,
  Eye,
  AlertTriangle,
  CheckCircle,
  Clock,
  Users,
  Calendar,
  Hash,
  Trash2,
  RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface RollbackPreview {
  affectedPicks: Array<{
    id: string;
    round: number;
    pick_number: number;
    player_id: string | null;
    current_team_id: string;
    is_used: boolean;
    player_name?: string;
    team_name?: string;
  }>;
  affectedCount: number;
  rollbackId: string;
}

interface RollbackCriteria {
  type: 'pick_number' | 'round' | 'datetime';
  pick_number?: number;
  round?: number;
  datetime?: string;
}

interface RollbackHistoryEntry {
  id: string;
  rollback_id: string;
  action_type: 'preview' | 'rollback';
  admin_user_id: string;
  rollback_point: RollbackCriteria | null;
  affected_picks: RollbackPreview['affectedPicks'] | null;
  status: 'executed' | 'failed' | 'pending';
  executed_at: string;
  created_at?: string;
}

interface DraftPick {
  id: string;
  round: number;
  pick_number: number;
  overall_pick: number;
  player_id: string | null;
  current_team_id: string;
  is_used: boolean;
  created_at: string;
}

interface AuditLogEntry {
  rollback_id: string;
  action_type: 'rollback';
  admin_user_id: string;
  rollback_point: RollbackCriteria;
  affected_picks: RollbackPreview['affectedPicks'];
  status: 'executed';
}

export const DraftRollbackManager: React.FC = () => {
  const { draftPicks, isLoadingDraftState, mutateDraftSettings } = useDraftState();
  const { data: teamsData = [], isLoading: isLoadingTeams } = useTeams();
  const [rollbackCriteria, setRollbackCriteria] = useState<RollbackCriteria>({
    type: 'pick_number'
  });
  const [rollbackValue, setRollbackValue] = useState<string>('');
  const [preview, setPreview] = useState<RollbackPreview | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isRollingBack, setIsRollingBack] = useState(false);
  const [rollbackHistory, setRollbackHistory] = useState<RollbackHistoryEntry[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const { toast } = useToast();

  // Get available rounds and pick numbers for dropdowns
  const availableRounds = Array.from(new Set(draftPicks.map(pick => pick.round))).sort((a, b) => a - b);
  const maxPickNumber = Math.max(...draftPicks.map(pick => pick.pick_number), 0);

  // Load rollback history
  useEffect(() => {
    loadRollbackHistory();
  }, []);

  const loadRollbackHistory = async () => {
    setIsLoadingHistory(true);
    try {
      // Use direct query since the table doesn't exist in types yet
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
         
        .from('draft_rollback_audit')
         
        .select('*')
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        .order('executed_at', { ascending: false })
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        .limit(10);

      if (error) throw error;
      setRollbackHistory((data as unknown as RollbackHistoryEntry[]) || []);
    } catch (error: unknown) {
      console.error('Error loading rollback history:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handlePreviewRollback = useCallback(async () => {
    if (!rollbackValue) {
      toast({
        title: "Error",
        description: "Please enter a rollback value.",
        variant: "destructive"
      });
      return;
    }

    setIsPreviewing(true);
    try {
      // Calculate affected picks client-side for now
      let affectedPicks: DraftPick[] = [];

      if (rollbackCriteria.type === 'pick_number') {
        const pickNum = parseInt(rollbackValue);
        affectedPicks = draftPicks.filter(pick => pick.overall_pick >= pickNum && pick.is_used);
      } else if (rollbackCriteria.type === 'round') {
        const roundNum = parseInt(rollbackValue);
        affectedPicks = draftPicks.filter(pick => pick.round >= roundNum && pick.is_used);
      } else if (rollbackCriteria.type === 'datetime') {
        const dateTime = new Date(rollbackValue);
        affectedPicks = draftPicks.filter(pick => {
          const pickDate = new Date(pick.created_at);
          return pickDate >= dateTime && pick.is_used;
        });
      }

      // Get player and team names for display
      const picksWithNames = await Promise.all(
        affectedPicks.map(async (pick) => {
          const player = pick.player_id ? await supabase
            .from('players')
            .select('name')
            .eq('id', pick.player_id)
            .single() : null;

          const team = await supabase
            .from('teams')
            .select('name')
            .eq('id', pick.current_team_id)
            .single();

          return {
            ...pick,
            player_name: player?.data?.name || null,
            team_name: team?.data?.name || 'Unknown Team'
          };
        })
      );

      const previewData: RollbackPreview = {
        affectedPicks: picksWithNames,
        affectedCount: affectedPicks.length,
        rollbackId: `preview-${Date.now()}`
      };

      setPreview(previewData);

      toast({
        title: "Preview Generated",
        description: `Found ${affectedPicks.length} picks that would be affected.`,
      });
    } catch (error: unknown) {
      console.error('Error previewing rollback:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast({
        title: "Error",
        description: `Failed to preview rollback: ${errorMessage}`,
        variant: "destructive"
      });
    } finally {
      setIsPreviewing(false);
    }
  }, [rollbackCriteria, rollbackValue, draftPicks, toast]);

  const handleExecuteRollback = useCallback(async () => {
    if (!preview) {
      toast({
        title: "Error",
        description: "Please preview the rollback first.",
        variant: "destructive"
      });
      return;
    }

    if (!confirm(`Are you sure you want to rollback ${preview.affectedCount} picks? This action cannot be undone.`)) {
      return;
    }

    setIsRollingBack(true);
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Perform client-side rollback for now (until RPC functions are available)
      const rollbackPromises = preview.affectedPicks.map(async (pick) => {
        // Get the original team ID from the draft_picks table
        const { data: pickData, error: fetchError } = await supabase
          .from('draft_picks')
          .select('original_team_id')
          .eq('id', pick.id)
          .single();

        if (fetchError) throw fetchError;

        // Update draft_picks table
        const { error: pickError } = await supabase
          .from('draft_picks')
          .update({
            is_used: false,
            player_id: null,
            current_team_id: pickData.original_team_id
          })
          .eq('id', pick.id);

        if (pickError) throw pickError;

        // Update players table if player was assigned
        if (pick.player_id) {
          const { error: playerError } = await supabase
            .from('players')
            .update({
              is_drafted: false,
              drafted_by_team_id: null
            })
            .eq('id', pick.player_id);

          if (playerError) throw playerError;
        }
      });

      await Promise.all(rollbackPromises);

      // Insert audit log entry
      const criteria: RollbackCriteria = {
        type: rollbackCriteria.type,
        [rollbackCriteria.type === 'pick_number' ? 'pick_number' :
         rollbackCriteria.type === 'round' ? 'round' : 'datetime']: rollbackValue
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await supabase
        .from('draft_rollback_audit' as any) // eslint-disable-line @typescript-eslint/no-explicit-any
        .insert({
          rollback_id: preview.rollbackId,
          action_type: 'rollback',
          admin_user_id: user.id,
          rollback_point: criteria,
          affected_picks: preview.affectedPicks,
          status: 'executed'
        } as AuditLogEntry);

      await mutateDraftSettings(); // Refresh draft state
      await loadRollbackHistory(); // Refresh history

      toast({
        title: "Success",
        description: `Successfully rolled back ${preview.affectedCount} picks.`,
      });

      // Reset form
      setPreview(null);
      setRollbackValue('');
    } catch (error: unknown) {
      console.error('Error executing rollback:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast({
        title: "Error",
        description: `Failed to execute rollback: ${errorMessage}`,
        variant: "destructive"
      });
    } finally {
      setIsRollingBack(false);
    }
  }, [preview, rollbackCriteria, rollbackValue, mutateDraftSettings, toast]);

  const getRollbackDescription = () => {
    switch (rollbackCriteria.type) {
      case 'pick_number':
        return `All picks from pick #${rollbackValue} onwards`;
      case 'round':
        return `All picks from Round ${rollbackValue} onwards`;
      case 'datetime':
        return `All picks made after ${new Date(rollbackValue).toLocaleString()}`;
      default:
        return '';
    }
  };

  if (isLoadingDraftState || isLoadingTeams) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Draft Rollback Manager</CardTitle>
          <CardDescription>Loading draft data...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5" />
            Draft Rollback Manager
          </CardTitle>
          <CardDescription>
            Rollback draft picks to correct mistakes or restart from a specific point.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Warning</AlertTitle>
            <AlertDescription>
              Rollback operations cannot be undone. Always preview the changes before executing.
            </AlertDescription>
          </Alert>

          <Tabs defaultValue="rollback" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="rollback">Rollback Draft</TabsTrigger>
              <TabsTrigger value="history">Rollback History</TabsTrigger>
            </TabsList>

            <TabsContent value="rollback" className="space-y-6">
              {/* Rollback Criteria Selection */}
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="rollback-type">Rollback Type</Label>
                    <Select
                      value={rollbackCriteria.type}
                      onValueChange={(value: 'pick_number' | 'round' | 'datetime') =>
                        setRollbackCriteria({ ...rollbackCriteria, type: value })
                      }
                    >
                      <SelectTrigger id="rollback-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pick_number">
                          <div className="flex items-center gap-2">
                            <Hash className="h-4 w-4" />
                            By Pick Number
                          </div>
                        </SelectItem>
                        <SelectItem value="round">
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            By Round
                          </div>
                        </SelectItem>
                        <SelectItem value="datetime">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            By Date/Time
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="rollback-value">
                      {rollbackCriteria.type === 'pick_number' && 'Pick Number'}
                      {rollbackCriteria.type === 'round' && 'Round Number'}
                      {rollbackCriteria.type === 'datetime' && 'Date/Time'}
                    </Label>
                    {rollbackCriteria.type === 'datetime' ? (
                      <Input
                        id="rollback-value"
                        type="datetime-local"
                        value={rollbackValue}
                        onChange={(e) => setRollbackValue(e.target.value)}
                      />
                    ) : (
                      <Input
                        id="rollback-value"
                        type="number"
                        min="1"
                        max={rollbackCriteria.type === 'pick_number' ? maxPickNumber : availableRounds.length}
                        value={rollbackValue}
                        onChange={(e) => setRollbackValue(e.target.value)}
                        placeholder={
                          rollbackCriteria.type === 'pick_number' ? 'Enter pick number' :
                          'Enter round number'
                        }
                      />
                    )}
                  </div>
                </div>

                <Button
                  onClick={handlePreviewRollback}
                  disabled={isPreviewing || !rollbackValue}
                  className="w-full"
                >
                  <Eye className="mr-2 h-4 w-4" />
                  {isPreviewing ? 'Previewing...' : 'Preview Rollback'}
                </Button>
              </div>

              {/* Preview Results */}
              {preview && (
                <div className="space-y-4">
                  <Separator />
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">Rollback Preview</h3>
                      <Badge variant="secondary">
                        {preview.affectedCount} picks affected
                      </Badge>
                    </div>

                    <Alert>
                      <CheckCircle className="h-4 w-4" />
                      <AlertTitle>Preview Complete</AlertTitle>
                      <AlertDescription>
                        {getRollbackDescription()} - {preview.affectedCount} picks will be rolled back.
                      </AlertDescription>
                    </Alert>

                    {/* Affected Picks List */}
                    <div className="max-h-64 overflow-y-auto border rounded-md">
                      <div className="p-4 space-y-2">
                        {preview.affectedPicks.map((pick, index) => (
                          <div
                            key={pick.id}
                            className="flex items-center justify-between p-2 bg-muted rounded text-sm"
                          >
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">
                                R{pick.round}P{pick.pick_number}
                              </Badge>
                              {pick.player_name && (
                                <span className="font-medium">{pick.player_name}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <span>{pick.team_name}</span>
                              <Trash2 className="h-3 w-3" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <Button
                      onClick={handleExecuteRollback}
                      disabled={isRollingBack}
                      variant="destructive"
                      className="w-full"
                    >
                      <RotateCcw className="mr-2 h-4 w-4" />
                      {isRollingBack ? 'Rolling Back...' : 'Execute Rollback'}
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="history" className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Rollback History</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadRollbackHistory}
                  disabled={isLoadingHistory}
                >
                  <RefreshCw className={cn("h-4 w-4 mr-2", isLoadingHistory && "animate-spin")} />
                  Refresh
                </Button>
              </div>

              {isLoadingHistory ? (
                <div className="space-y-2">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : rollbackHistory.length === 0 ? (
                <Alert>
                  <Clock className="h-4 w-4" />
                  <AlertTitle>No Rollback History</AlertTitle>
                  <AlertDescription>
                    No rollback operations have been performed yet.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-2">
                  {rollbackHistory.map((entry) => (
                    <Card key={entry.id} className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={
                                entry.status === 'executed' ? 'default' :
                                entry.status === 'failed' ? 'destructive' : 'secondary'
                              }
                            >
                              {entry.status}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {new Date(entry.executed_at).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-sm">
                            {entry.action_type === 'preview' ? 'Previewed' : 'Rolled back'}{' '}
                            {entry.affected_picks?.length || 0} picks
                          </p>
                        </div>
                        <div className="text-right text-sm text-muted-foreground">
                          {entry.rollback_point?.type && (
                            <div>
                              {entry.rollback_point.type === 'pick_number' && `Pick #${entry.rollback_point.pick_number}`}
                              {entry.rollback_point.type === 'round' && `Round ${entry.rollback_point.round}`}
                              {entry.rollback_point.type === 'datetime' && new Date(entry.rollback_point.datetime).toLocaleString()}
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};
