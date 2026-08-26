import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { DraftSettings } from '@/api/types';
import { useUpdateDraftSettings } from '@/api/mutations';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const settingsSchema = z
  .object({
    league_size: z.coerce.number().int('Whole numbers only').min(8, 'League size must be 8–20').max(20),
    roster_size: z.coerce.number().int('Whole numbers only').min(8, 'Roster size must be 8–20').max(20),
    keeper_limit: z.coerce.number().int('Whole numbers only').min(0).max(20),
    draft_type: z.enum(['snake', 'linear']),
    pick_time_limit_seconds: z.coerce
      .number()
      .int('Whole numbers only')
      .min(15, 'Must be 15–600 seconds')
      .max(600, 'Must be 15–600 seconds'),
  })
  .superRefine((v, ctx) => {
    if (v.keeper_limit > v.roster_size) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['keeper_limit'],
        message: 'Keeper limit cannot exceed roster size',
      });
    }
  });

type SettingsForm = z.input<typeof settingsSchema>;

export function DraftSettingsCard({ seasonId, settings }: { seasonId: string; settings: DraftSettings }) {
  const locked = settings.status !== 'pre_draft';
  const save = useUpdateDraftSettings(seasonId);
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<SettingsForm>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      league_size: settings.league_size,
      roster_size: settings.roster_size,
      keeper_limit: settings.keeper_limit,
      draft_type: settings.draft_type,
      pick_time_limit_seconds: settings.pick_time_limit_seconds,
    },
  });

  // Re-seed the form if another admin saves or a reset restores defaults.
  useEffect(() => {
    reset({
      league_size: settings.league_size,
      roster_size: settings.roster_size,
      keeper_limit: settings.keeper_limit,
      draft_type: settings.draft_type,
      pick_time_limit_seconds: settings.pick_time_limit_seconds,
    });
  }, [reset, settings]);

  const draftType = watch('draft_type');
  const num = (name: keyof SettingsForm) => ({
    type: 'number' as const,
    disabled: locked,
    ...register(name),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Draft settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {locked && (
          <p className="text-sm text-muted-foreground">
            Settings are read-only once the draft has started (current status:{' '}
            <span className="font-medium">{settings.status}</span>). Reset the draft to edit again.
          </p>
        )}
        <form className="grid grid-cols-1 gap-4 sm:grid-cols-2" onSubmit={handleSubmit((v) => save.mutate(v as never))}>
          <div className="space-y-1.5">
            <Label htmlFor="ds-league">League size</Label>
            <Input id="ds-league" data-testid="ds-league" {...num('league_size')} />
            {errors.league_size && <p className="text-sm text-destructive">{errors.league_size.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ds-roster">Roster size</Label>
            <Input id="ds-roster" data-testid="ds-roster" {...num('roster_size')} />
            {errors.roster_size && <p className="text-sm text-destructive">{errors.roster_size.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ds-keeper">Keeper limit</Label>
            <Input id="ds-keeper" data-testid="ds-keeper" {...num('keeper_limit')} />
            {errors.keeper_limit && <p className="text-sm text-destructive">{errors.keeper_limit.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ds-time">Pick time limit (seconds)</Label>
            <Input id="ds-time" data-testid="ds-time" {...num('pick_time_limit_seconds')} />
            {errors.pick_time_limit_seconds && (
              <p className="text-sm text-destructive">{errors.pick_time_limit_seconds.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ds-type">Draft type</Label>
            <Select value={draftType} onValueChange={(v) => setValue('draft_type', v as SettingsForm['draft_type'])} disabled={locked}>
              <SelectTrigger id="ds-type" data-testid="ds-type" className="w-full sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="snake">Snake</SelectItem>
                <SelectItem value="linear">Linear</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {!locked && (
            <div className="flex items-end">
              <Button type="submit" data-testid="ds-save" disabled={save.isPending}>
                {save.isPending ? 'Saving…' : 'Save settings'}
              </Button>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
