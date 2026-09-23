import type {
  AdminUsersByGeography,
  AdminUsersByGeographyProvince,
} from '@acc/types';
import { MaterialIcons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { getAdminUsersByGeography } from '../../lib/api';
import { logFetchError } from '../../lib/fetch-error';
import { Card } from '../ui/Card';
import { FIELD_ORANGE, INPUT_SHADOW_STYLE } from '../ui/fieldStyles';
import { Text } from '../ui/Text';

function ProvinceAccordionRow({
  province,
}: {
  province: AdminUsersByGeographyProvince;
}): React.ReactElement {
  const [expanded, setExpanded] = useState(false);

  return (
    <View
      className="rounded-control border border-outline-variant bg-surface-container-lowest"
      style={INPUT_SHADOW_STYLE}
    >
      <Pressable
        onPress={() => setExpanded((current) => !current)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={
          expanded
            ? `Collapse ${province.name}`
            : `Expand ${province.name}, ${province.userCount} users`
        }
        className="flex-row items-center justify-between gap-3 px-4 py-3 active:opacity-80"
      >
        <Text className="min-w-0 flex-1 font-sans-semibold text-base text-on-surface" numberOfLines={1}>
          {province.name}
        </Text>
        <Text className="font-sans-bold text-base text-primary">{province.userCount}</Text>
        <MaterialIcons
          name={expanded ? 'expand-less' : 'expand-more'}
          size={24}
          color={FIELD_ORANGE}
        />
      </Pressable>

      {expanded ? (
        <View className="gap-1 border-t border-outline-variant px-4 py-2">
          {province.centers.length === 0 ? (
            <Text className="py-2 font-sans text-sm text-on-surface-variant">
              No centers in this province.
            </Text>
          ) : (
            province.centers.map((center) => (
              <View
                key={center.centerId}
                className="flex-row items-center justify-between gap-3 py-2"
              >
                <Text
                  className="min-w-0 flex-1 font-sans text-sm text-on-surface"
                  numberOfLines={1}
                >
                  {center.name}
                </Text>
                <Text className="font-sans-semibold text-sm text-on-surface-variant">
                  {center.userCount}
                </Text>
              </View>
            ))
          )}
        </View>
      ) : null}
    </View>
  );
}

/** Admin dashboard: users by province → center accordion. */
export function AdminUsersByGeographyAccordion(): React.ReactElement {
  const [data, setData] = useState<AdminUsersByGeography | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getAdminUsersByGeography()
      .then((payload) => {
        if (!cancelled) setData(payload);
      })
      .catch((err: unknown) => {
        logFetchError('Failed to load users by geography', err);
        if (!cancelled) {
          setError("Couldn't load users by province.");
          setData(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => load(), [load]);

  return (
    <Card accent>
      <Text className="mb-3 font-sans-bold text-lg text-on-surface">Users by province</Text>

      {loading ? (
        <View className="items-center py-6">
          <ActivityIndicator color={FIELD_ORANGE} />
        </View>
      ) : error ? (
        <Text className="py-2 font-sans text-sm text-secondary">{error}</Text>
      ) : !data || data.provinces.length === 0 ? (
        <Text className="py-2 font-sans text-sm text-on-surface-variant">
          No provinces configured yet.
        </Text>
      ) : (
        <View className="gap-2">
          {data.provinces.map((province) => (
            <ProvinceAccordionRow key={province.provinceId} province={province} />
          ))}
        </View>
      )}
    </Card>
  );
}
