import {
  WAGON_WHEEL_INNER_RING_RADIUS,
  WAGON_WHEEL_STRIKER_ORIGIN,
  WAGON_WHEEL_VIEWBOX,
  clampWagonWheelPoint,
  isValidWagonWheelCoord,
  wagonWheelLineColor,
  wagonWheelPointFromClientRect,
  wagonWheelPointFromViewCoords,
  wagonWheelRunsFromEntry,
  type TimelineEntry,
} from '@acc/types';
import { useCallback, useEffect, useRef, type CSSProperties } from 'react';
import { Platform, Pressable, View, type ViewStyle } from 'react-native';

const VIEW_BOX = `${WAGON_WHEEL_VIEWBOX.minX} ${WAGON_WHEEL_VIEWBOX.minY} ${WAGON_WHEEL_VIEWBOX.width} ${WAGON_WHEEL_VIEWBOX.height}`;
const PITCH_HALF_LENGTH = 0.11;
const PITCH_HALF_WIDTH = 0.018;
const IS_WEB = Platform.OS === 'web';

const GROUND_STYLE: CSSProperties = {
  width: '100%',
  height: '100%',
  display: 'block',
  userSelect: 'none',
  touchAction: 'none',
};

const SCROLL_BODY: ViewStyle = {
  flex: 1,
  minHeight: 0,
  overflow: 'hidden',
};

const SQUARE_STYLE: ViewStyle = {
  flex: 1,
  width: '100%',
  alignSelf: 'stretch',
};

type SvgDom = SVGSVGElement & {
  createSVGPoint: () => DOMPoint;
  getScreenCTM: () => DOMMatrix | null;
};

/**
 * Screen (clientX/Y) → SVG viewBox user space (same coords used to draw lines/dots).
 * Prefer getScreenCTM; fall back to getBoundingClientRect + viewBox math.
 */
function pointFromSvgClick(
  svg: SvgDom,
  clientX: number,
  clientY: number,
): { x: number; y: number } | null {
  try {
    const matrix = svg.getScreenCTM?.();
    if (matrix && typeof svg.createSVGPoint === 'function') {
      const point = svg.createSVGPoint();
      point.x = clientX;
      point.y = clientY;
      const mapped = point.matrixTransform(matrix.inverse());
      if (Number.isFinite(mapped.x) && Number.isFinite(mapped.y)) {
        return clampWagonWheelPoint(mapped.x, mapped.y);
      }
    }
  } catch {
    // fall through
  }

  return wagonWheelPointFromClientRect(clientX, clientY, svg.getBoundingClientRect());
}

function RadialGuides(): React.ReactElement {
  const lines: React.ReactElement[] = [];
  for (let i = 0; i < 8; i += 1) {
    const angle = (Math.PI * 2 * i) / 8;
    const x = Math.cos(angle);
    const y = Math.sin(angle);
    lines.push(
      <line
        key={`radial-${i}`}
        x1={0}
        y1={0}
        x2={x}
        y2={y}
        stroke="rgba(120, 113, 108, 0.35)"
        strokeWidth={0.012}
      />,
    );
  }
  return <>{lines}</>;
}

function ShotMarker({
  entry,
  origin,
  isActive,
  dashed,
}: {
  entry: Pick<TimelineEntry, 'sequence' | 'shotX' | 'shotY' | 'runsBat' | 'code' | 'deliveryType'>;
  origin: { x: number; y: number };
  isActive: boolean;
  dashed?: boolean;
}): React.ReactElement | null {
  if (!isValidWagonWheelCoord(entry.shotX) || !isValidWagonWheelCoord(entry.shotY)) {
    return null;
  }
  const runs = wagonWheelRunsFromEntry(entry);
  const color = wagonWheelLineColor(runs);
  return (
    <g opacity={isActive ? 1 : 0.88}>
      <line
        x1={origin.x}
        y1={origin.y}
        x2={entry.shotX}
        y2={entry.shotY}
        stroke={color}
        strokeWidth={isActive ? 0.034 : 0.028}
        strokeLinecap="round"
        {...(dashed ? { strokeDasharray: '0.05 0.03' } : {})}
      />
      <circle
        cx={entry.shotX}
        cy={entry.shotY}
        r={isActive ? 0.042 : 0.035}
        fill={color}
        stroke={dashed ? '#1c1917' : '#fff'}
        strokeWidth={dashed ? 0.018 : 0.012}
      />
    </g>
  );
}

