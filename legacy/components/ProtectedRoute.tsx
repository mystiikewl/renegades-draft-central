import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';

interface ProtectedRouteProps {
  children: React.ReactNode;
  adminOnly?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, adminOnly = false }) => {
  const { user, profile, isLoading, onboardingComplete } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !user) {
      navigate('/auth');
    }
    
    // If user has completed onboarding and has a team, but is on the onboarding page, redirect to draft
    const currentPath = window.location.pathname;
    if (!isLoading && user && onboardingComplete && profile?.team && currentPath === '/onboarding') {
      navigate('/');
    }
  }, [isLoading, user, onboardingComplete, profile, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Skeleton className="h-12 w-1/2 mb-6" />
      </div>
    );
  }

  if (!user) {
    return null; // Redirect handled by useEffect
  }

  if (adminOnly && !profile?.is_admin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">Access Denied</h1>
          <p>You do not have administrative privileges to access this page.</p>
          <button onClick={() => navigate('/')} className="text-blue-500 hover:underline">
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
