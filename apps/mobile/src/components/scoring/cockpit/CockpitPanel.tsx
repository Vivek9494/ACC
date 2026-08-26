import { View } from 'react-native';

import { Text } from '../../ui/Text';

export function CockpitPanel({
  title,
  live,
  badge,
  children,
  bodyNoPad,
  style,
}: {
  title: string;
  live?: boolean;
  badge?: string;
  children: React.ReactNode;
  bodyNoPad?: boolean;
  style?: object;
}): React.ReactElement {
  return (
    <View
      className="min-h-0 min-w-0 overflow-hidden rounded-control border border-outline-variant bg-surface"
      style={[{ flex: 1, height: '100%' }, style]}
    >
      <View className="h-7 flex-row items-center gap-2 border-b border-outline-variant bg-surface-container-low px-2.5">
        <View className={`h-1.5 w-1.5 rounded-full ${live ? 'bg-primary' : 'bg-stone-400'}`} />
        <Text className="font-sans-semibold text-[10px] uppercase tracking-wider text-on-surface-variant">
          {title}
        </Text>
        <View className="flex-1" />
        {badge ? (
          <Text className="rounded border border-secondary-200 bg-secondary-50 px-1.5 py-0.5 font-sans-bold text-[9px] uppercase tracking-wide text-secondary">
            {badge}
          </Text>
        ) : null}
      </View>
      <View className={`min-h-0 flex-1 ${bodyNoPad ? '' : 'p-2.5'}`}>{children}</View>
    </View>
  );
}

export function CockpitStubSlot({
  title,
  note,
}: {
  title: string;
  note: string;
}): React.ReactElement {
  return (
    <View className="min-h-[88px] flex-1 items-center justify-center gap-1.5 rounded-control border border-dashed border-outline-variant bg-surface-container-low px-3 py-2">
      <Text className="rounded border border-stone-400 bg-surface px-1.5 py-0.5 font-sans-bold text-[8px] uppercase tracking-wide text-on-surface-variant">
        coming soon
      </Text>
      <Text className="font-sans-bold text-[11px] uppercase tracking-wide text-on-surface-variant">
        {title}
      </Text>
      <Text className="text-center font-sans text-[10px] text-on-surface-variant">{note}</Text>
    </View>
  );
}
