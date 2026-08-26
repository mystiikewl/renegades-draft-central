import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from '@/components/ui/navigation-menu';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const AppNavigation: React.FC = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isSheetOpen, setIsSheetOpen] = React.useState(false);

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: "Error",
        description: "Failed to sign out",
        variant: "destructive"
      });
    } else {
      toast({ title: "Signed out", description: "You have been signed out successfully." });
      navigate('/auth');
    }
  };

  const navLinks = [
    { title: 'Draft', href: '/draft' },
    { title: 'League Analysis', href: '/league-analysis' },
    { title: 'Teams', href: '/teams' },
  ];

  const handleNavigation = (href: string) => {
    navigate(href);
    setIsSheetOpen(false); // Close the sheet after navigation
  };

  const handleSignOut = async () => {
    setIsSheetOpen(false); // Close the sheet before signing out
    await signOut();
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between">
        <Link to="/" className="mr-6 flex items-center space-x-2">
          <span className="font-bold">Renegades Draft</span>
        </Link>

        {/* Desktop Navigation */}
        <NavigationMenu className="hidden md:flex">
          <NavigationMenuList>
            {navLinks.map((link) => (
              <NavigationMenuItem key={link.href}>
                <NavigationMenuLink asChild className={navigationMenuTriggerStyle()}>
                  <Link to={link.href}>
                    {link.title}
                  </Link>
                </NavigationMenuLink>
              </NavigationMenuItem>
            ))}
            {profile?.is_admin && (
              <>
                <NavigationMenuItem>
                  <NavigationMenuLink asChild className={navigationMenuTriggerStyle()}>
                    <Link to="/admin">
                      Admin Panel
                    </Link>
                  </NavigationMenuLink>
                </NavigationMenuItem>
                <NavigationMenuItem>
                  <NavigationMenuLink asChild className={navigationMenuTriggerStyle()}>
                    <Link to="/admin/teams">
                      Admin Team Management
                    </Link>
                  </NavigationMenuLink>
                </NavigationMenuItem>
              </>
            )}
            <NavigationMenuItem>
              <Button variant="ghost" onClick={signOut}>
                Sign Out
              </Button>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>

        {/* Mobile Navigation */}
        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
          <SheetTrigger asChild className="md:hidden">
            <Button variant="ghost" size="icon">
              <Menu className="h-6 w-6" />
              <span className="sr-only">Toggle navigation menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="right">
            <nav className="flex flex-col gap-4 py-6">
              {navLinks.map((link) => (
                <button 
                  key={link.href} 
                  onClick={() => handleNavigation(link.href)}
                  className="text-lg font-medium text-left hover:underline"
                >
                  {link.title}
                </button>
              ))}
              {profile?.is_admin && (
                <>
                  <button 
                    onClick={() => handleNavigation('/admin')}
                    className="text-lg font-medium text-left hover:underline"
                  >
                    Admin Panel
                  </button>
                  <button 
                    onClick={() => handleNavigation('/admin/teams')}
                    className="text-lg font-medium text-left hover:underline"
                  >
                    Admin Team Management
                  </button>
                </>
              )}
              <Button variant="ghost" onClick={handleSignOut} className="justify-start pl-0 text-lg font-medium">
                Sign Out
              </Button>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
};

export default AppNavigation;
