import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Pressable, View } from 'react-native';
import { colors } from '@/theme/colors';

import { Text } from '../ui/Text';
import { INPUT_SHADOW_STYLE } from '../ui/fieldStyles';
import { RecentBallsStrip } from './RecentBallsStrip';
import {
  SCORING_KEYPAD_FOUR_BG,
  SCORING_KEYPAD_FOUR_TEXT,
  SCORING_KEYPAD_GREY_BG,
  SCORING_KEYPAD_GREY_TEXT,
  SCORING_KEYPAD_SIX_BG,
  SCORING_KEYPAD_SIX_TEXT,
  SCORING_KEYPAD_WICKET_BG,
  SCORING_KEYPAD_WICKET_TEXT,
} from './liveScoringKeypadTokens';
import type { TimelineEntry } from '@acc/types';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

const GREY_BG = SCORING_KEYPAD_GREY_BG;
const GREY_TEXT = SCORING_KEYPAD_GREY_TEXT;

interface KeySpec {
  id: string;
  label: string;
  className?: string;
  textClassName?: string;
  icon?: IoniconName;
  iconColor?: string;
  onPress?: () => void;
  spacer?: boolean;
}

export interface LiveScoringKeypadProps {
  disabled: boolean;
  compact?: boolean;
  /** Innings delivery log — drives the recent-balls strip above the keypad. */
  timeline?: TimelineEntry[];
  onRuns: (runs: number, isBoundary: boolean) => void;
  onWicket: () => void;
  onWide: () => void;
  onNoBall: () => void;
  onLegBye: () => void;
  onBye: () => void;
  onBonus: () => void;
  onUndo: () => void;
  onMore: () => void;
  onCatchDrop: () => void;
}

function Key({
  spec,
  disabled,
  compact,
}: {
  spec: KeySpec;
  disabled: boolean;
  compact: boolean;
}): React.ReactElement {
  if (spec.spacer) {
    return <View className={`${compact ? 'min-h-[48px]' : 'min-h-[72px]'} flex-1`} />;
  }

  const className = spec.className ?? GREY_BG;
  const textClassName = spec.textClassName ?? GREY_TEXT;
  const minHeight = compact ? 'min-h-[48px]' : 'min-h-[72px]';
  const padding = compact ? 'p-1.5' : 'p-3';
  const numberSize = compact ? 'text-xl' : 'text-2xl';

  return (
    <Pressable
      disabled={disabled || !spec.onPress}
      onPress={spec.onPress}
      className={`${minHeight} flex-1 items-center justify-center rounded-control ${padding} active:opacity-80 disabled:opacity-40 ${className}`}
    >
      {spec.icon ? (
        <View className="items-center gap-0.5">
          <Ionicons name={spec.icon} size={compact ? 16 : 20} color={spec.iconColor ?? colors.text} />
          <Text className={`font-sans-semibold text-[10px] ${textClassName}`}>{spec.label}</Text>
        </View>
      ) : (
        <Text className={`font-sans-bold ${numberSize} ${textClassName}`}>{spec.label}</Text>
      )}
    </Pressable>
  );
}

function KeyRow({
  keys,
  disabled,
  compact,
}: {
  keys: KeySpec[];
  disabled: boolean;
  compact: boolean;
}): React.ReactElement {
  return (
    <View className={compact ? 'flex-row gap-1.5' : 'flex-row gap-2'}>
      {keys.map((spec) => (
        <Key key={spec.id} spec={spec} disabled={disabled} compact={compact} />
      ))}
    </View>
  );
}

/** Live Scoring Assistant — 3-column grid with design-specific button colors. */
export function LiveScoringKeypad({
  disabled,
  compact = false,
  timeline = [],
  onRuns,
  onWicket,
  onWide,
  onNoBall,
  onLegBye,
  onBye,
  onBonus,
  onUndo,
  onMore,
  onCatchDrop,
}: LiveScoringKeypadProps): React.ReactElement {
  const rows: KeySpec[][] = [
    [
      { id: 'run-0', label: '0', onPress: () => onRuns(0, false) },
      { id: 'run-1', label: '1', onPress: () => onRuns(1, false) },
      { id: 'run-2', label: '2', onPress: () => onRuns(2, false) },
    ],
    [
      { id: 'run-3', label: '3', onPress: () => onRuns(3, false) },
      {
        id: 'run-4',
        label: '4',
        onPress: () => onRuns(4, true),
        className: SCORING_KEYPAD_FOUR_BG,
        textClassName: SCORING_KEYPAD_FOUR_TEXT,
      },
      {
        id: 'run-6',
        label: '6',
        onPress: () => onRuns(6, true),
        className: SCORING_KEYPAD_SIX_BG,
        textClassName: SCORING_KEYPAD_SIX_TEXT,
      },
    ],
    [
      {
        id: 'wicket',
        label: 'W',
        onPress: onWicket,
        className: SCORING_KEYPAD_WICKET_BG,
        textClassName: `font-sans-bold ${SCORING_KEYPAD_WICKET_TEXT}`,
      },
      { id: 'wide', label: 'Wd', onPress: onWide },
      { id: 'no-ball', label: 'Nb', onPress: onNoBall },
    ],
    [
      { id: 'leg-bye', label: 'Lb', onPress: onLegBye },
      { id: 'bye', label: 'B', onPress: onBye },
      {
        id: 'bonus',
        label: 'Bonus',
        onPress: onBonus,
        icon: 'add-circle-outline',
        iconColor: colors.text,
      },
    ],
    [
      {
        id: 'more',
        label: 'More',
        onPress: onMore,
        icon: 'ellipsis-horizontal',
        iconColor: colors.text,
      },
      {
        id: 'catch-drop',
        label: 'Catch-Drop',
        onPress: onCatchDrop,
        icon: 'hand-left-outline',
        iconColor: colors.text,
      },
      {
        id: 'undo',
        label: 'Undo',
        onPress: onUndo,
        icon: 'arrow-undo-outline',
        iconColor: colors.text,
      },
    ],
  ];

  return (
    <View
      className={`rounded-control border border-outline-variant bg-surface ${compact ? 'gap-2 p-2.5' : 'gap-3 p-4'}`}
      style={INPUT_SHADOW_STYLE}
    >
      <RecentBallsStrip timeline={timeline} compact={compact} />

      <View className={compact ? 'gap-1.5' : 'gap-2'}>
        {rows.map((keys) => (
          <KeyRow
            key={keys.map((spec) => spec.id).join('-')}
            keys={keys}
            disabled={disabled}
            compact={compact}
          />
        ))}
      </View>
    </View>
  );
}
