// Entry point for all modularized Supabase types

// Enums and shared types
export type { Json } from './enums';

// Table types
export type { 
  DraftPicksRow, 
  DraftPicksInsert, 
  DraftPicksUpdate
} from './tables/draft_picks';
export { draftPicksRelationships } from './tables/draft_picks';

export type { 
  DraftSettingsRow, 
  DraftSettingsInsert, 
  DraftSettingsUpdate
} from './tables/draft_settings';
export { draftSettingsRelationships } from './tables/draft_settings';

export type { 
  KeepersRow, 
  KeepersInsert, 
  KeepersUpdate
} from './tables/keepers';
export { keepersRelationships } from './tables/keepers';

export type { 
  PlayerSeasonsRow, 
  PlayerSeasonsInsert, 
  PlayerSeasonsUpdate
} from './tables/player_seasons';
export { playerSeasonsRelationships } from './tables/player_seasons';

export type { 
  PlayersRow, 
  PlayersInsert, 
  PlayersUpdate
} from './tables/players';
export { playersRelationships } from './tables/players';

export type { 
  ProfilesRow, 
  ProfilesInsert, 
  ProfilesUpdate
} from './tables/profiles';
export { profilesRelationships } from './tables/profiles';

export type { 
  TeamsRow, 
  TeamsInsert, 
  TeamsUpdate
} from './tables/teams';
export { teamsRelationships } from './tables/teams';

// Function types
export type { 
  ClaimTeamArgs, 
  ClaimTeamReturns 
} from './functions/claim_team';

export type { 
  InviteAndAssignUserToTeamArgs, 
  InviteAndAssignUserToTeamReturns 
} from './functions/invite_and_assign_user_to_team';

export type { 
  IsAdminArgs, 
  IsAdminReturns 
} from './functions/is_admin';