import { ADMIN_USER_ROLE_LABELS, UserRole, type AuthUser } from '@acc/types';
import { UserRound } from 'lucide-react';

import { useAuth } from '@/auth/auth-context';
import { PageHeader } from '@/components/layout/PageHeader';
import { UserAvatar } from '@/components/UserAvatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import { ChangePasswordCard } from './ChangePasswordCard';
import { SystemSettingsCard } from './SystemSettingsCard';

function AccountRow({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div className="grid gap-0.5">
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className="text-sm font-medium break-all">{value || '—'}</dd>
    </div>
  );
}

function AccountCard({ user }: { user: AuthUser }): React.ReactElement {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserRound className="size-4 text-primary" />
          Account
        </CardTitle>
        <CardDescription>Profile details are edited in the ACC mobile app.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        <div className="flex items-center gap-3">
          <UserAvatar person={user} className="size-12 text-sm" />
          <div className="min-w-0">
            <p className="truncate font-semibold">
              {user.firstName} {user.lastName}
            </p>
            <Badge variant="secondary">{ADMIN_USER_ROLE_LABELS[user.role]}</Badge>
          </div>
        </div>
        <dl className="grid gap-4 sm:grid-cols-2">
          <AccountRow label="Mobile number" value={user.mobileNumber} />
          <AccountRow label="Email" value={user.email} />
        </dl>
      </CardContent>
    </Card>
  );
}

export function SettingsPage(): React.ReactElement | null {
  const { user } = useAuth();
  if (!user) return null;
  const isAdmin = user.role === UserRole.Admin;

  return (
    <>
      <PageHeader
        title="Settings"
        description={isAdmin ? 'Your account and platform configuration.' : 'Your account.'}
      />
      <div className="grid gap-6 @container">
        <div className="grid gap-6 @4xl:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] @4xl:items-start">
          <AccountCard user={user} />
          <ChangePasswordCard />
        </div>
        {isAdmin ? <SystemSettingsCard /> : null}
      </div>
    </>
  );
}
