import { useEffect, useRef } from 'react';

const RENDER_TIME_THRESHOLD = 16; // Corresponds to 60 FPS

export const usePerformanceMonitoring = (componentName: string) => {
  const renderStartTime = useRef<number | null>(null);

  if (process.env.NODE_ENV === 'development') {
    renderStartTime.current = performance.now();
  }

  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && renderStartTime.current) {
      const renderTime = performance.now() - renderStartTime.current;
      if (renderTime > RENDER_TIME_THRESHOLD) {
        console.warn(
          `%c[Performance] ${componentName} took ${renderTime.toFixed(2)}ms to render.`,
          'color: orange; font-weight: bold;'
        );
      }
    }
  });
};