function GroundSvg({
  entries,
  activeEntry,
  svgRef,
  placementEnabled,
}: {
  entries: readonly TimelineEntry[];
  activeEntry: TimelineEntry | null;
  svgRef: React.RefObject<SvgDom | null>;
  placementEnabled: boolean;
}): React.ReactElement {
  const origin = WAGON_WHEEL_STRIKER_ORIGIN;
  const activeInEntries =
    activeEntry != null && entries.some((entry) => entry.sequence === activeEntry.sequence);

  return (
    <svg
      ref={svgRef as React.RefObject<SVGSVGElement>}
      viewBox={VIEW_BOX}
      style={{
        ...GROUND_STYLE,
        cursor: placementEnabled ? 'crosshair' : 'default',
        pointerEvents: IS_WEB ? (placementEnabled ? 'auto' : 'none') : 'none',
      }}
      role="img"
      aria-label="Wagon wheel ground"
    >
      <circle cx={0} cy={0} r={1} fill="#ecfdf5" stroke="#166534" strokeWidth={0.03} />
      <circle
        cx={0}
        cy={0}
        r={WAGON_WHEEL_INNER_RING_RADIUS}
        fill="none"
        stroke="rgba(22, 101, 52, 0.45)"
        strokeWidth={0.018}
        strokeDasharray="0.04 0.03"
      />
      <RadialGuides />
      <rect
        x={-PITCH_HALF_WIDTH}
        y={-PITCH_HALF_LENGTH}
        width={PITCH_HALF_WIDTH * 2}
        height={PITCH_HALF_LENGTH * 2}
        fill="#fef3c7"
        stroke="#92400e"
        strokeWidth={0.012}
        rx={0.004}
      />
      <circle
        cx={origin.x}
        cy={origin.y}
        r={0.022}
        fill="#92400e"
        stroke="#fff"
        strokeWidth={0.01}
      />
      {entries.map((entry) => (
        <ShotMarker
          key={`shot-${entry.sequence}`}
          entry={entry}
          origin={origin}
          isActive={activeEntry?.sequence === entry.sequence}
        />
      ))}
      {activeEntry && !activeInEntries ? (
        <ShotMarker
          key={`active-${activeEntry.sequence}`}
          entry={activeEntry}
          origin={origin}
          isActive
          dashed
        />
      ) : null}
    </svg>
  );
}

export function WagonWheelGround({
  entries,
  activeEntry,
  placementEnabled,
  onPlace,
}: {
  entries: readonly TimelineEntry[];
  activeEntry: TimelineEntry | null;
  placementEnabled: boolean;
  onPlace: (x: number, y: number) => void;
}): React.ReactElement {
  const svgRef = useRef<SvgDom | null>(null);
  const viewSizeRef = useRef({ width: 0, height: 0 });
  const onPlaceRef = useRef(onPlace);
  const enabledRef = useRef(placementEnabled);
  onPlaceRef.current = onPlace;
  enabledRef.current = placementEnabled;

  useEffect(() => {
    if (!IS_WEB) {
      return;
    }
    const svg = svgRef.current;
    if (!svg || !placementEnabled) {
      return;
    }

    const handleClick = (event: MouseEvent) => {
      if (!enabledRef.current) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const point = pointFromSvgClick(svg, event.clientX, event.clientY);
      if (point == null || !isValidWagonWheelCoord(point.x) || !isValidWagonWheelCoord(point.y)) {
        return;
      }
      onPlaceRef.current(point.x, point.y);
    };

    svg.addEventListener('click', handleClick);
    return () => {
      svg.removeEventListener('click', handleClick);
    };
  }, [placementEnabled]);

  const handleNativePress = useCallback(
    (event: { nativeEvent: { locationX?: number; locationY?: number } }) => {
      if (!placementEnabled) {
        return;
      }
      const { locationX, locationY } = event.nativeEvent;
      const { width, height } = viewSizeRef.current;
      if (
        !Number.isFinite(locationX) ||
        !Number.isFinite(locationY) ||
        width <= 0 ||
        height <= 0
      ) {
        return;
      }
      const point = wagonWheelPointFromViewCoords(locationX!, locationY!, width, height);
      if (point == null || !isValidWagonWheelCoord(point.x) || !isValidWagonWheelCoord(point.y)) {
        return;
      }
      onPlace(point.x, point.y);
    },
    [onPlace, placementEnabled],
  );

  return (
    <View style={SCROLL_BODY} className="min-h-0 flex-1 items-center justify-center">
      {IS_WEB ? (
        <View
          style={SQUARE_STYLE}
          className="aspect-square w-full max-h-full max-w-full"
          accessibilityRole="button"
          accessibilityLabel={
            placementEnabled ? 'Place shot on the ground' : 'Score an off-bat run to place a shot'
          }
        >
          <GroundSvg
            entries={entries}
            activeEntry={activeEntry}
            svgRef={svgRef}
            placementEnabled={placementEnabled}
          />
        </View>
      ) : (
        <Pressable
          onLayout={(event) => {
            const { width, height } = event.nativeEvent.layout;
            viewSizeRef.current = { width, height };
          }}
          onPress={handleNativePress}
          disabled={!placementEnabled}
          style={SQUARE_STYLE}
          className="aspect-square w-full max-h-full max-w-full"
          accessibilityRole="button"
          accessibilityLabel={
            placementEnabled ? 'Place shot on the ground' : 'Score an off-bat run to place a shot'
          }
        >
          <GroundSvg
            entries={entries}
            activeEntry={activeEntry}
            svgRef={svgRef}
            placementEnabled={placementEnabled}
          />
        </Pressable>
      )}
    </View>
  );
}
