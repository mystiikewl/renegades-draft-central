import React, { Component, ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Home, MessageCircle } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  showDetails?: boolean;
}

class OnboardingErrorBoundaryClass extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    });

    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Onboarding Error Boundary caught an error:', error, errorInfo);
    }

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return <ErrorFallback
        error={this.state.error}
        errorInfo={this.state.errorInfo}
        showDetails={this.props.showDetails}
        onRetry={this.handleRetry}
      />;
    }

    return this.props.children;
  }
}

interface ErrorFallbackProps {
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  showDetails?: boolean;
  onRetry: () => void;
}

const ErrorFallback: React.FC<ErrorFallbackProps> = ({
  error,
  errorInfo,
  showDetails = false,
  onRetry,
}) => {
  const isMobile = useIsMobile();

  const handleRefresh = () => {
    window.location.reload();
  };

  const handleGoHome = () => {
    window.location.href = '/';
  };

  const handleContactSupport = () => {
    // You can implement your support contact logic here
    window.open('mailto:support@example.com?subject=Onboarding Error', '_blank');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className={cn(
        "bg-gradient-card shadow-card border-0 max-w-2xl w-full",
        isMobile ? "p-4" : "p-8"
      )}>
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-3 bg-red-100 dark:bg-red-900/20 rounded-full">
            <AlertTriangle className={cn(
              "text-red-600 dark:text-red-400",
              isMobile ? "h-6 w-6" : "h-8 w-8"
            )} />
          </div>
          <CardTitle className={cn(
            "text-red-600 dark:text-red-400",
            isMobile ? "text-lg" : "text-xl"
          )}>
            Oops! Something went wrong
          </CardTitle>
          <CardDescription className={cn(
            "text-muted-foreground",
            isMobile ? "text-sm" : "text-base"
          )}>
            We encountered an unexpected error during your onboarding process.
            Don't worry - your progress is saved and you can try again.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Error Details (only in development or if showDetails is true) */}
          {showDetails && error && (
            <div className="p-4 bg-muted rounded-lg border">
              <h4 className="font-semibold mb-2 text-sm">Error Details:</h4>
              <div className="text-xs font-mono bg-background p-2 rounded border">
                <div className="text-red-600 dark:text-red-400 mb-1">
                  {error.name}: {error.message}
                </div>
                {errorInfo && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-muted-foreground">
                      Stack Trace
                    </summary>
                    <pre className="mt-2 whitespace-pre-wrap text-xs">
                      {errorInfo.componentStack}
                    </pre>
                  </details>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className={cn(
            "flex flex-col space-y-3",
            isMobile ? "space-y-2" : "space-y-3"
          )}>
            <Button
              onClick={onRetry}
              className="w-full"
              size={isMobile ? "sm" : "default"}
            >
              <RefreshCw className={cn(
                "mr-2",
                isMobile ? "h-3 w-3" : "h-4 w-4"
              )} />
              Try Again
            </Button>

            <Button
              onClick={handleRefresh}
              variant="outline"
              className="w-full"
              size={isMobile ? "sm" : "default"}
            >
              <RefreshCw className={cn(
                "mr-2",
                isMobile ? "h-3 w-3" : "h-4 w-4"
              )} />
              Refresh Page
            </Button>

            <div className={cn(
              "grid grid-cols-2 gap-3",
              isMobile ? "grid-cols-1 gap-2" : "grid-cols-2 gap-3"
            )}>
              <Button
                onClick={handleGoHome}
                variant="outline"
                size={isMobile ? "sm" : "default"}
              >
                <Home className={cn(
                  "mr-2",
                  isMobile ? "h-3 w-3" : "h-4 w-4"
                )} />
                Go Home
              </Button>

              <Button
                onClick={handleContactSupport}
                variant="outline"
                size={isMobile ? "sm" : "default"}
              >
                <MessageCircle className={cn(
                  "mr-2",
                  isMobile ? "h-3 w-3" : "h-4 w-4"
                )} />
                Support
              </Button>
            </div>
          </div>

          {/* User-friendly message */}
          <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className={cn(
              "text-blue-800 dark:text-blue-200",
              isMobile ? "text-xs" : "text-sm"
            )}>
              💡 <strong>Tip:</strong> If this error persists, please contact our support team.
              Your onboarding progress is automatically saved and will be restored when you return.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export const OnboardingErrorBoundary: React.FC<ErrorBoundaryProps> = (props) => {
  return <OnboardingErrorBoundaryClass {...props} />;
};