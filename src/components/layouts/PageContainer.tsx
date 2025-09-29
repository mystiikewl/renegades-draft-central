import React from 'react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '7xl' | 'full';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  centerContent?: boolean;
}

const maxWidthClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '7xl': 'max-w-7xl',
  full: 'max-w-full'
};

const paddingClasses = {
  none: 'p-0',
  sm: 'p-2 sm:p-4',
  md: 'p-4 md:p-6',
  lg: 'p-6 lg:p-8'
};

export const PageContainer = ({
  children,
  className,
  maxWidth = '7xl',
  padding = 'md',
  centerContent = false
}: PageContainerProps) => {
  const isMobile = useIsMobile();

  return (
    <div className={cn(
      // Base responsive container
      'w-full',
      maxWidthClasses[maxWidth],
      'mx-auto',
      // Responsive padding with mobile-first approach
      paddingClasses[padding],
      // Center content if requested
      centerContent && 'flex flex-col items-center justify-center min-h-[50vh]',
      // Additional classes
      className
    )}>
      {children}
    </div>
  );
};

// Specialized variant for page headers
interface PageHeaderContainerProps {
  children: React.ReactNode;
  className?: string;
  sticky?: boolean;
  withBackdrop?: boolean;
}

export const PageHeaderContainer = ({
  children,
  className,
  sticky = false,
  withBackdrop = false
}: PageHeaderContainerProps) => {
  const isMobile = useIsMobile();

  return (
    <div className={cn(
      'w-full',
      sticky && 'sticky top-0 z-40',
      withBackdrop && 'bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60',
      'border-b border-border',
      isMobile ? 'px-4 py-3' : 'px-6 py-4 md:px-8 md:py-6',
      className
    )}>
      {children}
    </div>
  );
};

// Specialized variant for main content areas
interface MainContentContainerProps {
  children: React.ReactNode;
  className?: string;
  id?: string;
  withBottomPadding?: boolean;
}

export const MainContentContainer = ({
  children,
  className,
  id,
  withBottomPadding = false
}: MainContentContainerProps) => {
  const isMobile = useIsMobile();

  return (
    <main
      id={id}
      className={cn(
        'w-full',
        isMobile ? 'px-4 py-4' : 'px-6 py-8 md:px-8',
        withBottomPadding && (isMobile ? 'pb-20' : 'pb-8'), // Account for mobile nav
        className
      )}
    >
      {children}
    </main>
  );
};

// Specialized variant for sections within pages
interface SectionContainerProps {
  children: React.ReactNode;
  className?: string;
  as?: 'section' | 'div' | 'article';
  spacing?: 'none' | 'sm' | 'md' | 'lg';
}

const spacingClasses = {
  none: 'space-y-0',
  sm: 'space-y-4',
  md: 'space-y-6',
  lg: 'space-y-8'
};

export const SectionContainer = ({
  children,
  className,
  as: Component = 'div',
  spacing = 'md'
}: SectionContainerProps) => {
  return (
    <Component className={cn(spacingClasses[spacing], className)}>
      {children}
    </Component>
  );
};