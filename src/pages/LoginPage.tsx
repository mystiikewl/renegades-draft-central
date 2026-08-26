import { lazy, Suspense, useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';

const BasketballScene = lazy(() =>
  import('@/components/auth/BasketballScene').then((module) => ({ default: module.BasketballScene }))
);

export function LoginPage() {
  const navigate = useNavigate({ from: '/login' });
  const { session, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && session) navigate({ to: '/' });
  }, [loading, navigate, session]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      navigate({ to: '/' });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative min-h-[100svh] overflow-hidden bg-background">
      <Suspense fallback={<div className="absolute inset-0 bg-background" />}>
        <BasketballScene />
      </Suspense>

      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,hsl(222_47%_5%/0.18),hsl(222_47%_5%/0.38)_48%,hsl(222_47%_5%/0.78))] sm:bg-[linear-gradient(90deg,hsl(222_47%_5%/0.14),hsl(222_47%_5%/0.2)_46%,hsl(222_47%_5%/0.82)_72%)]" />

      <div className="relative z-10 flex min-h-[100svh] flex-col px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))] sm:px-8 lg:px-12">
        <h1 className="text-center text-xl font-bold tracking-tight text-foreground sm:text-left sm:text-2xl">
          Renegades Dynasty Draft
        </h1>

        <div className="flex flex-1 items-end justify-center pb-3 sm:items-center sm:justify-end sm:pb-0">
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-sm space-y-4 rounded-2xl border border-white/10 bg-[hsl(222_38%_9%/0.94)] p-5 shadow-2xl shadow-black/30 sm:p-6"
          >
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 bg-background/80"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 bg-background/80"
              />
            </div>

            <Button
              type="submit"
              className="h-11 w-full transition-transform active:scale-[0.98]"
              disabled={busy || loading}
            >
              {busy ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </div>
      </div>
    </main>
  );
}
