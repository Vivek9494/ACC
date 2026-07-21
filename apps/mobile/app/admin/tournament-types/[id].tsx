import {
  BallType,
  type CreateTournamentTypeDefinitionRequest,
  type TournamentTypeDefinitionDetail,
  type UpdateTournamentTypeDefinitionRequest,
} from '@acc/types';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../../../src/components/ui/Button';
import { KeyboardAwareFormScrollView } from '../../../src/components/ui/KeyboardAwareFormScrollView';
import { MultiSelect } from '../../../src/components/ui/MultiSelect';
import { ScreenHeader } from '../../../src/components/ui/ScreenHeader';
import { Select } from '../../../src/components/ui/Select';
import { Text } from '../../../src/components/ui/Text';
import { TextInput } from '../../../src/components/ui/TextInput';
import { FIELD_ORANGE } from '../../../src/components/ui/fieldStyles';
import {
  ApiRequestError,
  createTournamentTypeDefinition,
  deleteTournamentTypeDefinition,
  getTournamentTypeDefinition,
  listCentersAdmin,
  listProvincesAdmin,
  updateTournamentTypeDefinition,
} from '../../../src/lib/api';
import { confirmDestructiveDeleteAlert } from '../../../src/lib/confirm-destructive-delete';

const BALL_TYPE_OPTIONS = [
  { value: BallType.Tennis, label: 'Tennis Ball' },
  { value: BallType.Leather, label: 'Leather Ball' },
];

/** Create (`/new`) or edit an Admin tournament type definition. */
export default function TournamentTypeDefinitionFormScreen(): React.ReactElement {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEdit = Boolean(id) && id !== 'new';

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('APL');
  const [provinceId, setProvinceId] = useState<string | null>(null);
  const [ballType, setBallType] = useState<BallType>(BallType.Tennis);
  const [centerIds, setCenterIds] = useState<string[]>([]);
  const [existing, setExisting] = useState<TournamentTypeDefinitionDetail | null>(null);

  const [provinceOptions, setProvinceOptions] = useState<{ value: string; label: string }[]>([]);
  const [centerOptions, setCenterOptions] = useState<{ value: string; label: string }[]>([]);
  const [centersLoading, setCentersLoading] = useState(false);

  const loadProvinces = useCallback(async () => {
    const provinces = await listProvincesAdmin();
    setProvinceOptions(provinces.filter((p) => p.isActive).map((p) => ({ value: p.id, label: p.name })));
  }, []);

  const loadCenters = useCallback(async (nextProvinceId: string) => {
    setCentersLoading(true);
    try {
      const centers = await listCentersAdmin(nextProvinceId);
      setCenterOptions(centers.filter((c) => c.isActive).map((c) => ({ value: c.id, label: c.name })));
    } finally {
      setCentersLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProvinces().catch((err) => {
      setError(err instanceof ApiRequestError ? err.message : 'Could not load provinces.');
    });
  }, [loadProvinces]);

  useEffect(() => {
    if (!provinceId) {
      setCenterOptions([]);
      return;
    }
    void loadCenters(provinceId).catch((err) => {
      setError(err instanceof ApiRequestError ? err.message : 'Could not load centers.');
    });
  }, [loadCenters, provinceId]);

  useEffect(() => {
    if (!isEdit || !id) {
      return;
    }
    setLoading(true);
    getTournamentTypeDefinition(id)
      .then((detail) => {
        setExisting(detail);
        setName(detail.name);
        setProvinceId(detail.provinceId);
        setBallType(detail.ballType);
        setCenterIds(detail.centerIds);
      })
      .catch((err) => {
        setError(err instanceof ApiRequestError ? err.message : 'Could not load tournament type.');
      })
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  const title = useMemo(
    () => (isEdit ? 'Edit Tournament Type' : 'Add Tournament Type'),
    [isEdit],
  );

  async function onSubmit(): Promise<void> {
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    if (!provinceId) {
      setError('Province is required.');
      return;
    }
    if (centerIds.length === 0) {
      setError('Select at least one participating center.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (isEdit && id) {
        const body: UpdateTournamentTypeDefinitionRequest = {
          name: name.trim(),
          provinceId,
          ballType,
          centerIds,
        };
        await updateTournamentTypeDefinition(id, body);
      } else {
        const body: CreateTournamentTypeDefinitionRequest = {
          name: name.trim(),
          provinceId,
          ballType,
          centerIds,
        };
        await createTournamentTypeDefinition(body);
      }
      router.back();
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? err.message
          : isEdit
            ? 'Could not update tournament type.'
            : 'Could not create tournament type.',
      );
    } finally {
      setSaving(false);
    }
  }

  function requestDelete(): void {
    if (!id || !existing) {
      return;
    }
    confirmDestructiveDeleteAlert({
      title: 'Delete tournament type?',
      message: `Remove "${existing.name}"? Existing tournaments keep their linked centers.`,
      onConfirm: async () => {
        try {
          await deleteTournamentTypeDefinition(id);
          router.back();
        } catch (err) {
          Alert.alert(
            'Could not delete',
            err instanceof ApiRequestError ? err.message : 'Delete failed.',
          );
        }
      },
    });
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color={FIELD_ORANGE} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScreenHeader title={title} onBack={() => router.back()} />

      <KeyboardAwareFormScrollView
        contentContainerClassName="px-4 pt-2"
        extraBottomPadding={32}
        footer={
          <SafeAreaView
            edges={['bottom']}
            className="border-t border-outline-variant/20 bg-background px-4 pt-3"
          >
            {error ? (
              <Text className="mb-3 font-sans text-sm text-primary">{error}</Text>
            ) : null}
            <Button
              label={saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Save Tournament Type'}
              className="h-14"
              disabled={saving}
              onPress={() => void onSubmit()}
            />
            {isEdit ? (
              <View className="mt-3">
                <Button
                  variant="destructive"
                  label="Delete Tournament Type"
                  className="h-14"
                  onPress={requestDelete}
                />
              </View>
            ) : null}
          </SafeAreaView>
        }
      >
        <View className="gap-5">
          <TextInput
            label="Name"
            value={name}
            onChangeText={setName}
            placeholder="e.g. APL"
            autoCapitalize="characters"
            containerClassName="gap-1"
          />

          <Select
            label="Province"
            placeholder="Select province"
            value={provinceId}
            options={provinceOptions}
            onChange={(value) => {
              setProvinceId(value);
              setCenterIds([]);
            }}
            containerClassName="gap-1"
          />

          <Select
            label="Ball Type"
            placeholder="Select ball type"
            value={ballType}
            options={BALL_TYPE_OPTIONS}
            onChange={(value) => setBallType(value as BallType)}
            containerClassName="gap-1"
          />

          <MultiSelect
            label="Participating Centers"
            placeholder="Select centers"
            values={centerIds}
            options={centerOptions}
            onChange={setCenterIds}
            disabled={!provinceId}
            loading={Boolean(provinceId) && centersLoading}
            emptyMessage="No centers in this province."
            containerClassName="gap-1"
          />
        </View>
      </KeyboardAwareFormScrollView>
    </SafeAreaView>
  );
}
