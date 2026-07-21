import type { ProvinceDetail, TournamentTypeDefinitionSummary } from '@acc/types';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../ui/Button';
import { ListRowIconButton } from '../ui/ListRowIconButton';
import { ScreenHeader } from '../ui/ScreenHeader';
import { FIELD_ORANGE } from '../ui/fieldStyles';
import { Text } from '../ui/Text';
import {
  ApiRequestError,
  deleteProvince,
  listProvincesAdmin,
  listTournamentTypeDefinitions,
} from '../../lib/api';
import { confirmDestructiveDeleteAlert } from '../../lib/confirm-destructive-delete';

export interface AdminProvincesListScreenProps {
  /** Tab root omits the stack back header; stack pushes show ScreenHeader. */
  variant?: 'tab' | 'stack';
}

/** Admin province + center directory list with edit/delete actions. */
export function AdminProvincesListScreen({
  variant = 'stack',
}: AdminProvincesListScreenProps): React.ReactElement {
  const router = useRouter();
  const [provinces, setProvinces] = useState<ProvinceDetail[]>([]);
  const [tournamentTypes, setTournamentTypes] = useState<TournamentTypeDefinitionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([listProvincesAdmin(), listTournamentTypeDefinitions()])
      .then(([provinceRows, typeRows]) => {
        setProvinces(provinceRows);
        setTournamentTypes(typeRows);
      })
      .catch((err) => {
        setError(err instanceof ApiRequestError ? err.message : 'Could not load geography.');
      })
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  function requestDeleteProvince(province: ProvinceDetail): void {
    confirmDestructiveDeleteAlert({
      title: 'Delete province?',
      message: `Permanently delete "${province.name}"? This only works when it has no centers.`,
      onConfirm: async () => {
        try {
          await deleteProvince(province.id);
          load();
        } catch (err) {
          Alert.alert(
            'Could not delete province',
            err instanceof ApiRequestError ? err.message : 'Delete failed.',
          );
        }
      },
    });
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {variant === 'stack' ? (
        <ScreenHeader title="Provinces" onBack={() => router.back()} />
      ) : (
        <View className="flex-row items-start justify-between gap-3 px-4 pt-4">
          <View className="min-w-0 flex-1">
            <Text className="font-sans-bold text-2xl text-text">Geography</Text>
            <Text className="mt-1 font-sans text-sm text-text-muted">
              Provinces, centers, and tournament types
            </Text>
          </View>
          <Button
            variant="outline"
            label="Add Tournament Type"
            className="h-10 shrink-0 px-3"
            textClassName="text-sm"
            onPress={() => router.push('/admin/tournament-types/new')}
          />
        </View>
      )}

      <ScrollView
        contentContainerClassName={`gap-4 px-4 ${variant === 'tab' ? 'pb-10 pt-4' : 'py-6'}`}
      >
        {error ? (
          <Text className="font-sans text-sm text-primary">{error}</Text>
        ) : null}

        {loading ? (
          <ActivityIndicator color={FIELD_ORANGE} />
        ) : (
          <>
            {tournamentTypes.length > 0 ? (
              <View className="gap-3">
                <Text className="font-sans-semibold text-xs uppercase tracking-wider text-primary">
                  Tournament Types
                </Text>
                {tournamentTypes.map((type) => (
                  <Pressable
                    key={type.id}
                    className="gap-1 rounded-xl border border-outline-variant bg-surface-container-lowest p-4"
                    onPress={() => router.push(`/admin/tournament-types/${type.id}`)}
                  >
                    <Text className="font-sans-bold text-lg text-on-surface">{type.name}</Text>
                    <Text className="font-sans text-sm text-on-surface-variant">
                      {type.provinceName} · {type.centerCount} center
                      {type.centerCount === 1 ? '' : 's'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            <View className="gap-3">
              <Text className="font-sans-semibold text-xs uppercase tracking-wider text-primary">
                Provinces
              </Text>
              {provinces.map((province) => (
                <View
                  key={province.id}
                  className="gap-1 rounded-xl border border-outline-variant bg-surface-container-lowest p-4"
                >
                  <View className="flex-row items-center gap-2">
                    <Pressable
                      className="min-w-0 flex-1"
                      onPress={() => router.push(`/admin/provinces/${province.id}`)}
                    >
                      <Text className="font-sans-bold text-lg text-on-surface">
                        {province.name}
                      </Text>
                    </Pressable>
                    <View className="flex-row items-center gap-1">
                      <ListRowIconButton
                        icon="pencil"
                        accessibilityLabel={`Edit ${province.name}`}
                        onPress={() => router.push(`/admin/provinces/${province.id}/edit`)}
                      />
                      <ListRowIconButton
                        icon="trash-outline"
                        accessibilityLabel={`Delete ${province.name}`}
                        onPress={() => requestDeleteProvince(province)}
                      />
                    </View>
                  </View>
                  <Pressable onPress={() => router.push(`/admin/provinces/${province.id}`)}>
                    <Text className="font-sans text-sm text-on-surface-variant">
                      {province.centerCount} center{province.centerCount === 1 ? '' : 's'}
                    </Text>
                  </Pressable>
                </View>
              ))}
            </View>
          </>
        )}

        <Button
          label="Add Province"
          className="h-14"
          onPress={() => router.push('/admin/provinces/new')}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
