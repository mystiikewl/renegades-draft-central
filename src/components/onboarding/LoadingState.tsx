import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

interface LoadingStateProps {
  title?: string;
  message?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  title = "Loading...",
  message = "Please wait while we prepare your onboarding experience.",
  className,
  size = 'md',
}) => {
  const isMobile = useIsMobile();

  const sizeClasses = {
    sm: {
      container: "min-h-32",
      spinner: "w-6 h-6",
      title: "text-sm",
      message: "text-xs",
    },
    md: {
      container: "min-h-48",
      spinner: "w-8 h-8",
      title: "text-base",
      message: "text-sm",
    },
    lg: {
      container: "min-h-64",
      spinner: "w-12 h-12",
      title: "text-lg",
      message: "text-base",
    },
  };

  const classes = sizeClasses[size];

  return (
    <div className={cn("flex items-center justify-center p-4", className)}>
      <Card className="bg-gradient-card shadow-card border-0">
        <CardContent className={cn(
          "flex flex-col items-center justify-center text-center space-y-4",
          classes.container,
          isMobile ? "p-4" : "p-8"
        )}>
          <div className={cn(
            "animate-spin rounded-full border-2 border-primary border-t-transparent",
            classes.spinner
          )} />

          <div className="space-y-2">
            <h3 className={cn(
              "font-semibold text-foreground",
              classes.title
            )}>
              {title}
            </h3>
            <p className={cn(
              "text-muted-foreground max-w-sm",
              classes.message
            )}>
              {message}
            </p>
          </div>

          {/* Loading dots animation */}
          <div className="flex space-x-1">
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]" />
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]" />
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};