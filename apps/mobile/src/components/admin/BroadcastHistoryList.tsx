import {
  BroadcastDisplayStatus,
  formatBroadcastPostedLabel,
  type BroadcastHistoryEntry,
} from '@acc/types';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, View } from 'react-native';

import { BroadcastImage } from '../dashboard/BroadcastImage';
import { Card } from '../ui/Card';
import { Text } from '../ui/Text';
import { FIELD_ORANGE } from '../ui/fieldStyles';
import { ApiRequestError, listBroadcastHistory } from '../../lib/api';

const HISTORY_CARD_CLASS = 'gap-3 rounded-control border border-outline-variant';

function BroadcastHistoryCard({ entry }: { entry: BroadcastHistoryEntry }): React.ReactElement {
  const isActive = entry.status === BroadcastDisplayStatus.Active;

  return (
    <Card className={HISTORY_CARD_CLASS}>
      <View className="flex-row items-start justify-between gap-3">
        <View className="min-w-0 flex-1 gap-1">
          <Text className="font-sans-semibold text-sm text-on-surface">{entry.postedByName}</Text>
          <Text className="font-sans text-xs text-on-surface-variant">
            {formatBroadcastPostedLabel(entry.postedAt)}
          </Text>
        </View>
        <View
          className={`rounded-full px-3 py-1 ${
            isActive ? 'bg-primary-container' : 'bg-surface-container-high'
          }`}
        >
          <Text
            className={`font-sans-semibold text-[11px] uppercase tracking-wide ${
              isActive ? 'text-primary' : 'text-on-surface-variant'
            }`}
          >
            {isActive ? 'Active' : 'Expired'}
          </Text>
        </View>
      </View>
      {entry.text ? (
        <Text className="font-sans text-sm leading-5 text-on-surface">{entry.text}</Text>
      ) : null}
      {entry.imageUrl?.trim() ? (
        <BroadcastImage
          imageUrl={entry.imageUrl}
          height={96}
          containerClassName="w-full rounded-control overflow-hidden"
        />
      ) : null}
    </Card>
  );
}

export interface BroadcastHistoryListProps {
  refreshKey?: number;
}

/** View-only broadcast history — newest first, below the post form. */
export function BroadcastHistoryList({ refreshKey = 0 }: BroadcastHistoryListProps): React.ReactElement {
  const [entries, setEntries] = useState<BroadcastHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setEntries(await listBroadcastHistory());
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not load broadcast history.');
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center py-8">
        <ActivityIndicator color={FIELD_ORANGE} />
      </View>
    );
  }

  if (error) {
    return (
      <View className="px-4 py-6">
        <Text className="font-sans text-sm text-primary">{error}</Text>
      </View>
    );
  }

  return (
    <FlatList
      className="flex-1"
      contentContainerClassName="gap-3 px-4 pb-8 pt-4"
      data={entries}
      keyExtractor={(item) => item.id}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <Text className="font-sans-bold text-xs uppercase tracking-wider text-on-surface-variant">
          Past broadcasts
        </Text>
      }
      ListEmptyComponent={
        <Text className="py-8 font-sans text-sm text-on-surface-variant">
          No broadcasts posted yet.
        </Text>
      }
      renderItem={({ item }) => <BroadcastHistoryCard entry={item} />}
    />
  );
}
