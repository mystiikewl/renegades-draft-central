import { useEffect, useRef, useCallback } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';

interface TouchInteractionsOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  onTap?: (x: number, y: number) => void;
  onDoubleTap?: (x: number, y: number) => void;
  onLongPress?: (x: number, y: number) => void;
  onPullToRefresh?: () => void;
  swipeThreshold?: number;
  longPressDelay?: number;
  doubleTapDelay?: number;
}

export const useTouchInteractions = ({
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onSwipeDown,
  onTap,
  onDoubleTap,
  onLongPress,
  onPullToRefresh,
  swipeThreshold = 100,
  longPressDelay = 500,
  doubleTapDelay = 300
}: TouchInteractionsOptions = {}) => {
  const isMobile = useIsMobile();
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const pullDistanceRef = useRef(0);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastTapRef = useRef<{ x: number; y: number; time: number } | null>(null);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (!isMobile) return;

    const touch = e.touches[0];
    const currentTime = Date.now();

    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: currentTime
    };

    pullDistanceRef.current = 0;

    // Start long press timer
    if (onLongPress) {
      longPressTimerRef.current = setTimeout(() => {
        if (touchStartRef.current) {
          onLongPress(touch.clientX, touch.clientY);
        }
      }, longPressDelay);
    }

    // Check for double tap
    if (lastTapRef.current) {
      const timeDiff = currentTime - lastTapRef.current.time;
      const distance = Math.sqrt(
        Math.pow(touch.clientX - lastTapRef.current.x, 2) +
        Math.pow(touch.clientY - lastTapRef.current.y, 2)
      );

      if (timeDiff < doubleTapDelay && distance < 30 && onDoubleTap) {
        onDoubleTap(touch.clientX, touch.clientY);
        lastTapRef.current = null;
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
        }
        return;
      }
    }
  }, [isMobile, onLongPress, onDoubleTap, longPressDelay, doubleTapDelay]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isMobile || !touchStartRef.current) return;

    const touch = e.touches[0];
    const deltaX = touchStartRef.current.x - touch.clientX;
    const deltaY = touchStartRef.current.y - touch.clientY;

    // Handle pull to refresh (vertical scroll at top)
    if (Math.abs(deltaY) > Math.abs(deltaX) && deltaY < 0 && window.scrollY === 0) {
      if (onPullToRefresh) {
        e.preventDefault();
        pullDistanceRef.current = Math.abs(deltaY);

        // Add visual feedback for pull to refresh
        const progress = Math.min(pullDistanceRef.current / 80, 1);
        document.body.style.transform = `translateY(${pullDistanceRef.current}px)`;
        document.body.style.transition = 'none';
      }
    }

    // Cancel long press if moved too much
    if (longPressTimerRef.current && (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10)) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, [isMobile, onPullToRefresh]);

  const handleTouchEnd = useCallback(() => {
    if (!isMobile || !touchStartRef.current) return;

    const touch = { clientX: touchStartRef.current.x, clientY: touchStartRef.current.y };
    const deltaX = touchStartRef.current.x - touch.clientX;
    const deltaY = touchStartRef.current.y - touch.clientY;
    const deltaTime = Date.now() - touchStartRef.current.time;

    // Clear long press timer
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    // Reset pull to refresh visual feedback
    if (pullDistanceRef.current > 0) {
      document.body.style.transform = '';
      document.body.style.transition = 'transform 0.3s ease-out';
    }

    // Handle pull to refresh
    if (pullDistanceRef.current > 80 && onPullToRefresh) {
      onPullToRefresh();
    }

    // Handle swipes
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);

    if (absDeltaX > swipeThreshold || absDeltaY > swipeThreshold) {
      if (absDeltaX > absDeltaY) {
        // Horizontal swipe
        if (deltaX > 0 && onSwipeLeft) {
          onSwipeLeft();
        } else if (deltaX < 0 && onSwipeRight) {
          onSwipeRight();
        }
      } else {
        // Vertical swipe
        if (deltaY > 0 && onSwipeUp) {
          onSwipeUp();
        } else if (deltaY < 0 && onSwipeDown) {
          onSwipeDown();
        }
      }
    } else if (absDeltaX < 10 && absDeltaY < 10 && deltaTime < 300) {
      // Handle tap
      if (onTap) {
        onTap(touch.clientX, touch.clientY);
      }

      // Store for double tap detection
      lastTapRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now()
      };
    }

    touchStartRef.current = null;
    pullDistanceRef.current = 0;
  }, [isMobile, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, onTap, onPullToRefresh, swipeThreshold]);

  useEffect(() => {
    if (!isMobile) return;

    // Add event listeners with passive: false for preventDefault support
    document.addEventListener('touchstart', handleTouchStart, { passive: false });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);

      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, [isMobile, handleTouchStart, handleTouchMove, handleTouchEnd]);

  return {
    isMobile,
    isTouching: touchStartRef.current !== null,
    pullDistance: pullDistanceRef.current
  };
};

// Specialized hook for navigation swipes
export const useNavigationSwipe = (
  onPrevious?: () => void,
  onNext?: () => void
) => {
  return useTouchInteractions({
    onSwipeRight: onPrevious, // Swipe right to go back
    onSwipeLeft: onNext,      // Swipe left to go forward
    swipeThreshold: 75
  });
};

// Specialized hook for pull to refresh
export const usePullToRefresh = (onRefresh?: () => void) => {
  return useTouchInteractions({
    onPullToRefresh: onRefresh,
    swipeThreshold: 50
  });
};

// Hook for detecting mobile gestures
export const useMobileGestures = () => {
  const gesturesRef = useRef({
    pinchStart: null as { distance: number; scale: number } | null,
    rotationStart: null as number | null
  });

  const handleGestureStart = useCallback((e: any) => {
    e.preventDefault();
    gesturesRef.current.pinchStart = {
      distance: Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      ),
      scale: 1
    };
  }, []);

  const handleGestureChange = useCallback((e: any) => {
    e.preventDefault();
    if (gesturesRef.current.pinchStart) {
      const currentDistance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const scale = currentDistance / gesturesRef.current.pinchStart.distance;
      // Handle pinch zoom here if needed
    }
  }, []);

  const handleGestureEnd = useCallback(() => {
    gesturesRef.current.pinchStart = null;
    gesturesRef.current.rotationStart = null;
  }, []);

  useEffect(() => {
    const isMobile = window.innerWidth <= 768;
    if (!isMobile) return;

    // Add gesture event listeners
    document.addEventListener('gesturestart', handleGestureStart);
    document.addEventListener('gesturechange', handleGestureChange);
    document.addEventListener('gestureend', handleGestureEnd);

    return () => {
      document.removeEventListener('gesturestart', handleGestureStart);
      document.removeEventListener('gesturechange', handleGestureChange);
      document.removeEventListener('gestureend', handleGestureEnd);
    };
  }, [handleGestureStart, handleGestureChange, handleGestureEnd]);

  return gesturesRef.current;
};