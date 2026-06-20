import { Image } from 'expo-image';
import { View, type ViewStyle } from 'react-native';

const SIZES = { sm: 32, md: 64, lg: 120, xl: 200 } as const;

export type ACCLogoSize = keyof typeof SIZES | number;
export type ACCLogoVariant = 'transparent' | 'badge';

export interface ACCLogoProps {
  /** Named size or explicit pixel value. Default 'md'. */
  size?: ACCLogoSize;
  /** Transparent master (default) or the opaque navy badge. */
  variant?: ACCLogoVariant;
  style?: ViewStyle;
}

const ASSETS = {
  transparent: require('../../../assets/acc_logo_master.png'),
  badge: require('../../../assets/acc_icon_1024.png'),
} as const;

/** Atmiya Sports Club logo — transparent master or navy badge variant. */
export function ACCLogo({
  size = 'md',
  variant = 'transparent',
  style,
}: ACCLogoProps): React.ReactElement {
  const dimension = typeof size === 'number' ? size : SIZES[size];

  return (
    <View style={style}>
      <Image
        source={ASSETS[variant]}
        style={{ width: dimension, height: dimension }}
        contentFit="contain"
        transition={150}
        accessibilityLabel="Atmiya Sports Club logo"
      />
    </View>
  );
}
