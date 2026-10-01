import {
  OVERLAY_PREVIEW_DATASETS,
  OVERLAY_PREVIEW_GRAPHICS,
  type OverlayPreviewDataset,
  type OverlayPreviewGraphicKey,
} from '@acc/types';
import { EyeOff, RotateCcw } from 'lucide-react';
import { useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router';

import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { cn } from '@/lib/utils';

import { OverlayPreviewFrame, type OverlayPreviewFrameHandle } from './OverlayPreviewFrame';
import { OVERLAY_ORIGIN, overlayPreviewUrl, parsePreviewSelection, previewGalleryGroups } from './overlay-preview';

const DATASET_OPTIONS = OVERLAY_PREVIEW_DATASETS.map(({ key, label }) => ({ value: key, label }));

/** Admin-only gallery of the live overlay graphics, rendered from sample data. */
export function OverlayPage(): React.ReactElement {
  const [params, setParams] = useSearchParams();
  const { graphic, dataset } = parsePreviewSelection(params);
  const frameRef = useRef<OverlayPreviewFrameHandle>(null);
  const groups = useMemo(() => previewGalleryGroups(), []);
  const label = OVERLAY_PREVIEW_GRAPHICS.find((g) => g.key === graphic)?.label ?? graphic;

  const select = (next: { graphic?: OverlayPreviewGraphicKey; dataset?: OverlayPreviewDataset }): void => {
    setParams({ graphic: next.graphic ?? graphic, dataset: next.dataset ?? dataset }, { replace: true });
  };

  return (
    <div>
      <PageHeader
        title="Overlay"
        description="Preview the on-air overlay graphics with sample data. Previews never connect to a match or OBS."
      />
      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <Card className="h-fit">
          <CardContent className="grid gap-5 py-4">
            {groups.map((group) => (
              <div key={group.key} className="grid gap-1">
                <h2 className="px-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {group.label}
                </h2>
                {group.graphics.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => select({ graphic: item.key })}
                    aria-current={item.key === graphic ? 'true' : undefined}
                    className={cn(
                      'rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                      item.key === graphic
                        ? 'bg-secondary font-semibold text-secondary-foreground'
                        : 'text-foreground hover:bg-muted',
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="grid h-fit gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-secondary">{label}</h2>
            <div className="flex flex-wrap items-center gap-2">
              <SegmentedControl
                ariaLabel="Sample data"
                value={dataset}
                options={DATASET_OPTIONS}
                onChange={(value) => select({ dataset: value })}
              />
              <Button variant="outline" onClick={() => frameRef.current?.send('replay')}>
                <RotateCcw />
                Replay
              </Button>
              <Button variant="outline" onClick={() => frameRef.current?.send('hide')}>
                <EyeOff />
                Hide
              </Button>
            </div>
          </div>
          <OverlayPreviewFrame
            ref={frameRef}
            src={overlayPreviewUrl(OVERLAY_ORIGIN, graphic, dataset)}
            targetOrigin={OVERLAY_ORIGIN}
            title={`Overlay preview: ${label}`}
          />
          <p className="text-xs text-muted-foreground">
            Rendered by the overlay app at 1920×1080 and scaled to fit. Sample data only — no socket, no API calls.
          </p>
        </div>
      </div>
    </div>
  );
}
