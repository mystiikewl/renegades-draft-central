import { useEffect, useMemo } from 'react';
import { Link, useLocation } from '@tanstack/react-router';
import { Bot, ArrowRight } from 'lucide-react';
import { usePracticeDraftPool } from '@/api/queries';
import { nextPick as nextPickOf } from '@/lib/draftState';
import {
  availablePracticePlayers,
  chooseCpuPracticePlayer,
  cpuThinkDelayMs,
  makePracticePick,
  skipPracticePick,
} from '@/lib/practiceDraft';
import { usePracticeDraftSession } from '@/stores/practiceDraftSession';

export function PracticeDraftSessionController() {
  const { pathname } = useLocation();
  const active = usePracticeDraftSession((state) => state.active);
  const seasonId = usePracticeDraftSession((state) => state.seasonId);
  const humanTeamId = usePracticeDraftSession((state) => state.humanTeamId);
  const picks = usePracticeDraftSession((state) => state.picks);
  const draftOrder = usePracticeDraftSession((state) => state.draftOrder);
  const cpuStrategies = usePracticeDraftSession((state) => state.cpuStrategies);
  const cpuSkills = usePracticeDraftSession((state) => state.cpuSkills);
  const difficulty = usePracticeDraftSession((state) => state.difficulty);
  const cpuThinking = usePracticeDraftSession((state) => state.cpuThinking);
  const setPicks = usePracticeDraftSession((state) => state.setPicks);
  const setCpuThinking = usePracticeDraftSession((state) => state.setCpuThinking);
  const { data: players, isLoading } = usePracticeDraftPool(active ? seasonId ?? undefined : undefined);

  const nextPick = useMemo(() => nextPickOf(picks), [picks]);
  const isHumanTurn = !!nextPick && !!humanTeamId && nextPick.team_id === humanTeamId;
  const complete = picks.length > 0 && picks.every((pick) => pick.is_used);
  const totalPicks = picks.length;
  const rosterSize = draftOrder.length > 0 ? Math.round(totalPicks / draftOrder.length) : 0;

  useEffect(() => {
    if (!active || !nextPick || isHumanTurn || !humanTeamId) {
      if (!active || isHumanTurn || complete) setCpuThinking(false);
      return;
    }
    if (isLoading) return;

    // A pool that finished loading empty (failed import, query error) must not
    // stall the room: CPU turns resolve as skips so the draft can complete.
    const poolUnavailable = !players?.length;
    const teamId = nextPick.team_id;
    const timer = window.setTimeout(() => {
      setPicks((current) => {
        const currentNext = nextPickOf(current) ?? undefined;
        if (!currentNext || currentNext.team_id === humanTeamId) return current;
        if (poolUnavailable) return skipPracticePick(current, currentNext.id);
        const remaining = availablePracticePlayers(players, current);
        const rosterIds = current
          .filter((pick) => pick.team_id === currentNext.team_id && pick.player_id)
          .map((pick) => pick.player_id as string);
        const player = chooseCpuPracticePlayer(
          remaining,
          players,
          rosterIds,
          cpuStrategies[teamId] ?? 'balanced',
          {
            difficulty,
            skill: cpuSkills[teamId] ?? 0,
            leagueSize: draftOrder.length,
            rosterSize,
          },
        );
        return player
          ? makePracticePick(current, currentNext.id, player)
          : skipPracticePick(current, currentNext.id);
      });
      setCpuThinking(false);
    }, poolUnavailable ? 400 : cpuThinkDelayMs(nextPick.pick_number, totalPicks));

    setCpuThinking(!poolUnavailable);
    return () => window.clearTimeout(timer);
  }, [
    active, complete, cpuSkills, cpuStrategies, difficulty, draftOrder.length, humanTeamId,
    isHumanTurn, isLoading, nextPick, players, rosterSize, setCpuThinking, setPicks, totalPicks,
  ]);

  if (!active || pathname === '/practice-draft') return null;

  return (
    <div className="border-b border-primary/20 bg-primary/[0.06]">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Bot className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-primary">Practice draft active</div>
          <div className="line-clamp-1 text-xs font-semibold sm:text-sm">
            {complete
              ? 'Simulation complete'
              : isHumanTurn
                ? `Your pick · #${nextPick?.pick_number}`
                : cpuThinking
                  ? `CPU drafting · #${nextPick?.pick_number}`
                  : `Practice pick #${nextPick?.pick_number}`}
          </div>
        </div>
        <Link
          to="/practice-draft"
          className="flex shrink-0 items-center gap-1 rounded-lg border bg-background px-2.5 py-1.5 text-xs font-semibold transition-colors hover:bg-muted"
        >
          Return <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </div>
  );
}
