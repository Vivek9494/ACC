import type { OverlayPreviewMessageType } from '@acc/types';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

import { OVERLAY_CANVAS } from './overlay-preview';

export interface OverlayPreviewFrameHandle {
  send(type: OverlayPreviewMessageType): void;
}

const CHECKERBOARD: React.CSSProperties = {
  backgroundColor: '#1b1d22',
  backgroundImage: 'conic-gradient(#2a2d34 25%, transparent 0 50%, #2a2d34 0 75%, transparent 0)',
  backgroundSize: '24px 24px',
};

/** 16:9 frame that renders the overlay at 1920×1080 and scales it to fit. */
export const OverlayPreviewFrame = forwardRef<
  OverlayPreviewFrameHandle,
  { src: string; targetOrigin: string; title: string }
>(function OverlayPreviewFrame({ src, targetOrigin, title }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [scale, setScale] = useState(0);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return undefined;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setScale(entry.contentRect.width / OVERLAY_CANVAS.width);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      send(type) {
        iframeRef.current?.contentWindow?.postMessage({ type }, targetOrigin);
      },
    }),
    [targetOrigin],
  );

  return (
    <div
      ref={containerRef}
      className="relative aspect-video w-full overflow-hidden rounded-lg border shadow-sm"
      style={CHECKERBOARD}
    >
      {scale > 0 ? (
        <iframe
          key={src}
          ref={iframeRef}
          src={src}
          title={title}
          sandbox="allow-scripts allow-same-origin"
          referrerPolicy="no-referrer"
          className="absolute top-0 left-0 origin-top-left border-0"
          style={{
            width: OVERLAY_CANVAS.width,
            height: OVERLAY_CANVAS.height,
            transform: `scale(${scale})`,
            colorScheme: 'normal',
          }}
        />
      ) : null}
    </div>
  );
});
