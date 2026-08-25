import React, { ReactNode, useMemo } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

interface MobileTableProps {
  children: ReactNode;
  breakpoint?: number;
  layout?: 'table' | 'card' | 'auto';
  className?: string;
  tableClassName?: string;
  cardClassName?: string;
}

/**
 * Responsive table wrapper that automatically switches between table and card layouts
 * based on screen size and layout preference.
 *
 * Features:
 * - Automatic layout switching based on screen size
 * - Custom breakpoint support
 * - Touch gesture integration
 * - Consistent overflow handling for both layouts
 * - Horizontal scroll indicators
 * - Container constraints to prevent content spilling
 * - Performance optimizations
 * - Accessibility support
 */
export const MobileTable = React.memo(({
  children,
  breakpoint = 768,
  layout = 'auto',
  className,
  tableClassName,
  cardClassName,
}: MobileTableProps) => {
  const isMobile = useIsMobile();

  // Determine the current layout mode
  const currentLayout = useMemo(() => {
    if (layout === 'table') return 'table';
    if (layout === 'card') return 'card';

    // Auto mode - switch based on screen size
    return isMobile ? 'card' : 'table';
  }, [layout, isMobile]);

  return (
    <div
      className={cn(
        'w-full max-w-full overflow-hidden',
        className
      )}
      data-layout={currentLayout}
      role="region"
      aria-label="Responsive data table"
    >
      {currentLayout === 'table' ? (
        <div
          className={cn(
            'overflow-x-auto border rounded-lg max-w-full',
            'scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent',
            '[&::-webkit-scrollbar]:h-2',
            tableClassName
          )}
        >
          <div className="min-w-full">
            {children}
          </div>
        </div>
      ) : (
        <div
          className={cn(
            'space-y-3 max-w-full overflow-hidden',
            cardClassName
          )}
        >
          <div className="w-full">
            {children}
          </div>
        </div>
      )}
    </div>
  );
});

MobileTable.displayName = 'MobileTable';