import { BallType, MY_MATCHES_BALL_TYPE_LABEL, type BallType as BallTypeValue } from '@acc/types';
import { useEffect, useRef } from 'react';
import { Animated, Pressable, View } from 'react-native';

import { colors } from '@/theme/colors';

import { BallTypeIcon } from './BallTypeIcon';

const TRACK_WIDTH = 76;
const TRACK_HEIGHT = 36;
const THUMB_SIZE = 32;
const BALL_SIZE = 22;
const TRACK_PAD = 2;

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

  const thumbTravel = TRACK_WIDTH - THUMB_SIZE - TRACK_PAD * 2;
  const thumbTranslateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [TRACK_PAD, TRACK_PAD + thumbTravel],
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
        className="flex-row items-center justify-between overflow-hidden rounded-full border border-outline-variant bg-surface"
        style={{ width: TRACK_WIDTH, height: TRACK_HEIGHT, paddingHorizontal: TRACK_PAD }}
      >
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: TRACK_PAD,
            width: THUMB_SIZE,
            height: THUMB_SIZE,
            borderRadius: THUMB_SIZE / 2,
            backgroundColor: colors.primary,
            transform: [{ translateX: thumbTranslateX }],
          }}
        />
        <View className="z-10 flex-1 items-center justify-center">
          <BallTypeIcon
            ballType={BallType.Leather}
            size={BALL_SIZE}
            accessibilityLabel=""
          />
        </View>
        <View className="z-10 flex-1 items-center justify-center">
          <BallTypeIcon
            ballType={BallType.Tennis}
            size={BALL_SIZE}
            accessibilityLabel=""
          />
        </View>
      </View>
    </Pressable>
  );
}
