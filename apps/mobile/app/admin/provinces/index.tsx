import { Ionicons } from '@expo/vector-icons';
import type { ProvinceDetail } from '@acc/types';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../../../src/components/ui/Button';
import { ConfirmDeleteModal } from '../../../src/components/ui/ConfirmDeleteModal';
import { FIELD_ORANGE } from '../../../src/components/ui/fieldStyles';
import { Text } from '../../../src/components/ui/Text';
import {
  ApiRequestError,
  deleteProvince,
  listProvincesAdmin,
  updateProvince,
} from '../../../src/lib/api';

export default function ProvincesAdminScreen(): React.ReactElement {
  const router = useRouter();
  const [provinces, setProvinces] = useState<ProvinceDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProvinceDetail | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    listProvincesAdmin()
      .then(setProvinces)
      .catch((err) => {
        setError(err instanceof ApiRequestError ? err.message : 'Could not load provinces.');
      })
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function onArchive(province: ProvinceDetail): Promise<void> {
    try {
      await updateProvince(province.id, { isActive: !province.isActive });
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
      await deleteProvince(deleteTarget.id);
      setDeleteTarget(null);
      load();
    } catch (err) {
      setDeleteError(err instanceof ApiRequestError ? err.message : 'Delete failed.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
      <View className="flex-row items-center gap-3 border-b border-[#F1F1F1] px-4 py-3">
        <Pressable
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center rounded-full active:bg-black/5"
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={24} color={FIELD_ORANGE} />
        </Pressable>
        <Text className="font-sans-bold text-xl text-[#1A1A1A]">Provinces</Text>
      </View>

      <ScrollView contentContainerClassName="gap-4 px-4 py-6">
        {error ? (
          <Text className="font-sans text-sm text-[#c1121f]">{error}</Text>
        ) : null}

        {loading ? (
          <ActivityIndicator color={FIELD_ORANGE} />
        ) : (
          provinces.map((province) => (
            <View
              key={province.id}
              className="gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-4"
            >
              <Pressable onPress={() => router.push(`/admin/provinces/${province.id}`)}>
                <Text className="font-sans-bold text-lg text-on-surface">{province.name}</Text>
                <Text className="mt-1 font-sans text-sm text-on-surface-variant">
                  {province.centerCount} center{province.centerCount === 1 ? '' : 's'} ·{' '}
                  {province.isActive ? 'Active' : 'Archived'}
                </Text>
              </Pressable>
              <View className="flex-row flex-wrap gap-2">
                <Button
                  variant="outline"
                  label="Edit"
                  className="h-10 px-4"
                  textClassName="text-sm"
                  onPress={() => router.push(`/admin/provinces/${province.id}/edit`)}
                />
                <Button
                  variant="outline"
                  label={province.isActive ? 'Archive' : 'Restore'}
                  className="h-10 px-4"
                  textClassName="text-sm"
                  onPress={() => void onArchive(province)}
                />
                <Button
                  variant="destructive"
                  label="Delete"
                  className="h-10 px-4"
                  textClassName="text-sm"
                  onPress={() => {
                    setDeleteError(null);
                    setDeleteTarget(province);
                  }}
                />
              </View>
            </View>
          ))
        )}

        <Button
          label="Add Province"
          className="h-14"
          onPress={() => router.push('/admin/provinces/new')}
        />
      </ScrollView>

      <ConfirmDeleteModal
        visible={deleteTarget !== null}
        title="Delete province?"
        message={
          deleteTarget
            ? `Permanently delete "${deleteTarget.name}"? This only works when it has no centers.`
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
