import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ErrorBoundary from "./components/ErrorBoundary"; // Import ErrorBoundary
import NotFound from "./pages/NotFound";
import useOfflineStatus from "./hooks/useOfflineStatus"; // Import useOfflineStatus
import { useToast } from "@/components/ui/use-toast"; // Import useToast
import { useEffect, lazy, Suspense } from "react"; // Import useEffect, lazy, and Suspense
import ProtectedRoute from "./components/ProtectedRoute";
import MainLayout from "./components/layouts/MainLayout";

// Lazy load the page components
const Draft = lazy(() => import("./pages/Draft")); // Renamed from Index to Draft
const Auth = lazy(() => import("./pages/Auth"));
const Admin = lazy(() => import("./pages/Admin"));
const DraftAdmin = lazy(() => import("./pages/DraftAdmin")); // Lazy load DraftAdmin
const DraftSettingsGeneralPage = lazy(() => import("./pages/admin/DraftSettingsGeneralPage"));
const DraftOrderManagerPage = lazy(() => import("./pages/admin/DraftOrderManagerPage"));
const DraftPicksTraderPage = lazy(() => import("./pages/admin/DraftPicksTraderPage"));
const DraftRollbackManagerPage = lazy(() => import("./pages/admin/DraftRollbackManagerPage"));
const KeeperManagementPage = lazy(() => import("./pages/admin/KeeperManagementPage"));
const PlayerPoolPage = lazy(() => import("./pages/PlayerPoolPage"));
const LeagueAnalysis = lazy(() => import("./pages/LeagueAnalysis")); // Lazy load LeagueAnalysis
const Team = lazy(() => import("./pages/Team"));
const TeamAdmin = lazy(() => import("./pages/TeamAdmin")); // Lazy load TeamAdmin
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const UpdatePassword = lazy(() => import("./pages/UpdatePassword"));
const Onboarding = lazy(() => import("./pages/Onboarding"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3, // Retry failed requests 3 times
      retryDelay: attemptIndex => Math.min(1000 * (2 ** attemptIndex), 30000), // Exponential backoff
    },
  },
});

const AppContent = () => {
  const isOffline = useOfflineStatus();
  const { toast } = useToast();

  useEffect(() => {
    if (isOffline) {
      toast({
        title: "You are offline!",
        description: "Please check your internet connection.",
        variant: "destructive",
        duration: Infinity, // Keep toast visible indefinitely
      });
    } else {
      toast({
        title: "You are back online!",
        description: "Connection restored.",
        duration: 3000,
      });
    }
  }, [isOffline, toast]);

  return (
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <ErrorBoundary> {/* Wrap the application with ErrorBoundary */}
        <BrowserRouter>
          <Suspense fallback={<div>Loading...</div>}>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/update-password" element={<UpdatePassword />} />
              <Route path="*" element={<NotFound />} />
              <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
              <Route element={<MainLayout />}>
                <Route path="/" element={<ProtectedRoute><Draft /></ProtectedRoute>} /> {/* Map root to Draft */}
                <Route path="/draft" element={<ProtectedRoute><Draft /></ProtectedRoute>} /> {/* Add explicit /draft route */}
                <Route path="/admin" element={<ProtectedRoute adminOnly><Admin /></ProtectedRoute>} />
                <Route path="/admin/draft" element={<ProtectedRoute adminOnly><DraftAdmin /></ProtectedRoute>} />
                <Route path="/admin/draft/settings" element={<ProtectedRoute adminOnly><DraftSettingsGeneralPage /></ProtectedRoute>} />
                <Route path="/admin/draft/order" element={<ProtectedRoute adminOnly><DraftOrderManagerPage /></ProtectedRoute>} />
                <Route path="/admin/draft/trades" element={<ProtectedRoute adminOnly><DraftPicksTraderPage /></ProtectedRoute>} />
                <Route path="/admin/draft/rollback" element={<ProtectedRoute adminOnly><DraftRollbackManagerPage /></ProtectedRoute>} />
                <Route path="/admin/draft/keepers" element={<ProtectedRoute adminOnly><KeeperManagementPage /></ProtectedRoute>} />
                <Route path="/league-analysis" element={<ProtectedRoute><LeagueAnalysis /></ProtectedRoute>} />
                <Route path="/player-pool" element={<ProtectedRoute><PlayerPoolPage /></ProtectedRoute>} />
                <Route path="/teams" element={<ProtectedRoute><Team /></ProtectedRoute>} />
                <Route path="/admin/teams" element={<ProtectedRoute adminOnly><TeamAdmin /></ProtectedRoute>} />
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </ErrorBoundary>
    </TooltipProvider>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AppContent />
  </QueryClientProvider>
);

export default App;
