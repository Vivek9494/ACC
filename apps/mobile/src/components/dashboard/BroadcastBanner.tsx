import type { ActiveBroadcast } from '@acc/types';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Card } from '../ui/Card';
import { Text } from '../ui/Text';
import { BroadcastImage } from './BroadcastImage';
import { BroadcastImageViewerModal } from './BroadcastImageViewerModal';

export interface BroadcastBannerProps {
  broadcast: ActiveBroadcast;
}

function hasBroadcastText(broadcast: ActiveBroadcast): boolean {
  return broadcast.text != null && broadcast.text.trim().length > 0;
}

function hasBroadcastImage(broadcast: ActiveBroadcast): boolean {
  return broadcast.imageUrl != null && broadcast.imageUrl.trim().length > 0;
}

/** Top-of-dashboard broadcast card — image and/or text; no per-user dismiss. */
export function BroadcastBanner({ broadcast }: BroadcastBannerProps): React.ReactElement {
  const [viewerOpen, setViewerOpen] = useState(false);
  const hasText = hasBroadcastText(broadcast);
  const hasImage = hasBroadcastImage(broadcast);
  const imageUrl = broadcast.imageUrl?.trim() ?? '';

  function openViewer(): void {
    if (hasImage) {
      setViewerOpen(true);
    }
  }

  const imagePreview = hasImage ? (
    <BroadcastImage
      imageUrl={imageUrl}
      height={160}
      containerClassName="w-full"
    />
  ) : null;

  const textSection = hasText ? (
    <View className={hasImage ? 'gap-1 pb-4 pt-3 pr-4' : 'gap-1 p-4'}>
      <Text className="font-sans-semibold text-xs uppercase tracking-wider text-primary">
        Announcement
      </Text>
      <Text className="font-sans text-base leading-6 text-on-surface">{broadcast.text}</Text>
    </View>
  ) : null;

  const cardBody = (
    <>
      {hasImage && hasText ? (
        <Pressable
          onPress={openViewer}
          accessibilityRole="button"
          accessibilityLabel="View full announcement image"
          className="active:opacity-90"
        >
          {imagePreview}
        </Pressable>
      ) : (
        imagePreview
      )}
      {textSection}
    </>
  );

  return (
    <>
      {hasImage && !hasText ? (
        <Pressable
          onPress={openViewer}
          accessibilityRole="button"
          accessibilityLabel="View full announcement image"
          className="active:opacity-90"
        >
          <Card className="overflow-hidden p-0">
            {imagePreview}
          </Card>
        </Pressable>
      ) : (
        <Card className={`overflow-hidden p-0 ${hasText && hasImage ? 'gap-0' : ''}`}>
          {cardBody}
        </Card>
      )}

      {hasImage ? (
        <BroadcastImageViewerModal
          visible={viewerOpen}
          imageUrl={imageUrl}
          onClose={() => setViewerOpen(false)}
        />
      ) : null}
    </>
  );
}
