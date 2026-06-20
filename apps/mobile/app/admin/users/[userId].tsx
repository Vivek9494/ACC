import {
  ADMIN_USER_ROLE_LABELS,
  type AdminUserDetail,
} from '@acc/types';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AdminUserRoleChips } from '../../../src/components/admin/AdminUserRoleChips';
import { PlayerAvatar } from '../../../src/components/tournament/PlayerAvatar';
import { Card } from '../../../src/components/ui/Card';
import { Text } from '../../../src/components/ui/Text';
import { FIELD_ORANGE } from '../../../src/components/ui/fieldStyles';
import { ApiRequestError, getAdminUser } from '../../../src/lib/api';

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

export default function AdminUserDetailScreen(): React.ReactElement {
  const router = useRouter();
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!userId) {
      setError('User not found.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    getAdminUser(userId)
      .then(setUser)
      .catch((err) => {
        setUser(null);
        setError(
          err instanceof ApiRequestError
            ? err.message
            : 'You do not have permission to view this user.',
        );
      })
      .finally(() => setLoading(false));
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="flex-row items-center gap-3 border-b border-border px-4 py-3">
        <Pressable
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center rounded-full active:bg-black/5"
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={24} color={FIELD_ORANGE} />
        </Pressable>
        <Text className="font-sans-bold text-xl text-text">User Details</Text>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={FIELD_ORANGE} />
        </View>
      ) : null}

      {!loading && error ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center font-sans text-base text-primary">{error}</Text>
        </View>
      ) : null}

      {!loading && user ? (
        <ScrollView contentContainerClassName="gap-4 px-4 py-6">
          <Card className="items-center gap-3">
            <PlayerAvatar
              firstName={user.firstName}
              profilePhotoUrl={user.profilePhotoUrl}
              size="lg"
            />
            <Text className="text-center font-sans-bold text-xl text-text">
              {user.firstName} {user.lastName}
            </Text>
            <AdminUserRoleChips roles={user.roles} size="md" />
            {!user.isActive ? (
              <Text className="font-sans-semibold text-sm text-secondary-800">Inactive account</Text>
            ) : null}
          </Card>

          <Card className="gap-4">
            <Text className="font-sans-bold text-lg text-text">Contact</Text>
            <DetailRow label="Mobile" value={user.maskedMobileNumber} />
            <DetailRow label="Email" value={user.email} />
          </Card>

          <Card className="gap-4">
            <Text className="font-sans-bold text-lg text-text">Profile</Text>
            <DetailRow label="Center" value={user.centerName} />
            <DetailRow label="Province" value={user.provinceName} />
            <DetailRow label="Date of birth" value={user.dateOfBirth} />
            <DetailRow label="Jersey number" value={String(user.jerseyNumber)} />
            {user.jerseyName ? (
              <DetailRow label="Jersey name" value={user.jerseyName} />
            ) : null}
            <DetailRow label="Joined" value={formatJoinDate(user.createdAt)} />
            <DetailRow label="Status" value={user.isActive ? 'Active' : 'Inactive'} />
          </Card>

          {user.roleAssignments.length > 0 ? (
            <Card className="gap-3">
              <Text className="font-sans-bold text-lg text-text">Scoped roles</Text>
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
            </Card>
          ) : null}
        </ScrollView>
      ) : null}
    </SafeAreaView>
  );
}
