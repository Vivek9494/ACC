import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../../../src/components/ui/Button';
import { KeyboardAwareFormScrollView } from '../../../src/components/ui/KeyboardAwareFormScrollView';
import { ScreenHeader } from '../../../src/components/ui/ScreenHeader';
import { FIELD_ORANGE } from '../../../src/components/ui/fieldStyles';
import { Text } from '../../../src/components/ui/Text';
import { TextInput } from '../../../src/components/ui/TextInput';
import { ApiRequestError, listCentersAdmin, updateCenter } from '../../../src/lib/api';

export default function EditCenterScreen(): React.ReactElement {
  const router = useRouter();
  const { centerId } = useLocalSearchParams<{ centerId: string }>();
  const [name, setName] = useState('');
  const [provinceName, setProvinceName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!centerId) return;
    listCentersAdmin()
      .then((centers) => {
        const center = centers.find((c) => c.id === centerId);
        if (center) {
          setName(center.name);
          setProvinceName(center.provinceName);
        }
      })
      .catch((err) => {
        setError(err instanceof ApiRequestError ? err.message : 'Could not load center.');
      })
      .finally(() => setLoading(false));
  }, [centerId]);

  const canSubmit = useMemo(() => name.trim().length > 0, [name]);

  async function onSubmit(): Promise<void> {
    if (!canSubmit || !centerId) return;
    setSubmitting(true);
    setError(null);
    try {
      await updateCenter(centerId, { name: name.trim() });
      router.back();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not update center.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScreenHeader title="Edit Center" onBack={() => router.back()} />

      {loading ? (
        <ActivityIndicator className="mt-8" color={FIELD_ORANGE} />
      ) : (
        <KeyboardAwareFormScrollView contentContainerClassName="px-4 py-6">
          <View className="gap-5">
            <TextInput
              label="Province"
              value={provinceName}
              editable={false}
              selectTextOnFocus={false}
            />
            <TextInput
              label="Center Name"
              value={name}
              onChangeText={setName}
              placeholder="Center name"
              autoCapitalize="words"
            />
            {error ? <Text className="font-sans text-sm text-primary">{error}</Text> : null}
            <Button
              label={submitting ? 'Saving…' : 'Save Changes'}
              className="h-14"
              disabled={submitting || !canSubmit}
              onPress={() => void onSubmit()}
            />
          </View>
        </KeyboardAwareFormScrollView>
      )}
    </SafeAreaView>
  );
}
