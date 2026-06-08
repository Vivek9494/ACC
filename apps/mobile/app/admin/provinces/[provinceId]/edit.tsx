import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../../../../src/components/ui/Button';
import { FIELD_ORANGE } from '../../../../src/components/ui/fieldStyles';
import { Text } from '../../../../src/components/ui/Text';
import { TextInput } from '../../../../src/components/ui/TextInput';
import { ApiRequestError, listProvincesAdmin, updateProvince } from '../../../../src/lib/api';

export default function EditProvinceScreen(): React.ReactElement {
  const router = useRouter();
  const { provinceId } = useLocalSearchParams<{ provinceId: string }>();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!provinceId) return;
    listProvincesAdmin()
      .then((rows) => {
        const row = rows.find((p) => p.id === provinceId);
        if (row) setName(row.name);
      })
      .catch((err) => {
        setError(err instanceof ApiRequestError ? err.message : 'Could not load province.');
      })
      .finally(() => setLoading(false));
  }, [provinceId]);

  async function onSubmit(): Promise<void> {
    const trimmed = name.trim();
    if (!trimmed || !provinceId) {
      setError('Province name is required.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await updateProvince(provinceId, { name: trimmed });
      router.back();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not update province.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
      <View className="flex-row items-center gap-3 border-b border-[#F1F1F1] px-4 py-3">
        <Pressable onPress={() => router.back()} className="h-10 w-10 items-center justify-center">
          <Ionicons name="arrow-back" size={24} color={FIELD_ORANGE} />
        </Pressable>
        <Text className="font-sans-bold text-xl text-[#1A1A1A]">Edit Province</Text>
      </View>

      {loading ? (
        <ActivityIndicator className="mt-8" color={FIELD_ORANGE} />
      ) : (
        <ScrollView contentContainerClassName="gap-5 px-4 py-6">
          <TextInput
            label="Province Name"
            value={name}
            onChangeText={setName}
            placeholder="Province name"
            autoCapitalize="words"
          />
          {error ? <Text className="font-sans text-sm text-[#c1121f]">{error}</Text> : null}
          <Button
            label={submitting ? 'Saving…' : 'Save Changes'}
            className="h-14"
            disabled={submitting}
            onPress={() => void onSubmit()}
          />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
