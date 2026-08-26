import { Text } from '../../ui/Text';
import { View } from 'react-native';

/** Native stub — cockpit is web-only; overlay embed is an iframe. */
export function OverlayIFrame({ src: _src }: { src: string }): React.ReactElement {
  return (
    <View className="flex-1 items-center justify-center px-3">
      <Text className="text-center font-sans text-[11px] text-text-inverse">
        Overlay embed is desktop web only.
      </Text>
    </View>
  );
}
