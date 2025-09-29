import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface LoadingSkeletonProps {
  variant?: 'table' | 'card' | 'list';
  rows?: number;
  showAvatar?: boolean;
  className?: string;
}

/**
 * Reusable loading skeleton component for different content types
 *
 * Features:
 * - Multiple skeleton variants (table, card, list)
 * - Configurable number of rows
 * - Animated loading states
 * - Responsive design
 * - Accessibility support
 */
export const LoadingSkeleton = React.memo(({
  variant = 'table',
  rows = 3,
  showAvatar = false,
  className,
}: LoadingSkeletonProps) => {
  const renderTableSkeleton = () => (
    <div className="space-y-3">
      {/* Header skeleton */}
      <div className="flex space-x-4 p-4 bg-muted/30 rounded-lg">
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-4 w-1/4" />
      </div>

      {/* Row skeletons */}
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex space-x-4 p-4 border rounded-lg">
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-1/4" />
        </div>
      ))}
    </div>
  );

  const renderCardSkeleton = () => (
    <div className="space-y-4">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="p-4 border rounded-lg space-y-3">
          {showAvatar && (
            <div className="flex items-center space-x-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          )}
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
          <div className="flex space-x-2">
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-8 w-16" />
          </div>
        </div>
      ))}
    </div>
  );

  const renderListSkeleton = () => (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-center space-x-3 p-3 border rounded-lg">
          {showAvatar && <Skeleton className="h-8 w-8 rounded-full" />}
          <div className="space-y-1 flex-1">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="h-6 w-16" />
        </div>
      ))}
    </div>
  );

  const renderSkeleton = () => {
    switch (variant) {
      case 'card':
        return renderCardSkeleton();
      case 'list':
        return renderListSkeleton();
      case 'table':
      default:
        return renderTableSkeleton();
    }
  };

  return (
    <div
      className={cn('animate-pulse', className)}
      role="status"
      aria-label="Loading content"
    >
      {renderSkeleton()}
    </div>
  );
});

LoadingSkeleton.displayName = 'LoadingSkeleton';