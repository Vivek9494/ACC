import { Navigate, Outlet, useLocation } from 'react-router';

import { FullPageSpinner } from '@/components/layout/FullPageSpinner';

import { useAuth } from './auth-context';

/** Route guard: only authenticated Admin / Club Manager sessions reach the shell. */
export function RequireAdmin(): React.ReactElement {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <FullPageSpinner label="Checking your session…" />;
  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}
