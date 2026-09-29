import { NavLink } from 'react-router';

import { navItemsFor } from '@/app/nav';
import { useAuth } from '@/auth/auth-context';
import { cn } from '@/lib/utils';

export function Sidebar(): React.ReactElement {
  const { user } = useAuth();
  const items = user ? navItemsFor(user.role) : [];
  return (
    <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-5">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-sm font-extrabold text-primary-foreground">
          ACC
        </div>
        <div className="leading-tight">
          <p className="text-sm font-bold text-white">Atmiya Cricket</p>
          <p className="text-xs text-sidebar-muted">Admin Dashboard</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4" aria-label="Main">
        {items.map(({ path, label, icon: Icon, available }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) =>
              cn(
                'group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-sidebar-accent text-white before:absolute before:inset-y-1.5 before:left-0 before:w-1 before:rounded-full before:bg-primary'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-white',
              )
            }
          >
            <Icon className="size-4.5 shrink-0" />
            <span className="flex-1">{label}</span>
            {!available ? (
              <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-sidebar-muted uppercase">
                Soon
              </span>
            ) : null}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-sidebar-border px-5 py-3 text-xs text-sidebar-muted">
        Data hosted in Canada
      </div>
    </aside>
  );
}
