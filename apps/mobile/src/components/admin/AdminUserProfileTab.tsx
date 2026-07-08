import type { AdminUserDetail } from '@acc/types';
import { ADMIN_USER_ROLE_LABELS, UserRole } from '@acc/types';
import { MaterialIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { View } from 'react-native';

import { AdminUserSecuritySection } from './AdminUserSecuritySection';
import { AdminUserMobileContact } from './AdminUserMobileContact';
import { Card } from '../ui/Card';
import { Text } from '../ui/Text';
import { FIELD_ORANGE } from '../ui/fieldStyles';

type MaterialIconName = ComponentProps<typeof MaterialIcons>['name'];

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string;
}): React.ReactElement {
  return (
    <View className="gap-1">
      <Text className="font-sans-medium text-xs uppercase tracking-wider text-text-muted">
        {label}
      </Text>
      <Text className="font-sans text-base text-text">{value}</Text>
    </View>
  );
}

function ProfileSection({
  icon,
  title,
  children,
}: {
  icon: MaterialIconName;
  title: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <View className="gap-4">
      <View className="flex-row items-center gap-2">
        <MaterialIcons name={icon} size={18} color={FIELD_ORANGE} />
        <Text className="font-sans-semibold text-xs uppercase tracking-wider text-primary">
          {title}
        </Text>
      </View>
      <View className="gap-4">{children}</View>
    </View>
  );
}

function ProfileSectionCard({
  icon,
  title,
  children,
}: {
  icon: MaterialIconName;
  title: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <Card className="gap-4">
      <View className="flex-row items-center gap-2">
        <MaterialIcons name={icon} size={18} color={FIELD_ORANGE} />
        <Text className="font-sans-semibold text-xs uppercase tracking-wider text-primary">
          {title}
        </Text>
      </View>
      <View className="gap-4">{children}</View>
    </Card>
  );
}

function formatJoinDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatDateOfBirth(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return isoDate;
  }
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export interface AdminUserProfileTabProps {
  user: AdminUserDetail;
  revealedTempPassword?: string | null;
  onRegenerateTempPassword?: () => void;
  regeneratingTempPassword?: boolean;
  regenerateTempPasswordError?: string | null;
}

/** Profile tab body for admin user detail (details only — header is rendered by the parent). */
export function AdminUserProfileTab({
  user,
  revealedTempPassword = null,
  onRegenerateTempPassword,
  regeneratingTempPassword = false,
  regenerateTempPasswordError = null,
}: AdminUserProfileTabProps): React.ReactElement {
  const fullName = `${user.firstName} ${user.lastName}`.trim();
  const showScopedRoles =
    user.platformRole !== UserRole.Player && user.roleAssignments.length > 0;

  return (
    <View className="gap-4">
      <ProfileSectionCard icon="person-outline" title="Personal Information">
        <DetailRow label="Full Name" value={fullName} />
        <View className="gap-1">
          <Text className="font-sans-medium text-xs uppercase tracking-wider text-text-muted">
            Mobile
          </Text>
          <AdminUserMobileContact
            mobileNumber={user.mobileNumber}
            maskedMobileNumber={user.maskedMobileNumber}
            textClassName="font-sans text-base"
          />
        </View>
        <DetailRow label="Email" value={user.email} />
        <DetailRow label="Date of Birth" value={formatDateOfBirth(user.dateOfBirth)} />
        <DetailRow label="Province" value={user.provinceName} />
        <DetailRow label="Center" value={user.centerName} />
        <DetailRow label="Platform Role" value={ADMIN_USER_ROLE_LABELS[user.platformRole]} />
        <DetailRow label="Joined" value={formatJoinDate(user.createdAt)} />
        <DetailRow label="Status" value={user.isActive ? 'Active' : 'Inactive'} />
      </ProfileSectionCard>

      <ProfileSectionCard icon="checkroom" title="Equipment">
        <DetailRow label="Jersey Size" value={user.jerseySize ?? '–'} />
        <DetailRow label="Jersey Name" value={user.jerseyName ?? '–'} />
        <DetailRow label="Jersey Number" value={String(user.jerseyNumber)} />
      </ProfileSectionCard>

      {showScopedRoles ? (
        <ProfileSection icon="badge" title="Scoped Roles">
          {user.roleAssignments.map((assignment, index) => {
            const parts = [
              assignment.tournamentName,
              assignment.teamName,
              assignment.centerName,
            ].filter((part): part is string => Boolean(part));
            const context = parts.length > 0 ? parts.join(' · ') : 'Platform-wide';
            return (
              <View
                key={`${assignment.role}-${index}`}
                className="gap-1 border-b border-border pb-3 last:border-b-0 last:pb-0"
              >
                <Text className="font-sans-semibold text-base text-text">
                  {ADMIN_USER_ROLE_LABELS[assignment.role]}
                </Text>
                <Text className="font-sans text-sm text-text-muted">{context}</Text>
              </View>
            );
          })}
        </ProfileSection>
      ) : null}

      {onRegenerateTempPassword ? (
        <AdminUserSecuritySection
          user={user}
          revealedTempPassword={revealedTempPassword}
          onRegenerateTempPassword={onRegenerateTempPassword}
          regenerating={regeneratingTempPassword}
          regenerateError={regenerateTempPasswordError}
        />
      ) : null}
    </View>
  );
}
