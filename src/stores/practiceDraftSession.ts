import { create } from 'zustand';
import type { DraftPick, PlayerWithStats } from '@/api/types';
import { makePracticePick } from '@/lib/practiceDraft';
import type { CpuDraftStrategy } from '@/lib/practiceDraft';

interface StartPracticeSession {
  seasonId: string;
  humanTeamId: string;
  selectedSlot: number;
  draftOrder: string[];
  cpuStrategies: Record<string, CpuDraftStrategy>;
  picks: DraftPick[];
}

interface PracticeDraftSessionState {
  active: boolean;
  seasonId: string | null;
  humanTeamId: string | null;
  selectedSlot: number;
  draftOrder: string[];
  cpuStrategies: Record<string, CpuDraftStrategy>;
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
  picks: [] as DraftPick[],
  cpuThinking: false,
  startedAt: null,
};

export const usePracticeDraftSession = create<PracticeDraftSessionState>((set) => ({
  ...emptyState,
  start: (session) => set({
    active: true,
    seasonId: session.seasonId,
    humanTeamId: session.humanTeamId,
    selectedSlot: session.selectedSlot,
    draftOrder: session.draftOrder,
    cpuStrategies: session.cpuStrategies,
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
}));
