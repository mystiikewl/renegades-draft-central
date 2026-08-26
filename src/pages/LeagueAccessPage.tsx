import { Button } from '@/components/ui/button';
import { useAuth } from '@/auth/AuthContext';

export function LeagueAccessPage() {
  const { signOut } = useAuth();

  return (
    <main className="flex min-h-[100svh] items-center justify-center bg-background px-5 py-10">
      <div className="w-full max-w-sm space-y-5 rounded-2xl border bg-card p-6 text-center">
        <h1 className="text-xl font-bold tracking-tight">League access required</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          This account is not assigned to a Renegades Dynasty team.
        </p>
        <Button variant="outline" className="w-full" onClick={() => void signOut()}>
          Sign out
        </Button>
      </div>
    </main>
  );
}
