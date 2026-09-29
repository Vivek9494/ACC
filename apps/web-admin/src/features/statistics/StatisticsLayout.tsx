import { Loader2 } from 'lucide-react';
import { Suspense } from 'react';
import { Navigate, NavLink, Outlet, useLocation } from 'react-router';

import { useAuth } from '@/auth/auth-context';
import { PageHeader } from '@/components/layout/PageHeader';
import { cn } from '@/lib/utils';

import { statisticsSectionsFor } from './statistics-sections';

function SectionFallback(): React.ReactElement {
  return (
    <div className="flex items-center justify-center gap-3 py-24 text-muted-foreground">
      <Loader2 className="size-5 animate-spin text-primary" />
      <span className="text-sm font-medium">Loading…</span>
    </div>
  );
}

/** /statistics shell: section tabs (filtered by role) above a lazily loaded section. */
export function StatisticsLayout(): React.ReactElement {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const sections = user ? statisticsSectionsFor(user.role) : [];
  const current = sections.find((s) => pathname === `/statistics/${s.path}` || pathname.startsWith(`/statistics/${s.path}/`));

  // Bare /statistics, or a section this role can't open (e.g. Club Manager on /statistics/otp).
  if (!current && sections[0]) {
    return <Navigate to={`/statistics/${sections[0].path}`} replace />;
  }

  return (
    <div>
      <PageHeader title="Statistics" description="Platform analytics and tournament leaderboards." />
      <nav className="mb-6 flex gap-1 border-b" aria-label="Statistics sections">
        {sections.map((section) => (
          <NavLink
            key={section.path}
            to={section.path}
            className={({ isActive }) =>
              cn(
                '-mb-px inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors',
                isActive
                  ? 'border-primary text-secondary'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )
            }
          >
            <section.icon className="size-4" />
            {section.label}
          </NavLink>
        ))}
      </nav>
      <Suspense fallback={<SectionFallback />}>
        <Outlet />
      </Suspense>
    </div>
  );
}
