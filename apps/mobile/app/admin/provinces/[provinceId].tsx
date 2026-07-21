import type { CenterDetail, ProvinceDetail } from '@acc/types';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../../../src/components/ui/Button';
import { ListRowIconButton } from '../../../src/components/ui/ListRowIconButton';
import { ScreenHeader } from '../../../src/components/ui/ScreenHeader';
import { FIELD_ORANGE } from '../../../src/components/ui/fieldStyles';
import { Text } from '../../../src/components/ui/Text';
import {
  ApiRequestError,
  deleteCenter,
  listCentersAdmin,
  listProvincesAdmin,
} from '../../../src/lib/api';
import { confirmDestructiveDeleteAlert } from '../../../src/lib/confirm-destructive-delete';

export default function ProvinceCentersScreen(): React.ReactElement {
  const router = useRouter();
  const { provinceId } = useLocalSearchParams<{ provinceId: string }>();
  const [province, setProvince] = useState<ProvinceDetail | null>(null);
  const [centers, setCenters] = useState<CenterDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!provinceId) return;
    setLoading(true);
    setError(null);
    Promise.all([listProvincesAdmin(), listCentersAdmin(provinceId)])
      .then(([provinces, centerRows]) => {
        setProvince(provinces.find((p) => p.id === provinceId) ?? null);
        setCenters(centerRows);
      })
      .catch((err) => {
        setError(err instanceof ApiRequestError ? err.message : 'Could not load centers.');
      })
      .finally(() => setLoading(false));
  }, [provinceId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  function requestDeleteCenter(center: CenterDetail): void {
    confirmDestructiveDeleteAlert({
      title: 'Delete center?',
      message: `Permanently delete "${center.name}"? This only works when it is not referenced elsewhere.`,
      onConfirm: async () => {
        try {
          await deleteCenter(center.id);
          load();
        } catch (err) {
          Alert.alert(
            'Could not delete center',
            err instanceof ApiRequestError ? err.message : 'Delete failed.',
          );
        }
      },
    });
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScreenHeader
        title={province?.name ?? 'Province'}
        subtitle="Centers"
        onBack={() => router.back()}
      />

      <ScrollView contentContainerClassName="gap-4 px-4 py-6">
        {error ? <Text className="font-sans text-sm text-primary">{error}</Text> : null}
        {loading ? (
          <ActivityIndicator color={FIELD_ORANGE} />
        ) : (
          centers.map((center) => (
            <View
              key={center.id}
              className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4"
            >
              <View className="flex-row items-center gap-2">
                <Text className="min-w-0 flex-1 font-sans-bold text-lg text-on-surface">
                  {center.name}
                </Text>
                <View className="flex-row items-center gap-1">
                  <ListRowIconButton
                    icon="pencil"
                    accessibilityLabel={`Edit ${center.name}`}
                    onPress={() => router.push(`/admin/centers/${center.id}`)}
                  />
                  <ListRowIconButton
                    icon="trash-outline"
                    accessibilityLabel={`Delete ${center.name}`}
                    onPress={() => requestDeleteCenter(center)}
                  />
                </View>
              </View>
            </View>
          ))
        )}

        <Button
          label="Add Center"
          className="h-14"
          onPress={() =>
            router.push(`/admin/centers/new?provinceId=${encodeURIComponent(provinceId ?? '')}`)
          }
        />
      </ScrollView>
    </SafeAreaView>
  );
}
