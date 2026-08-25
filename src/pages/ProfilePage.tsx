import { useAuth } from '@/auth/AuthContext';
import { useTeams } from '@/api/queries';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LogOut } from 'lucide-react';

/** Profile / account settings — the only home of the Sign out action. */
export function ProfilePage() {
  const { profile, signOut } = useAuth();
  const { data: teams } = useTeams();
  const team = teams?.find((t) => t.id === profile?.team_id);

  if (!profile) return null;

  return (
    <div className="mx-auto max-w-xl space-y-4 p-4 pb-[max(5rem,env(safe-area-inset-bottom))] md:p-6">
      <div>
        <h1 className="text-2xl font-bold">Profile</h1>
        <p className="text-sm text-muted-foreground">Account and league settings.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Name</span>
            <span className="truncate font-medium">{profile.display_name ?? '—'}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Email</span>
            <span className="truncate">{profile.email}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Team</span>
            <span className="flex items-center gap-2 font-medium">
              {team?.name ?? '—'}
              {profile.is_admin && (
                <Badge className="text-[10px]" variant="outline">
                  admin
                </Badge>
              )}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-4">
          <Button
            variant="outline"
            className="w-full text-destructive transition-transform active:scale-[0.98] sm:w-auto"
            onClick={() => signOut()}
          >
            <LogOut className="size-4" />
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
