import { ADMIN_USER_ROLE_LABELS, UserRole, type AdminUserSummary } from '@acc/types';
import type { ColumnDef } from '@tanstack/react-table';
import { CircleCheck, CirclePause, Lock, LockOpen, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';

import { UserAvatar } from '@/components/UserAvatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { userDisplayName, userMobileLabel } from './user-list';

type RoleBadge = 'secondary' | 'live' | 'upcoming' | 'muted' | 'outline';

const ROLE_BADGE: Record<UserRole, RoleBadge> = {
  [UserRole.Admin]: 'secondary',
  [UserRole.ClubManager]: 'live',
  [UserRole.CenterSevak]: 'upcoming',
  [UserRole.Captain]: 'outline',
  [UserRole.ViceCaptain]: 'outline',
  [UserRole.Manager]: 'outline',
  [UserRole.Player]: 'muted',
};

export interface UserRowActions {
  onEdit: (user: AdminUserSummary) => void;
  onToggleStatus: (user: AdminUserSummary) => void;
  onDelete: (user: AdminUserSummary) => void;
  onUnlock: (user: AdminUserSummary) => void;
}

function RowActionsMenu({
  user,
  actions,
  isSelf,
}: {
  user: AdminUserSummary;
  actions: UserRowActions;
  isSelf: boolean;
}): React.ReactElement {
  return (
    // Non-modal so a dialog opened from an item doesn't inherit the menu's pointer lock.
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8" aria-label={`Actions for ${userDisplayName(user)}`}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onSelect={() => actions.onEdit(user)}>
          <Pencil />
          Edit
        </DropdownMenuItem>
        {user.isLocked ? (
          <DropdownMenuItem onSelect={() => actions.onUnlock(user)}>
            <LockOpen />
            Unlock
          </DropdownMenuItem>
        ) : null}
        {/* The api rejects status changes / deletes on your own account. */}
        <DropdownMenuItem disabled={isSelf} onSelect={() => actions.onToggleStatus(user)}>
          {user.isActive ? <CirclePause /> : <CircleCheck />}
          {user.isActive ? 'Inactive' : 'Active'}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" disabled={isSelf} onSelect={() => actions.onDelete(user)}>
          <Trash2 />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function buildUserColumns({
  actions,
  currentUserId,
}: {
  /** Omit for view-only viewers (Club Manager) — hides the actions column. */
  actions?: UserRowActions;
  currentUserId: string | undefined;
}): ColumnDef<AdminUserSummary>[] {
  const columns: ColumnDef<AdminUserSummary>[] = [
    {
      id: 'name',
      header: 'Name',
      cell: ({ row }) => {
        const user = row.original;
        return (
          <div className="flex min-w-[200px] items-center gap-3">
            <UserAvatar person={user} />
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 font-semibold text-foreground">
                <span className="truncate">{userDisplayName(user)}</span>
                {user.isLocked ? (
                  <Lock className="size-3.5 shrink-0 text-primary" aria-label="Password reset locked" />
                ) : null}
              </p>
              {user.id === currentUserId ? <p className="text-xs text-muted-foreground">You</p> : null}
            </div>
          </div>
        );
      },
    },
    {
      id: 'mobile',
      header: 'Mobile',
      cell: ({ row }) => <span className="whitespace-nowrap tabular-nums">{userMobileLabel(row.original)}</span>,
    },
    {
      id: 'role',
      header: 'Role',
      cell: ({ row }) => (
        <Badge variant={ROLE_BADGE[row.original.platformRole]}>
          {ADMIN_USER_ROLE_LABELS[row.original.platformRole]}
        </Badge>
      ),
    },
    {
      id: 'province',
      header: 'Province',
      cell: ({ row }) => row.original.provinceName,
    },
    {
      id: 'center',
      header: 'Center',
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.centerName}</span>,
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) =>
        row.original.isActive ? (
          <Badge variant="upcoming">Active</Badge>
        ) : (
          <Badge variant="destructive">Inactive</Badge>
        ),
    },
  ];

  if (actions) {
    columns.push({
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      meta: { headerClassName: 'w-12', cellClassName: 'text-right' },
      cell: ({ row }) => (
        <RowActionsMenu user={row.original} actions={actions} isSelf={row.original.id === currentUserId} />
      ),
    });
  }

  return columns;
}
