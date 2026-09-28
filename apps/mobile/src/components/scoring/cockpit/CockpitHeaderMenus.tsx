import { Ionicons } from '@expo/vector-icons';
import { OVERLAY_THEME_CATALOG, type OverlayThemeKey } from '@acc/types';
import { useRef, useState } from 'react';
import { Modal, Pressable, View, type View as RNView } from 'react-native';

import { Text } from '../../ui/Text';
import { FIELD_ORANGE } from '../../ui/fieldStyles';

interface MenuItem {
  key: string;
  label: string;
  onPress: () => void;
  destructive?: boolean;
  checked?: boolean;
}

interface AnchorRect {
  x: number;
  y: number;
  height: number;
}

const TRIGGER_CLASS =
  'h-9 flex-row items-center gap-1 rounded-control px-3 active:bg-black/5 web:hover:bg-black/5';
const TRIGGER_TEXT_CLASS = 'font-sans-semibold text-sm text-secondary';

function HeaderMenu({ label, items }: { label: string; items: MenuItem[] }): React.ReactElement {
  const triggerRef = useRef<RNView>(null);
  const [anchor, setAnchor] = useState<AnchorRect | null>(null);

  function open(): void {
    triggerRef.current?.measureInWindow((x, y, _width, height) => {
      setAnchor({ x, y, height });
    });
  }

  function close(): void {
    setAnchor(null);
  }

  return (
    <>
      <View ref={triggerRef} collapsable={false}>
        <Pressable
          onPress={open}
          className={TRIGGER_CLASS}
          accessibilityRole="button"
          accessibilityLabel={`${label} menu`}
        >
          <Text className={TRIGGER_TEXT_CLASS}>{label}</Text>
          <Ionicons name="chevron-down" size={16} color={FIELD_ORANGE} />
        </Pressable>
      </View>
      <Modal visible={anchor != null} transparent animationType="fade" onRequestClose={close}>
        <View className="flex-1">
          <Pressable className="absolute inset-0" onPress={close} accessibilityLabel="Close" />
          {anchor ? (
            <View
              className="absolute min-w-[180px] overflow-hidden rounded-control border border-outline-variant bg-surface p-1"
              style={{
                top: anchor.y + anchor.height + 4,
                left: anchor.x,
                shadowColor: '#000',
                shadowOpacity: 0.12,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 4 },
                elevation: 6,
              }}
            >
              {items.map((item) => (
                <Pressable
                  key={item.key}
                  onPress={() => {
                    close();
                    item.onPress();
                  }}
                  className="flex-row items-center justify-between gap-3 rounded-control px-3 py-2.5 active:bg-primary-50 web:hover:bg-primary-50"
                  accessibilityRole="menuitem"
                >
                  <Text
                    className={`font-sans text-base ${item.destructive ? 'text-error' : 'text-text'}`}
                  >
                    {item.label}
                  </Text>
                  {item.checked ? <Ionicons name="checkmark" size={18} color={FIELD_ORANGE} /> : null}
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      </Modal>
    </>
  );
}

export interface CockpitHeaderMenusProps {
  overlayTheme: OverlayThemeKey;
  onStartOver: () => void;
  onNewMatch: () => void;
  onOpenObsSettings: () => void;
}

/** ASC Broadcast cockpit header menus: Matches ▾, Overlay ▾, OBS Setting. */
export function CockpitHeaderMenus({
  overlayTheme,
  onStartOver,
  onNewMatch,
  onOpenObsSettings,
}: CockpitHeaderMenusProps): React.ReactElement {
  return (
    <View className="flex-row items-center">
      <HeaderMenu
        label="Matches"
        items={[
          { key: 'start-over', label: 'Start Over', onPress: onStartOver, destructive: true },
          { key: 'new-match', label: 'New Match', onPress: onNewMatch },
        ]}
      />
      <HeaderMenu
        label="Overlay"
        items={OVERLAY_THEME_CATALOG.map((theme) => ({
          key: theme.key,
          label: theme.label,
          // Theming selection is not scoped yet — the item is a placeholder.
          onPress: () => undefined,
          checked: theme.key === overlayTheme,
        }))}
      />
      <Pressable
        onPress={onOpenObsSettings}
        className={TRIGGER_CLASS}
        accessibilityRole="button"
        accessibilityLabel="OBS Setting"
      >
        <Text className={TRIGGER_TEXT_CLASS}>OBS Setting</Text>
      </Pressable>
    </View>
  );
}
