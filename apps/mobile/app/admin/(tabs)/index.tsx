import { Ionicons } from '@expo/vector-icons';
import type { AdminOverview, TournamentSummary } from '@acc/types';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '../../../src/components/ui/Card';
import { StatTile } from '../../../src/components/ui/StatTile';
import { Text } from '../../../src/components/ui/Text';
import { TournamentDashboardCard } from '../../../src/components/ui/TournamentDashboardCard';
import { FIELD_ORANGE } from '../../../src/components/ui/fieldStyles';
import { ApiRequestError, getAdminOverview, listTournaments } from '../../../src/lib/api';
import { useAuth } from '../../../src/lib/auth-context';

function OverviewMetric({
  label,
  value,
}: {
  label: string;
  value: number;
}): React.ReactElement {
  return (
    <View className="flex-1 gap-1">
      <Text className="font-sans-medium text-[11px] uppercase tracking-wider text-on-surface-variant">
        {label}
      </Text>
      <Text className="font-sans-bold text-2xl text-on-surface">{value}</Text>
    </View>
  );
}

export default function AdminDashboardScreen(): React.ReactElement {
  const router = useRouter();
  const { user } = useAuth();
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [tournaments, setTournaments] = useState<TournamentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([getAdminOverview(), listTournaments()])
      .then(([stats, tourList]) => {
        if (cancelled) return;
        setOverview(stats);
        setTournaments(tourList);
      })
      .catch((err: unknown) => {
        console.error('Failed to load admin dashboard', err);
        if (!cancelled) {
          setError(
            err instanceof ApiRequestError
              ? err.message
              : 'Could not load dashboard. Check your connection.',
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return load();
  }, [load]);

  const glanceItems: {
    label: string;
    value: number;
    highlight?: boolean;
  }[] = overview
    ? [
        { label: 'Tournaments', value: overview.tournamentCount },
        { label: 'Matches Today', value: overview.matchesTodayCount, highlight: true },
        { label: 'Pending Approvals', value: overview.pendingApprovalsCount },
      ]
    : [];

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
      <ScrollView contentContainerClassName="gap-6 px-4 pb-8 pt-4" showsVerticalScrollIndicator={false}>
        <View className="flex-row items-center justify-between">
          <View className="flex-1 gap-1">
            <Text className="font-sans text-base text-on-surface-variant">Jay Swaminarayan,</Text>
            <Text className="font-sans-bold text-2xl text-primary">
              {user?.firstName ?? 'Admin'}
            </Text>
          </View>
          <View className="flex-row items-center gap-3">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Notifications"
              className="h-10 w-10 items-center justify-center rounded-full bg-white"
              style={{
                shadowColor: '#000',
                shadowOpacity: 0.06,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 3 },
                elevation: 2,
              }}
            >
              <Ionicons name="notifications-outline" size={22} color={FIELD_ORANGE} />
            </Pressable>
            {user?.profilePhotoUrl ? (
              <Image source={{ uri: user.profilePhotoUrl }} className="h-11 w-11 rounded-full" />
            ) : (
              <View className="h-11 w-11 items-center justify-center rounded-full bg-surface-container-high">
                <Text className="font-sans-bold text-lg text-primary">
                  {(user?.firstName ?? 'A').slice(0, 1).toUpperCase()}
                </Text>
              </View>
            )}
          </View>
        </View>

        {loading ? (
          <View className="items-center py-16">
            <ActivityIndicator color={FIELD_ORANGE} />
          </View>
        ) : error ? (
          <View className="rounded-xl bg-error-container px-4 py-3">
            <Text className="font-sans text-sm text-on-error-container">{error}</Text>
            <Pressable onPress={load} className="mt-2">
              <Text className="font-sans-semibold text-sm text-primary">Retry</Text>
            </Pressable>
          </View>
        ) : overview ? (
          <>
            <Card accent>
              <Text className="mb-4 font-sans-bold text-lg text-on-surface">System Overview</Text>
              <View className="gap-4">
                <View className="flex-row gap-4">
                  <OverviewMetric label="Provinces" value={overview.provinceCount} />
                  <OverviewMetric label="Centers" value={overview.centerCount} />
                </View>
                <View className="flex-row gap-4">
                  <OverviewMetric label="Active Tournaments" value={overview.activeTournamentCount} />
                  <OverviewMetric label="Total Users" value={overview.totalUserCount} />
                </View>
              </View>
            </Card>

            {glanceItems.length > 0 ? <StatTile title="At a Glance" items={glanceItems} /> : null}

            <View className="gap-3">
              <Text className="font-sans-bold text-xl text-on-surface">Management</Text>
              <Card
                accent
                onPress={() => router.push('/admin/provinces')}
                className="gap-2"
              >
                <Text className="font-sans-bold text-lg text-on-surface">Provinces & Centers</Text>
                <Text className="font-sans text-sm text-on-surface-variant">
                  {overview.provinceCount} provinces · {overview.centerCount} centers
                </Text>
              </Card>
              <Card onPress={() => router.push('/admin/users')} className="gap-1">
                <Text className="font-sans-bold text-lg text-on-surface">Users</Text>
                <Text className="font-sans text-sm text-on-surface-variant">
                  {overview.totalUserCount} registered users
                </Text>
              </Card>
              <Card onPress={() => router.push('/admin/tournaments')} className="gap-1">
                <Text className="font-sans-bold text-lg text-on-surface">Tournaments</Text>
                <Text className="font-sans text-sm text-on-surface-variant">
                  {overview.tournamentCount} total · {overview.activeTournamentCount} active
                </Text>
              </Card>
            </View>

            <View className="gap-3">
              <View className="flex-row items-center justify-between">
                <Text className="font-sans-bold text-xl text-on-surface">Tournaments</Text>
                <Pressable
                  onPress={() => router.push('/tournaments/new')}
                  accessibilityRole="button"
                  accessibilityLabel="Add tournament"
                  className="h-10 w-10 items-center justify-center rounded-full bg-primary"
                >
                  <Ionicons name="add" size={24} color="#ffffff" />
                </Pressable>
              </View>
              {tournaments.length === 0 ? (
                <Text className="font-sans text-sm text-on-surface-variant">No tournaments yet.</Text>
              ) : (
                tournaments.map((tournament) => (
                  <TournamentDashboardCard
                    key={tournament.id}
                    tournament={tournament}
                    onPress={() => router.push(`/tournaments/${tournament.id}`)}
                  />
                ))
              )}
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
