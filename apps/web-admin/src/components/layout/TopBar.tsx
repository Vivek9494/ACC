import { ADMIN_USER_ROLE_LABELS } from '@acc/types';
import { ChevronDown, LogOut, Settings } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router';

import { navItemForPath } from '@/app/nav';
import { useAuth } from '@/auth/auth-context';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

function initials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || '?';
}

export function TopBar(): React.ReactElement {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const section = navItemForPath(pathname);

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-card/95 px-8 backdrop-blur">
      <div className="text-sm text-muted-foreground">
        <span className="font-medium">Admin</span>
        {section ? (
          <>
            <span className="mx-2 text-border">/</span>
            <span className="font-semibold text-foreground">{section.label}</span>
          </>
        ) : null}
      </div>

      {user ? (
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-3 rounded-md px-2 py-1.5 outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/30">
            <span className="flex size-8 items-center justify-center rounded-full bg-secondary text-xs font-bold text-secondary-foreground">
              {initials(user.firstName, user.lastName)}
            </span>
            <span className="text-left leading-tight">
              <span className="block text-sm font-semibold">
                {user.firstName} {user.lastName}
              </span>
              <span className="block text-xs text-muted-foreground">
                {ADMIN_USER_ROLE_LABELS[user.role]}
              </span>
            </span>
            <ChevronDown className="size-4 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <span className="block text-sm font-semibold">
                {user.firstName} {user.lastName}
              </span>
              <span className="block text-xs text-muted-foreground">{user.mobileNumber}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => void navigate('/settings')}>
              <Settings />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => void logout()}>
              <LogOut />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </header>
  );
}
