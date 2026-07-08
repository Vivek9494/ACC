import type { AdminUserDetail } from '@acc/types';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AdminUserProfileHeader } from './AdminUserProfileHeader';
import { AdminUserProfileTab } from './AdminUserProfileTab';
import { AdminUserStatsTab } from './AdminUserStatsTab';
import { ScreenHeader } from '../ui/ScreenHeader';
import { UnderlineTabBar } from '../ui/UnderlineTabBar';
import { Text } from '../ui/Text';
import { FIELD_ORANGE } from '../ui/fieldStyles';
import {
  clearRevealedTempPassword,
  getRevealedTempPassword,
  setRevealedTempPassword,
} from '../../lib/admin-temp-password-session';
import { ApiRequestError, generateAdminTemporaryPassword, getAdminUser } from '../../lib/api';

type DetailTab = 'profile' | 'stats';

const DETAIL_TABS = [
  { value: 'profile' as const, label: 'Profile' },
  { value: 'stats' as const, label: 'Stats' },
];

export interface AdminUserDetailViewProps {
  userId: string | undefined;
  /** When true, show edit + temp-password management affordances. */
  manageUsers: boolean;
  editUserHref?: (userId: string) => Href;
}

/** Shared admin user detail — full management for Admin, view-only for Club Manager. */
export function AdminUserDetailView({
  userId,
  manageUsers,
  editUserHref,
}: AdminUserDetailViewProps): React.ReactElement {
  const router = useRouter();
  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DetailTab>('profile');
  const [revealedTempPassword, setRevealedTempPasswordState] = useState<string | null>(null);
  const [regeneratingTempPassword, setRegeneratingTempPassword] = useState(false);
  const [regenerateTempPasswordError, setRegenerateTempPasswordError] = useState<string | null>(
    null,
  );
  const userRef = useRef<AdminUserDetail | null>(null);
  userRef.current = user;

  const load = useCallback(
    (withSpinner: boolean) => {
      if (!userId) {
        setError('User not found.');
        setLoading(false);
        return;
      }
      setError(null);
      if (withSpinner) {
        setLoading(true);
      }
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
    },
    [userId],
  );

  useFocusEffect(
    useCallback(() => {
      load(userRef.current === null);
      if (manageUsers && userId) {
        setRevealedTempPasswordState(getRevealedTempPassword(userId));
      }
      return () => {
        if (manageUsers && userId) {
          clearRevealedTempPassword(userId);
        }
        setRevealedTempPasswordState(null);
      };
    }, [load, manageUsers, userId]),
  );

  const onRegenerateTempPassword = useCallback(() => {
    if (!userId) {
      return;
    }
    setRegeneratingTempPassword(true);
    setRegenerateTempPasswordError(null);
    void generateAdminTemporaryPassword(userId)
      .then((result) => {
        setRevealedTempPassword(userId, result.temporaryPassword, result.expiresAt);
        setRevealedTempPasswordState(result.temporaryPassword);
        load(false);
      })
      .catch((err: unknown) => {
        setRegenerateTempPasswordError(
          err instanceof ApiRequestError
            ? err.message
            : 'Could not generate a temporary password.',
        );
      })
      .finally(() => setRegeneratingTempPassword(false));
  }, [load, userId]);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScreenHeader onBack={() => router.back()} />

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
        <ScrollView contentContainerClassName="gap-4 px-4 pb-10 pt-2">
          <AdminUserProfileHeader
            user={user}
            onEdit={
              manageUsers && editUserHref
                ? () => router.push(editUserHref(user.id))
                : undefined
            }
          />

          <UnderlineTabBar
            options={DETAIL_TABS}
            value={activeTab}
            onChange={setActiveTab}
            accessibilityLabel="User detail view"
          />

          {activeTab === 'profile' ? (
            <AdminUserProfileTab
              user={user}
              revealedTempPassword={manageUsers ? revealedTempPassword : null}
              onRegenerateTempPassword={manageUsers ? onRegenerateTempPassword : undefined}
              regeneratingTempPassword={regeneratingTempPassword}
              regenerateTempPasswordError={regenerateTempPasswordError}
            />
          ) : null}
          {activeTab === 'stats' && userId ? <AdminUserStatsTab userId={userId} /> : null}
        </ScrollView>
      ) : null}
    </SafeAreaView>
  );
}
