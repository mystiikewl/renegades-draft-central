import React from 'react';
import { Outlet } from 'react-router-dom';
import AppNavigation from '@/components/AppNavigation'; // Import the new AppNavigation component

interface MainLayoutProps {
  children?: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  return (
    <div className="relative min-h-screen bg-background font-poppins">
      <AppNavigation /> {/* Render the new navigation component here */}
      <Outlet /> {/* Render nested routes here */}
      {children}
    </div>
  );
};

export default MainLayout;
