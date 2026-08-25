import { useTeams } from '@/api/queries';
import { useClaimTeam } from '@/api/mutations';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Team claim onboarding — shown to any logged-in profile without a team.
 * Unclaimed teams are those with owner_profile_id IS NULL; claiming goes
 * through the claim_team RPC (server checks availability atomically).
 */
export function OnboardingPage() {
  const { profile } = useAuth();
  const { data: teams, isLoading } = useTeams();
  const claimTeam = useClaimTeam();

  const unclaimed = (teams ?? []).filter((t) => t.owner_profile_id === null);

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold">Welcome{profile?.display_name ? `, ${profile.display_name}` : ''}!</h1>
        <p className="mt-1 text-muted-foreground">
          Claim your team to join the league. Once claimed, you'll get access to the
          draft board and your roster.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Available teams</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : unclaimed.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No unclaimed teams left. Ask an admin if you should be assigned one.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {unclaimed.map((team) => (
                <div
                  key={team.id}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <span className="font-medium">{team.name}</span>
                  <Button
                    size="sm"
                    disabled={claimTeam.isPending}
                    onClick={() => claimTeam.mutate(team.id)}
                  >
                    Claim
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
