import { useCallback, useState } from 'react';
import {
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  View,
} from 'react-native';

import type { DashboardFeaturedMatchEntry } from '../../lib/dashboard-featured-match';
import { MatchSummaryCard } from '../ui/MatchSummaryCard';

export interface DashboardFeaturedMatchCarouselProps {
  entries: DashboardFeaturedMatchEntry[];
  onPress: (matchId: string) => void;
}

/** Horizontal pager for three or more featured matches on the same venue-local day. */
export function DashboardFeaturedMatchCarousel({
  entries,
  onPress,
}: DashboardFeaturedMatchCarouselProps): React.ReactElement {
  const [pageWidth, setPageWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);

  const updateActiveIndex = useCallback(
    (offsetX: number) => {
      if (pageWidth <= 0) {
        return;
      }
      const nextIndex = Math.round(offsetX / pageWidth);
      const clampedIndex = Math.max(0, Math.min(nextIndex, entries.length - 1));
      setActiveIndex(clampedIndex);
    },
    [entries.length, pageWidth],
  );

  const onMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      updateActiveIndex(event.nativeEvent.contentOffset.x);
    },
    [updateActiveIndex],
  );

  return (
    <View
      onLayout={(event) => {
        const width = event.nativeEvent.layout.width;
        if (width > 0 && width !== pageWidth) {
          setPageWidth(width);
        }
      }}
    >
      <FlatList
        data={entries}
        horizontal
        pagingEnabled
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(entry) => entry.matchId}
        scrollEnabled={pageWidth > 0}
        onMomentumScrollEnd={onMomentumScrollEnd}
        getItemLayout={
          pageWidth > 0
            ? (_, index) => ({
                length: pageWidth,
                offset: pageWidth * index,
                index,
              })
            : undefined
        }
        renderItem={({ item }) => (
          <View style={pageWidth > 0 ? { width: pageWidth } : undefined}>
            <MatchSummaryCard {...item.card} onPress={() => onPress(item.matchId)} />
          </View>
        )}
      />

      <View
        className={`mt-3 flex-row items-center justify-center ${
          entries.length >= 8 ? 'gap-1' : 'gap-2'
        }`}
      >
        {entries.map((entry, index) => (
          <View
            key={entry.matchId}
            accessibilityLabel={`Match ${index + 1} of ${entries.length}`}
            className={`rounded-full ${
              entries.length >= 8 ? 'h-1.5 w-1.5' : 'h-2 w-2'
            } ${index === activeIndex ? 'bg-primary' : 'bg-outline-variant'}`}
          />
        ))}
      </View>
    </View>
  );
}
