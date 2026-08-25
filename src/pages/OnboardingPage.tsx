import { useTeams } from '@/api/queries';
import { useClaimTeam } from '@/api/mutations';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function OnboardingPage() {
  const { profile } = useAuth();
  const { data: teams, isLoading } = useTeams();
  const claimTeam = useClaimTeam();

  const unclaimed = (teams ?? []).filter((t) => t.owner_profile_id === null);

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 md:space-y-6 md:p-6">
      <div>
        <h1 className="text-2xl font-bold leading-tight">Welcome{profile?.display_name ? `, ${profile.display_name}` : ''}!</h1>
        <p className="mt-2 text-sm text-muted-foreground">Claim your team to continue.</p>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Available teams</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full sm:h-12" />
              ))}
            </div>
          ) : unclaimed.length === 0 ? (
            <p className="py-8 text-center text-sm leading-relaxed text-muted-foreground">
              No unclaimed teams left. Ask an admin if you should be assigned one.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {unclaimed.map((team) => (
                <div
                  key={team.id}
                  className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                >
                  <span className="line-clamp-2 min-w-0 font-medium leading-tight">{team.name}</span>
                  <Button
                    size="sm"
                    className="w-full shrink-0 transition-transform active:scale-[0.98] sm:w-auto"
                    disabled={claimTeam.isPending}
                    onClick={() => claimTeam.mutate(team.id)}
                  >
                    {claimTeam.isPending ? 'Claiming…' : 'Claim team'}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
