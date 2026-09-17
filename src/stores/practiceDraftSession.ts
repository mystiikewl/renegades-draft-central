import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { DraftPick, PlayerWithStats } from '@/api/types';
import { makePracticePick } from '@/lib/practiceDraft';
import type { CpuDraftStrategy, CpuDifficulty } from '@/lib/practiceDraft';

interface StartPracticeSession {
  seasonId: string;
  humanTeamId: string;
  selectedSlot: number;
  draftOrder: string[];
  cpuStrategies: Record<string, CpuDraftStrategy>;
  cpuSkills: Record<string, number>;
  difficulty: CpuDifficulty;
  picks: DraftPick[];
}

interface PracticeDraftSessionState {
  active: boolean;
  seasonId: string | null;
  humanTeamId: string | null;
  selectedSlot: number;
  draftOrder: string[];
  cpuStrategies: Record<string, CpuDraftStrategy>;
  cpuSkills: Record<string, number>;
  difficulty: CpuDifficulty;
  picks: DraftPick[];
  cpuThinking: boolean;
  startedAt: string | null;
  start: (session: StartPracticeSession) => void;
  setPicks: (updater: DraftPick[] | ((current: DraftPick[]) => DraftPick[])) => void;
  makeHumanPick: (pickId: string, player: PlayerWithStats) => void;
  setCpuThinking: (thinking: boolean) => void;
  end: () => void;
}

const emptyState = {
  active: false,
  seasonId: null,
  humanTeamId: null,
  selectedSlot: 1,
  draftOrder: [] as string[],
  cpuStrategies: {} as Record<string, CpuDraftStrategy>,
  cpuSkills: {} as Record<string, number>,
  difficulty: 'veteran' as CpuDifficulty,
  picks: [] as DraftPick[],
  cpuThinking: false,
  startedAt: null,
};

/**
 * The practice simulation survives page refreshes: everything but the
 * ephemeral `cpuThinking` flag persists to localStorage, so an accidental
 * reload resumes the room instead of throwing the draft away.
 */
export const usePracticeDraftSession = create<PracticeDraftSessionState>()(
  persist(
    (set) => ({
      ...emptyState,
      start: (session) => set({
        active: true,
        seasonId: session.seasonId,
        humanTeamId: session.humanTeamId,
        selectedSlot: session.selectedSlot,
        draftOrder: session.draftOrder,
        cpuStrategies: session.cpuStrategies,
        cpuSkills: session.cpuSkills,
        difficulty: session.difficulty,
        picks: session.picks,
        cpuThinking: false,
        startedAt: new Date().toISOString(),
      }),
      setPicks: (updater) => set((state) => ({
        picks: typeof updater === 'function' ? updater(state.picks) : updater,
      })),
      makeHumanPick: (pickId, player) => set((state) => ({
        picks: makePracticePick(state.picks, pickId, player),
      })),
      setCpuThinking: (cpuThinking) => set({ cpuThinking }),
      end: () => set({ ...emptyState }),
    }),
    {
      name: 'renegades-practice-draft-session',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        active: state.active,
        seasonId: state.seasonId,
        humanTeamId: state.humanTeamId,
        selectedSlot: state.selectedSlot,
        draftOrder: state.draftOrder,
        cpuStrategies: state.cpuStrategies,
        cpuSkills: state.cpuSkills,
        difficulty: state.difficulty,
        picks: state.picks,
        startedAt: state.startedAt,
      }),
    },
  ),
);
