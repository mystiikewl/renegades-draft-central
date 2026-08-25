import React, { Component, ErrorInfo, ReactNode } from 'react';
import { logError } from '../utils/logging'; // Import the logging utility

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(_: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logError(error, errorInfo); // Use the logging utility
  }

  public render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return (
        <div className="flex flex-col items-center justify-center h-screen text-center">
          <h1 className="text-4xl font-bold text-red-600 mb-4">Oops! Something went wrong.</h1>
          <p className="text-lg text-gray-700 mb-8">
            We're sorry, but an unexpected error occurred. Please try refreshing the page.
          </p>
          <button
            className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            onClick={() => window.location.reload()}
          >
            Refresh Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
