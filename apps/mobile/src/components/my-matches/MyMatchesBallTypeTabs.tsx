import { MY_MATCHES_BALL_TYPE_LABEL, BallType, type BallType as BallTypeValue } from '@acc/types';
import { Pressable, Text, View } from 'react-native';

const TAB_ORDER: BallTypeValue[] = [BallType.Leather, BallType.Tennis];

export interface MyMatchesBallTypeTabsProps {
  ballTypes: readonly BallTypeValue[];
  selected: BallTypeValue;
  onSelect: (ballType: BallTypeValue) => void;
}

/** Leather / Tennis tabs — only rendered when the user has matches in both ball types. */
export function MyMatchesBallTypeTabs({
  ballTypes,
  selected,
  onSelect,
}: MyMatchesBallTypeTabsProps): React.ReactElement {
  const ordered = TAB_ORDER.filter((ballType) => ballTypes.includes(ballType));

  return (
    <View className="flex-row gap-2">
      {ordered.map((ballType) => {
        const active = ballType === selected;
        return (
          <Pressable
            key={ballType}
            onPress={() => onSelect(ballType)}
            className={`min-w-0 flex-1 rounded-full px-3 py-2.5 ${
              active ? 'bg-primary' : 'border border-outline-variant bg-surface'
            }`}
          >
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
              className={`text-center font-sans-semibold text-sm ${
                active ? 'text-on-primary' : 'text-on-surface'
              }`}
            >
              {MY_MATCHES_BALL_TYPE_LABEL[ballType]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
