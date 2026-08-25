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
      <h1 className="text-2xl font-bold">Profile</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Account</CardTitle>
        </CardHeader>
        <CardContent className="divide-y text-sm">
          <div className="grid grid-cols-[5rem_1fr] gap-4 py-3 first:pt-0">
            <span className="text-muted-foreground">Name</span>
            <span className="min-w-0 break-words text-right font-medium">{profile.display_name ?? '—'}</span>
          </div>
          <div className="grid grid-cols-[5rem_1fr] gap-4 py-3">
            <span className="text-muted-foreground">Email</span>
            <span className="min-w-0 break-all text-right">{profile.email}</span>
          </div>
          <div className="grid grid-cols-[5rem_1fr] gap-4 py-3 last:pb-0">
            <span className="text-muted-foreground">Team</span>
            <span className="flex min-w-0 flex-wrap items-center justify-end gap-2 text-right font-medium">
              <span className="line-clamp-2">{team?.name ?? '—'}</span>
              {profile.is_admin && (
                <Badge className="shrink-0 text-[10px]" variant="outline">
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
