import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FeatureCardProps } from '@/types/onboarding';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

export const FeatureCard: React.FC<FeatureCardProps> = ({
  icon,
  title,
  description,
  className,
}) => {
  const isMobile = useIsMobile();

  return (
    <Card className={cn(
      "bg-gradient-card shadow-card border-0 transition-all duration-200 hover:scale-105 hover:shadow-lg",
      isMobile ? "p-4" : "p-6",
      className
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className={cn(
            "p-2 rounded-lg bg-primary/10",
            isMobile ? "p-1.5" : "p-2"
          )}>
            {React.cloneElement(icon as React.ReactElement, {
              className: cn(
                "text-primary",
                isMobile ? "h-4 w-4" : "h-5 w-5"
              )
            })}
          </div>
          <CardTitle className={cn(
            "font-semibold",
            isMobile ? "text-base" : "text-lg"
          )}>
            {title}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <CardDescription className={cn(
          "text-muted-foreground leading-relaxed",
          isMobile ? "text-sm" : "text-base"
        )}>
          {description}
        </CardDescription>
      </CardContent>
    </Card>
  );
};