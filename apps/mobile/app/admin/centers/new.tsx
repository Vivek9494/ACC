import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../../../src/components/ui/Button';
import { FIELD_ORANGE } from '../../../src/components/ui/fieldStyles';
import { Select } from '../../../src/components/ui/Select';
import { Text } from '../../../src/components/ui/Text';
import { TextInput } from '../../../src/components/ui/TextInput';
import {
  ApiRequestError,
  createCenter,
  listProvincesAdmin,
} from '../../../src/lib/api';

export default function NewCenterScreen(): React.ReactElement {
  const router = useRouter();
  const { provinceId: initialProvinceId } = useLocalSearchParams<{ provinceId?: string }>();
  const [name, setName] = useState('');
  const [provinceId, setProvinceId] = useState<string | null>(initialProvinceId ?? null);
  const [provinceOptions, setProvinceOptions] = useState<{ value: string; label: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    listProvincesAdmin()
      .then((rows) => {
        setProvinceOptions(rows.map((p) => ({ value: p.id, label: p.name })));
        setProvinceId((current) => current ?? initialProvinceId ?? rows[0]?.id ?? null);
      })
      .catch((err) => {
        setError(err instanceof ApiRequestError ? err.message : 'Could not load provinces.');
      })
      .finally(() => setLoading(false));
  }, [initialProvinceId]);

  const canSubmit = useMemo(
    () => name.trim().length > 0 && provinceId !== null,
    [name, provinceId],
  );

  async function onSubmit(): Promise<void> {
    if (!canSubmit || !provinceId) return;
    setSubmitting(true);
    setError(null);
    try {
      await createCenter({ name: name.trim(), provinceId });
      router.back();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not create center.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="flex-row items-center gap-3 border-b border-border px-4 py-3">
        <Pressable onPress={() => router.back()} className="h-10 w-10 items-center justify-center">
          <Ionicons name="arrow-back" size={24} color={FIELD_ORANGE} />
        </Pressable>
        <Text className="font-sans-bold text-xl text-text">Add Center</Text>
      </View>

      {loading ? (
        <ActivityIndicator className="mt-8" color={FIELD_ORANGE} />
      ) : (
        <ScrollView contentContainerClassName="gap-5 px-4 py-6">
          <TextInput
            label="Center Name"
            value={name}
            onChangeText={setName}
            placeholder="e.g. Brampton"
            autoCapitalize="words"
          />
          <Select
            label="Province"
            placeholder="Select province"
            value={provinceId}
            options={provinceOptions}
            onChange={setProvinceId}
          />
          {error ? <Text className="font-sans text-sm text-primary">{error}</Text> : null}
          <Button
            label={submitting ? 'Saving…' : 'Save Center'}
            className="h-14"
            disabled={submitting || !canSubmit}
            onPress={() => void onSubmit()}
          />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
