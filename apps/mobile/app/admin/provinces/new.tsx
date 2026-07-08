import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../../../src/components/ui/Button';
import { KeyboardAwareFormScrollView } from '../../../src/components/ui/KeyboardAwareFormScrollView';
import { ScreenHeader } from '../../../src/components/ui/ScreenHeader';
import { Text } from '../../../src/components/ui/Text';
import { TextInput } from '../../../src/components/ui/TextInput';
import { ApiRequestError, createProvince } from '../../../src/lib/api';

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
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScreenHeader title="Add Province" onBack={() => router.back()} />

      <KeyboardAwareFormScrollView contentContainerClassName="gap-5 px-4 py-6">
        <TextInput
          label="Province Name"
          value={name}
          onChangeText={setName}
          placeholder="e.g. Ontario"
          autoCapitalize="words"
        />
        {error ? <Text className="font-sans text-sm text-primary">{error}</Text> : null}
        <Button
          label={submitting ? 'Saving…' : 'Save Province'}
          className="h-14"
          disabled={submitting}
          onPress={() => void onSubmit()}
        />
      </KeyboardAwareFormScrollView>
    </SafeAreaView>
  );
}
