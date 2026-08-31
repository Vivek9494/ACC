import { useEffect, useRef, useState } from 'react';
import { createElement } from 'react';
import { View } from 'react-native';

import { logOverlayEmbedResolution, overlayScoreboardUrl } from '../../../lib/overlay-url';
import { Text } from '../../ui/Text';

type EmbedState = 'loading' | 'ready' | 'unavailable';

const LOAD_TIMEOUT_MS = 12_000;

/** Web: embed the existing scoring-overlay page (OBS overlay link preview). */
export function OverlayIFrame({
  src,
  matchId,
}: {
  src?: string;
  matchId?: string;
}): React.ReactElement {
  const [embedSrc, setEmbedSrc] = useState<string | null>(null);
  const [state, setState] = useState<EmbedState>('loading');
  const loadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const resolved = matchId != null ? overlayScoreboardUrl(matchId) : src ?? null;
    if (resolved == null) {
      setEmbedSrc(null);
      setState('unavailable');
      return;
    }

    logOverlayEmbedResolution(matchId ?? '(direct src)', resolved);
    setEmbedSrc(resolved);
    setState('loading');

    loadTimeoutRef.current = setTimeout(() => {
      setState((current) => (current === 'loading' ? 'unavailable' : current));
    }, LOAD_TIMEOUT_MS);

    return () => {
      if (loadTimeoutRef.current != null) {
        clearTimeout(loadTimeoutRef.current);
        loadTimeoutRef.current = null;
      }
    };
  }, [matchId, src]);

  function handleLoad(): void {
    if (loadTimeoutRef.current != null) {
      clearTimeout(loadTimeoutRef.current);
      loadTimeoutRef.current = null;
    }
    setState('ready');
  }

  if (state === 'unavailable' || embedSrc == null) {
    return (
      <View className="flex-1 items-center justify-center px-4">
        <Text className="text-center font-sans text-xs text-text-inverse/80">
          Overlay not available
        </Text>
      </View>
    );
  }

  const loadingOverlay =
    state === 'loading' ? (
      <View
        className="absolute inset-0 z-10 items-center justify-center px-4"
        pointerEvents="none"
      >
        <Text className="text-center font-sans text-xs text-text-inverse/60">
          Loading overlay…
        </Text>
      </View>
    ) : null;

  return (
    <View className="relative flex-1" style={{ flex: 1, minHeight: 0 }}>
      {loadingOverlay}
      {createElement('iframe', {
        src: embedSrc,
        title: 'Live scoreboard overlay',
        onLoad: handleLoad,
        style: {
          width: '100%',
          height: '100%',
          border: 'none',
          backgroundColor: 'transparent',
          opacity: state === 'ready' ? 1 : 0,
        },
      })}
    </View>
  );
}
