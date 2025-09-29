import React, { ReactNode, useRef, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface TouchActionsProps {
  children: ReactNode;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onLongPress?: () => void;
  onTap?: () => void;
  threshold?: number;
  longPressDelay?: number;
  className?: string;
  disabled?: boolean;
}

/**
 * Touch gesture handler component for mobile interactions
 *
 * Features:
 * - Swipe direction detection (left/right)
 * - Long press handling
 * - Tap gesture support
 * - Configurable thresholds
 * - Visual feedback
 * - Accessibility support
 */
export const TouchActions = React.memo(({
  children,
  onSwipeLeft,
  onSwipeRight,
  onLongPress,
  onTap,
  threshold = 50,
  longPressDelay = 500,
  className,
  disabled = false,
}: TouchActionsProps) => {
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const elementRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled) return;

    const touch = e.touches[0];
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
    };

    // Start long press timer
    if (onLongPress) {
      longPressTimerRef.current = setTimeout(() => {
        if (elementRef.current) {
          elementRef.current.style.transform = 'scale(0.95)';
          setTimeout(() => {
            if (elementRef.current) {
              elementRef.current.style.transform = '';
            }
          }, 100);
        }
        onLongPress();
      }, longPressDelay);
    }
  }, [onLongPress, longPressDelay, disabled]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (disabled || !touchStartRef.current) return;

    // Cancel long press if user moves
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, [disabled]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (disabled || !touchStartRef.current) return;

    // Clear long press timer
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;
    const deltaTime = Date.now() - touchStartRef.current.time;

    // Check if it's a quick tap (less than 300ms and minimal movement)
    if (deltaTime < 300 && Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) {
      if (onTap) {
        e.preventDefault();
        onTap();
      }
      touchStartRef.current = null;
      return;
    }

    // Check for horizontal swipe
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > threshold) {
      e.preventDefault();

      if (deltaX > 0 && onSwipeRight) {
        onSwipeRight();
      } else if (deltaX < 0 && onSwipeLeft) {
        onSwipeLeft();
      }
    }

    touchStartRef.current = null;
  }, [onSwipeLeft, onSwipeRight, onTap, threshold, disabled]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (disabled) return;

    // Handle mouse clicks as taps for desktop
    if (onTap) {
      e.preventDefault();
      onTap();
    }
  }, [onTap, disabled]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  return (
    <div
      ref={elementRef}
      className={cn(
        'transition-transform duration-100',
        disabled && 'pointer-events-none opacity-50',
        className
      )}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={handleClick}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
    >
      {children}
    </div>
  );
});

TouchActions.displayName = 'TouchActions';