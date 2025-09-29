import { makeDraftPick as makeDraftPickService } from '@/integrations/supabase/services/draftPicks';

export const makeDraftPick = async (playerId: string) => {
  return makeDraftPickService(playerId);
};
