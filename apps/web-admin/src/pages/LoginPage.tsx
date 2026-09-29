import { Info, Loader2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router';

import { DEFAULT_ROUTE } from '@/app/nav';
import { useAuth } from '@/auth/auth-context';
import { FullPageSpinner } from '@/components/layout/FullPageSpinner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

function redirectTarget(state: unknown): string {
  if (state && typeof state === 'object' && 'from' in state && typeof state.from === 'string') {
    return state.from.startsWith('/') && state.from !== '/login' ? state.from : DEFAULT_ROUTE;
  }
  return DEFAULT_ROUTE;
}

export function LoginPage(): React.ReactElement {
  const { status, notice, noticeTone, login, clearNotice } = useAuth();
  const location = useLocation();
  const [mobileNumber, setMobileNumber] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (status === 'loading') return <FullPageSpinner label="Checking your session…" />;
  if (status === 'authenticated') return <Navigate to={redirectTarget(location.state)} replace />;

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!mobileNumber.trim() || !password) {
      setError('Enter your mobile number and password.');
      return;
    }
    setError(null);
    clearNotice();
    setSubmitting(true);
    try {
      await login({ mobileNumber: mobileNumber.trim(), password, rememberMe });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const message = error ?? notice;
  const success = error === null && notice !== null && noticeTone === 'success';

  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-secondary p-12 text-secondary-foreground lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-lg bg-primary text-base font-extrabold text-primary-foreground">
            ACC
          </div>
          <div className="leading-tight">
            <p className="font-bold">Atmiya Cricket</p>
            <p className="text-sm text-white/60">Admin Dashboard</p>
          </div>
        </div>
        <div className="max-w-md">
          <h1 className="text-4xl leading-tight font-extrabold">
            Run every tournament from <span className="text-primary">one desk.</span>
          </h1>
          <p className="mt-4 text-white/70">
            Tournaments, players, registrations and statistics for ACC, APL and Center-level
            cricket.
          </p>
        </div>
        <p className="text-xs text-white/50">
          Admin & Club Manager access only · Data hosted in Canada
        </p>
        <div className="pointer-events-none absolute -right-24 -bottom-24 size-80 rounded-full border-[36px] border-primary/20" />
      </section>

      <section className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-bold text-secondary">Sign in</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Use your ACC mobile number and password.
          </p>

          <form className="mt-8 space-y-5" onSubmit={onSubmit} noValidate>
            <div className="space-y-2">
              <Label htmlFor="mobileNumber">Mobile number</Label>
              <Input
                id="mobileNumber"
                type="tel"
                inputMode="tel"
                autoComplete="username"
                placeholder="(555) 555-0123"
                value={mobileNumber}
                onChange={(e) => setMobileNumber(e.target.value)}
                aria-invalid={error !== null && !mobileNumber.trim()}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={error !== null && !password}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              Remember me on this computer
            </label>

            {message ? (
              <p
                role={success ? 'status' : 'alert'}
                className={cn(
                  'rounded-md px-3 py-2 text-sm font-medium',
                  success ? 'bg-secondary/10 text-secondary' : 'bg-destructive/10 text-destructive',
                )}
              >
                {message}
              </p>
            ) : null}

            <Button type="submit" className="h-11 w-full" disabled={submitting}>
              {submitting ? <Loader2 className="animate-spin" /> : null}
              Sign in
            </Button>
          </form>

          <p className="mt-6 flex gap-2 rounded-md border bg-card px-3 py-2.5 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0 text-secondary" />
            One active session per account: signing in here signs you out of the ACC mobile app (and
            vice versa).
          </p>
        </div>
      </section>
    </div>
  );
}
