import { Tables } from '@/integrations/supabase/types';

export type DraftPickWithRelations = Tables<'draft_picks'> & {
  player: Tables<'players'> | null;
  original_team: Tables<'teams'>;
  current_team: Tables<'teams'>;
};

// Re-export Tables type to ensure it's available
export type { Tables } from '@/integrations/supabase/types';