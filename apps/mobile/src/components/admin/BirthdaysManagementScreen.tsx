import {
  formatBirthdayDisplay,
  groupBirthdaysByMonthFromPresent,
  type BirthdayUserSummary,
} from '@acc/types';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PlayerAvatar } from '../tournament/PlayerAvatar';
import { ScreenHeader } from '../ui/ScreenHeader';
import { Text } from '../ui/Text';
import { FIELD_ORANGE } from '../ui/fieldStyles';
import { ApiRequestError, getBirthdayDirectory } from '../../lib/api';

export interface BirthdaysManagementScreenProps {
  /** When set, rows navigate to user detail (Admin / Club Manager). */
  userDetailHref?: (userId: string) => Href;
}

function BirthdayUserRow({
  person,
  userDetailHref,
  onNavigate,
}: {
  person: BirthdayUserSummary;
  userDetailHref?: (userId: string) => Href;
  onNavigate: (href: Href) => void;
}): React.ReactElement {
  const content = (
    <>
      <PlayerAvatar
        firstName={person.firstName}
        profilePhotoUrl={person.profilePhotoUrl}
        size="sm"
      />
      <View className="min-w-0 flex-1 gap-0.5">
        <Text className="font-sans-semibold text-base text-on-surface">
          {person.firstName} {person.lastName}
        </Text>
        <Text className="font-sans text-sm text-on-surface-variant">
          {formatBirthdayDisplay(person.dateOfBirth)}
        </Text>
      </View>
    </>
  );

  if (userDetailHref) {
    return (
      <Pressable
        onPress={() => onNavigate(userDetailHref(person.id))}
        className="flex-row items-center gap-3 rounded-control border border-outline-variant bg-surface px-4 py-3 active:opacity-90"
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View className="flex-row items-center gap-3 rounded-control border border-outline-variant bg-surface px-4 py-3">
      {content}
    </View>
  );
}

/** Birthday directory — all users grouped by month from the present month. */
export function BirthdaysManagementScreen({
  userDetailHref,
}: BirthdaysManagementScreenProps): React.ReactElement {
  const router = useRouter();
  const [items, setItems] = useState<BirthdayUserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const sections = useMemo(() => groupBirthdaysByMonthFromPresent(items), [items]);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getBirthdayDirectory()
      .then(setItems)
      .catch((err: unknown) => {
        setItems([]);
        setError(err instanceof ApiRequestError ? err.message : 'Could not load birthdays.');
      })
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScreenHeader title="Birthdays" onBack={() => router.back()} />
      <ScrollView contentContainerClassName="gap-6 px-4 pb-8 pt-2">
        {loading ? (
          <ActivityIndicator color={FIELD_ORANGE} className="py-12" />
        ) : error ? (
          <View className="rounded-xl bg-primary-50 px-4 py-3">
            <Text className="font-sans text-sm text-primary">{error}</Text>
          </View>
        ) : sections.length === 0 ? (
          <Text className="font-sans text-sm text-on-surface-variant">
            No upcoming birthdays this year.
          </Text>
        ) : (
          sections.map((section) => (
            <View key={section.month} className="gap-3">
              <Text className="font-sans-semibold text-sm uppercase tracking-wider text-on-surface-variant">
                {section.label}
              </Text>
              {section.users.map((person) => (
                <BirthdayUserRow
                  key={person.id}
                  person={person}
                  userDetailHref={userDetailHref}
                  onNavigate={(href) => router.push(href)}
                />
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
