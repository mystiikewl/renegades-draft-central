export const logError = (error: Error, errorInfo?: React.ErrorInfo) => {
  console.error("Error caught:", error, errorInfo);
  // In a real application, you would send this error to a logging service like Sentry or LogRocket.
  // Example:
  // Sentry.captureException(error, { extra: errorInfo });
  // LogRocket.log("Error", { error, errorInfo });
};
