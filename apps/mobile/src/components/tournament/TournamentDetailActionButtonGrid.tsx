import type { ReactElement } from 'react';
import { View } from 'react-native';

export interface TournamentDetailActionButtonGridProps {
  /** Visible action nodes in top-to-bottom order; paired left-to-right at render time. */
  items: ReactElement[];
}

/**
 * Lays out tournament Details-tab action buttons two per row. An odd final item spans
 * the full row width so a lone button is not left half-width with empty space.
 */
export function TournamentDetailActionButtonGrid({
  items,
}: TournamentDetailActionButtonGridProps): React.ReactElement | null {
  if (items.length === 0) {
    return null;
  }

  const rows: ReactElement[][] = [];
  for (let index = 0; index < items.length; ) {
    const remaining = items.length - index;
    if (remaining === 1) {
      rows.push([items[index] as ReactElement]);
      index += 1;
    } else {
      rows.push([items[index] as ReactElement, items[index + 1] as ReactElement]);
      index += 2;
    }
  }

  return (
    <View className="mt-4 gap-3">
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} className="flex-row items-start gap-3">
          {row.map((cell, cellIndex) => (
            <View
              key={cell.key ?? `${rowIndex}-${cellIndex}`}
              className={row.length === 1 ? 'w-full' : 'min-w-0 flex-1'}
            >
              {cell}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

/** Shared sizing for buttons inside the two-column grid (labels may wrap to two lines). */
export const DETAIL_ACTION_GRID_BUTTON_CLASS = 'min-h-14 h-auto w-full py-3 px-2';

/** Smaller centered label for narrow half-width cells. */
export const DETAIL_ACTION_GRID_LABEL_CLASS = 'text-xs leading-4 text-center';
