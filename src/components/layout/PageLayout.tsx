import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type PageShellSize = 'compact' | 'medium' | 'wide';

const widthClasses: Record<PageShellSize, string> = {
  compact: 'max-w-xl',
  medium: 'max-w-4xl',
  wide: 'max-w-7xl',
};

type PageShellProps = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  children: ReactNode;
  size?: PageShellSize;
  mobileBleed?: boolean;
};

/** Consistent page gutters, vertical rhythm and content width. */
export function PageShell({
  children,
  size = 'wide',
  mobileBleed = false,
  className,
  ...props
}: PageShellProps) {
  return (
    <div
      className={cn(
        'mx-auto w-full',
        widthClasses[size],
        mobileBleed
          ? 'space-y-3 px-0 py-3 sm:px-4 md:space-y-4 md:p-6'
          : 'space-y-4 px-4 py-4 md:p-6',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

type PageHeaderProps = {
  title: ReactNode;
  eyebrow?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
  titleClassName?: string;
  descriptionClassName?: string;
};

/** Shared title/action row so pages do not each reinvent header spacing. */
export function PageHeader({
  title,
  eyebrow,
  description,
  actions,
  className,
  titleClassName,
  descriptionClassName,
}: PageHeaderProps) {
  return (
    <header className={cn('flex items-center justify-between gap-3', className)}>
      <div className="min-w-0">
        {eyebrow && (
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            {eyebrow}
          </div>
        )}
        <h1
          className={cn(
            'text-xl font-bold tracking-tight sm:text-2xl',
            eyebrow && 'mt-1',
            titleClassName,
          )}
        >
          {title}
        </h1>
        {description && (
          <div className={cn('mt-0.5 text-xs text-muted-foreground', descriptionClassName)}>
            {description}
          </div>
        )}
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </header>
  );
}
