import { BallType, MY_MATCHES_BALL_TYPE_LABEL, type BallType as BallTypeValue } from '@acc/types';
import { useEffect, useRef } from 'react';
import { Animated, Pressable, View } from 'react-native';

import { colors } from '@/theme/colors';

import { BallTypeIcon } from './BallTypeIcon';

/** Orange thumb = one segment; each ball sits centered in its segment. */
const THUMB_SIZE = 30;
const BALL_SIZE = 22;
const TRACK_PAD = 3;
const TRACK_BORDER = 1;
const TRACK_WIDTH = TRACK_PAD * 2 + THUMB_SIZE * 2 + TRACK_BORDER * 2;
const TRACK_HEIGHT = TRACK_PAD * 2 + THUMB_SIZE + TRACK_BORDER * 2;

export interface BallTypeSwitchProps {
  value: BallTypeValue;
  onChange: (value: BallTypeValue) => void;
  accessibilityLabel?: string;
}

/**
 * Sliding leather ↔ tennis switch — both ball images visible; orange thumb slides
 * under the active type. Shared by Dashboard / My Matches / Stats.
 */
export function BallTypeSwitch({
  value,
  onChange,
  accessibilityLabel = 'Ball type',
}: BallTypeSwitchProps): React.ReactElement {
  const isTennis = value === BallType.Tennis;
  const progress = useRef(new Animated.Value(isTennis ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(progress, {
      toValue: isTennis ? 1 : 0,
      useNativeDriver: true,
      friction: 7,
      tension: 80,
    }).start();
  }, [isTennis, progress]);

  const thumbTranslateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, THUMB_SIZE],
  });

  function toggle(): void {
    onChange(isTennis ? BallType.Leather : BallType.Tennis);
  }

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: isTennis }}
      accessibilityValue={{
        text: MY_MATCHES_BALL_TYPE_LABEL[value],
      }}
      onPress={toggle}
      hitSlop={8}
      className="active:opacity-90"
    >
      <View
        className="overflow-hidden rounded-full border border-outline-variant bg-surface"
        style={{
          width: TRACK_WIDTH,
          height: TRACK_HEIGHT,
          padding: TRACK_PAD,
          borderWidth: TRACK_BORDER,
        }}
      >
        <View style={{ width: THUMB_SIZE * 2, height: THUMB_SIZE }}>
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: THUMB_SIZE,
              height: THUMB_SIZE,
              borderRadius: THUMB_SIZE / 2,
              backgroundColor: colors.primary,
              transform: [{ translateX: thumbTranslateX }],
            }}
          />
          <View className="absolute inset-0 flex-row">
            <View
              className="items-center justify-center"
              style={{ width: THUMB_SIZE, height: THUMB_SIZE }}
            >
              <BallTypeIcon
                ballType={BallType.Leather}
                size={BALL_SIZE}
                accessibilityLabel=""
              />
            </View>
            <View
              className="items-center justify-center"
              style={{ width: THUMB_SIZE, height: THUMB_SIZE }}
            >
              <BallTypeIcon
                ballType={BallType.Tennis}
                size={BALL_SIZE}
                accessibilityLabel=""
              />
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
}
