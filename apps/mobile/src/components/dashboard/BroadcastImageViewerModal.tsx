import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/theme/colors';

import { resolveMediaDisplayUrl } from '../../lib/media-url';

const CLOSE_HIT_SIZE = 44;

export interface BroadcastImageViewerModalProps {
  visible: boolean;
  imageUrl: string;
  onClose: () => void;
}

/** Full-screen broadcast image viewer — uncropped, dimmed backdrop, tap outside or X to close. */
export function BroadcastImageViewerModal({
  visible,
  imageUrl,
  onClose,
}: BroadcastImageViewerModalProps): React.ReactElement | null {
  const insets = useSafeAreaInsets();
  const resolvedUri = resolveMediaDisplayUrl(imageUrl);

  if (!resolvedUri) {
    return null;
  }

  const closeTop = insets.top + 8;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-black/85">
        <Pressable
          style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close full image view"
        />

        <View
          className="flex-1 items-center justify-center px-6"
          style={{
            paddingTop: closeTop + CLOSE_HIT_SIZE + 8,
            paddingBottom: insets.bottom + 16,
          }}
          pointerEvents="box-none"
        >
          <Image
            source={{ uri: resolvedUri }}
            style={{ width: '100%', height: '100%' }}
            contentFit="contain"
            accessibilityLabel="Full announcement image"
            onError={() => {
              console.warn('[ACC] Broadcast full-screen image failed to load', {
                imageUrl,
                resolvedUri,
              });
            }}
          />
        </View>

        <View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            top: closeTop,
            right: 16,
            zIndex: 20,
            elevation: 20,
          }}
        >
          <Pressable
            onPress={onClose}
            hitSlop={8}
            style={{
              width: CLOSE_HIT_SIZE,
              height: CLOSE_HIT_SIZE,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: CLOSE_HIT_SIZE / 2,
              backgroundColor: 'rgba(0, 0, 0, 0.45)',
            }}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Ionicons name="close" size={26} color={colors.textInverse} />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
