import type { ButtonHTMLAttributes, ReactNode } from 'react';

/**
 * The pill-shaped filter chip shared by the Player Pool and Rankings filter
 * rows (previously two identical `chip()` class-string helpers).
 */
export function FilterChip({
  active,
  children,
  className = '',
  ...rest
}: {
  active: boolean;
  children: ReactNode;
  className?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={`shrink-0 rounded-full border px-3.5 py-2 text-sm font-semibold transition-all active:scale-[0.98] ${
        active
          ? 'border-foreground bg-foreground text-background shadow-sm'
          : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground'
      } ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
