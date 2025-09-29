import React from 'react';
import { Check, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProgressIndicatorProps } from '@/types/onboarding';
import { useIsMobile } from '@/hooks/use-mobile';

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  currentStep,
  totalSteps,
  completedSteps,
  steps,
  onStepClick,
  className,
}) => {
  const isMobile = useIsMobile();

  const getStepStatus = (stepIndex: number) => {
    if (completedSteps.includes(stepIndex)) return 'completed';
    if (currentStep === stepIndex) return 'current';
    if (stepIndex < currentStep) return 'completed';
    return 'pending';
  };

  const getStepIcon = (stepIndex: number) => {
    const status = getStepStatus(stepIndex);
    const isClickable = onStepClick && status === 'completed';

    if (status === 'completed') {
      return (
        <div
          className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center transition-colors",
            isClickable
              ? "bg-primary hover:bg-primary/90 cursor-pointer"
              : "bg-primary"
          )}
          onClick={() => isClickable && onStepClick(stepIndex)}
        >
          <Check className="h-5 w-5 text-primary-foreground" />
        </div>
      );
    }

    return (
      <div
        className={cn(
          "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors",
          status === 'current'
            ? "bg-primary text-primary-foreground border-primary"
            : "bg-background border-muted-foreground/30"
        )}
      >
        <span className="text-sm font-medium">{stepIndex}</span>
      </div>
    );
  };

  return (
    <div className={cn("w-full", className)}>
      {/* Mobile Layout */}
      {isMobile ? (
        <div className="flex flex-col items-center space-y-4">
          <div className="flex items-center justify-center space-x-4">
            {steps.map((step, index) => {
              const stepIndex = index + 1;
              const status = getStepStatus(stepIndex);

              return (
                <React.Fragment key={step.id}>
                  <div className="flex flex-col items-center space-y-2">
                    {getStepIcon(stepIndex)}
                    <span
                      className={cn(
                        "text-xs text-center max-w-16 truncate",
                        status === 'current'
                          ? "text-primary font-medium"
                          : status === 'completed'
                          ? "text-primary"
                          : "text-muted-foreground"
                      )}
                    >
                      {step.title}
                    </span>
                  </div>
                  {stepIndex < totalSteps && (
                    <div
                      className={cn(
                        "h-0.5 w-8 transition-colors",
                        completedSteps.includes(stepIndex)
                          ? "bg-primary"
                          : "bg-muted-foreground/30"
                      )}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>
          <div className="text-center">
            <div className="text-sm text-muted-foreground">
              Step {currentStep} of {totalSteps}
            </div>
            <div className="w-full bg-secondary rounded-full h-2 mt-2">
              <div
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${(currentStep / totalSteps) * 100}%` }}
              />
            </div>
          </div>
        </div>
      ) : (
        /* Desktop Layout */
        <div className="flex items-center justify-center space-x-8">
          {steps.map((step, index) => {
            const stepIndex = index + 1;
            const status = getStepStatus(stepIndex);

            return (
              <React.Fragment key={step.id}>
                <div className="flex flex-col items-center space-y-2">
                  {getStepIcon(stepIndex)}
                  <span
                    className={cn(
                      "text-sm font-medium text-center",
                      status === 'current'
                        ? "text-primary"
                        : status === 'completed'
                        ? "text-primary"
                        : "text-muted-foreground"
                    )}
                  >
                    {step.title}
                  </span>
                </div>
                {stepIndex < totalSteps && (
                  <div
                    className={cn(
                      "h-1 w-16 md:w-24 transition-colors rounded-full",
                      completedSteps.includes(stepIndex)
                        ? "bg-primary"
                        : "bg-muted"
                    )}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
};