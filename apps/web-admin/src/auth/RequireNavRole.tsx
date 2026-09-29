import { Navigate, Outlet } from 'react-router';

import { DEFAULT_ROUTE, canOpenNavItem, navItemForPath } from '@/app/nav';

import { useAuth } from './auth-context';

/** Keeps a role-restricted nav area (e.g. Admin-only Geography) out of reach of other dashboard roles. */
export function RequireNavRole({ path }: { path: string }): React.ReactElement {
  const { user } = useAuth();
  const item = navItemForPath(path);
  if (!user || !item || !canOpenNavItem(item, user.role)) {
    return <Navigate to={DEFAULT_ROUTE} replace />;
  }
  return <Outlet />;
}
