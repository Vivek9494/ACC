import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../../../src/components/ui/Button';
import { FIELD_ORANGE } from '../../../src/components/ui/fieldStyles';
import { Text } from '../../../src/components/ui/Text';
import { TextInput } from '../../../src/components/ui/TextInput';
import { ApiRequestError, createProvince } from '../../../src/lib/api';

const STRONG_LABEL = 'strong' as const;

export default function NewProvinceScreen(): React.ReactElement {
  const router = useRouter();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(): Promise<void> {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Province name is required.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createProvince({ name: trimmed });
      router.back();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not create province.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
      <View className="flex-row items-center gap-3 border-b border-[#F1F1F1] px-4 py-3">
        <Pressable
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center rounded-full active:bg-black/5"
        >
          <Ionicons name="arrow-back" size={24} color={FIELD_ORANGE} />
        </Pressable>
        <Text className="font-sans-bold text-xl text-[#1A1A1A]">Add Province</Text>
      </View>

      <ScrollView contentContainerClassName="gap-5 px-4 py-6">
        <TextInput
          label="Province Name"
          labelVariant={STRONG_LABEL}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Ontario"
          autoCapitalize="words"
        />
        {error ? <Text className="font-sans text-sm text-[#c1121f]">{error}</Text> : null}
        <Button
          label={submitting ? 'Saving…' : 'Save Province'}
          className="h-14"
          disabled={submitting}
          onPress={() => void onSubmit()}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
