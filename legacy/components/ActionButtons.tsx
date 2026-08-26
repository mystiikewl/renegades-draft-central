import React from 'react';
import { Button } from '@/components/ui/button';

interface ActionButtonsProps {
  onMakePick: () => void;
  onUndoPick: () => void;
  onTradePlayer: () => void;
  isDraftActive: boolean;
  currentPick: number;
}

export function ActionButtons({
  onMakePick,
  onUndoPick,
  onTradePlayer,
  isDraftActive,
  currentPick,
}: ActionButtonsProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-2 p-4 bg-card rounded-lg border border-border">
      <div className="text-sm font-semibold mb-2 sm:mb-0">Draft Actions for Pick #{currentPick}</div>
      <div className="flex gap-2">
        <Button
          variant="default"
          onClick={onMakePick}
          disabled={!isDraftActive}
          className="flex-1"
        >
          Make Pick
        </Button>
        <Button
          variant="outline"
          onClick={onUndoPick}
          disabled={!isDraftActive}
          className="flex-1"
        >
          Undo Pick
        </Button>
        <Button
          variant="outline"
          onClick={onTradePlayer}
          disabled={!isDraftActive}
          className="flex-1"
        >
          Trade Player
        </Button>
      </div>
    </div>
  );
}