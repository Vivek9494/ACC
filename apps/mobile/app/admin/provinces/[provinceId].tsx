import { Ionicons } from '@expo/vector-icons';
import type { CenterDetail, ProvinceDetail } from '@acc/types';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../../../src/components/ui/Button';
import { ConfirmDeleteModal } from '../../../src/components/ui/ConfirmDeleteModal';
import { FIELD_ORANGE } from '../../../src/components/ui/fieldStyles';
import { Text } from '../../../src/components/ui/Text';
import {
  ApiRequestError,
  deleteCenter,
  listCentersAdmin,
  listProvincesAdmin,
  updateCenter,
} from '../../../src/lib/api';

export default function ProvinceCentersScreen(): React.ReactElement {
  const router = useRouter();
  const { provinceId } = useLocalSearchParams<{ provinceId: string }>();
  const [province, setProvince] = useState<ProvinceDetail | null>(null);
  const [centers, setCenters] = useState<CenterDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CenterDetail | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  async function onArchive(center: CenterDetail): Promise<void> {
    try {
      await updateCenter(center.id, { isActive: !center.isActive });
      load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Update failed.');
    }
  }

  async function onConfirmDelete(): Promise<void> {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteCenter(deleteTarget.id);
      setDeleteTarget(null);
      load();
    } catch (err) {
      setDeleteError(err instanceof ApiRequestError ? err.message : 'Delete failed.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="flex-row items-center gap-3 border-b border-border px-4 py-3">
        <Pressable
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center rounded-full active:bg-black/5"
        >
          <Ionicons name="arrow-back" size={24} color={FIELD_ORANGE} />
        </Pressable>
        <View className="flex-1">
          <Text className="font-sans-bold text-xl text-text">
            {province?.name ?? 'Province'}
          </Text>
          <Text className="font-sans text-sm text-on-surface-variant">Centers</Text>
        </View>
        <Button
          variant="outline"
          label="Edit"
          className="h-10 px-3"
          textClassName="text-sm"
          onPress={() => router.push(`/admin/provinces/${provinceId}/edit`)}
        />
      </View>

      <ScrollView contentContainerClassName="gap-4 px-4 py-6">
        {error ? <Text className="font-sans text-sm text-primary">{error}</Text> : null}
        {loading ? (
          <ActivityIndicator color={FIELD_ORANGE} />
        ) : (
          centers.map((center) => (
            <View
              key={center.id}
              className="gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-4"
            >
              <Text className="font-sans-bold text-lg text-on-surface">{center.name}</Text>
              <Text className="font-sans text-sm text-on-surface-variant">
                {center.isActive ? 'Active' : 'Archived'}
              </Text>
              <View className="flex-row flex-wrap gap-2">
                <Button
                  variant="outline"
                  label="Edit"
                  className="h-10 px-4"
                  textClassName="text-sm"
                  onPress={() => router.push(`/admin/centers/${center.id}`)}
                />
                <Button
                  variant="outline"
                  label={center.isActive ? 'Archive' : 'Restore'}
                  className="h-10 px-4"
                  textClassName="text-sm"
                  onPress={() => void onArchive(center)}
                />
                <Button
                  variant="destructive"
                  label="Delete"
                  className="h-10 px-4"
                  textClassName="text-sm"
                  onPress={() => {
                    setDeleteError(null);
                    setDeleteTarget(center);
                  }}
                />
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

      <ConfirmDeleteModal
        visible={deleteTarget !== null}
        title="Delete center?"
        message={
          deleteTarget
            ? `Permanently delete "${deleteTarget.name}"? If it is still referenced, archive instead.`
            : ''
        }
        errorMessage={deleteError}
        loading={deleting}
        onCancel={() => {
          setDeleteTarget(null);
          setDeleteError(null);
        }}
        onConfirm={() => void onConfirmDelete()}
      />
    </SafeAreaView>
  );
}
