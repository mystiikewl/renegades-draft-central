import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useDraftState } from '@/hooks/useDraftState';

// Mock the Supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    channel: vi.fn().mockReturnThis(),
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockResolvedValue({}),
    removeChannel: vi.fn(),
  },
}));

// Mock dependent hooks
vi.mock('@/hooks/useRealTimeDraftPicks', () => ({
  useRealTimeDraftPicks: () => ({
    draftPicks: [],
    loading: false,
  }),
}));

vi.mock('@/hooks/useTeams', () => ({
  useTeams: () => ({
    data: [],
    isLoading: false,
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

describe('useDraftState', () => {
  it('initializes with default values', () => {
    const { result } = renderHook(() => useDraftState());

    expect(result.current.currentPickIndex).toBe(0);
    // Default draft settings: 15 rounds * 12 teams = 180 total picks
    expect(result.current.totalPicks).toBe(180);
    expect(result.current.completedPicks).toBe(0);
    expect(result.current.draftPicks).toEqual([]);
    expect(result.current.isDraftComplete).toBe(false);
    expect(result.current.currentTeamId).toBeNull();
    expect(result.current.isLoadingDraftState).toBe(false);
    // Check default draft settings
    expect(result.current.draftSettings.roundCount).toBe(15);
    expect(result.current.draftSettings.teamCount).toBe(12);
  });
});