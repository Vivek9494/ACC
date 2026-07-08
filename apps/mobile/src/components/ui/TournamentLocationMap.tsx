import type { Ref } from 'react';

import type { MapRegion } from './map-region';

export interface TournamentLocationMapProps {
  latitude: number;
  longitude: number;
  initialRegion: MapRegion;
  isPreviewOnly: boolean;
  onCoordinateChange: (latitude: number, longitude: number) => void;
  onRegionChange: (region: MapRegion) => void;
}

export interface TournamentLocationMapHandle {
  animateToRegion: (region: MapRegion, duration?: number) => void;
  adjustZoom: (direction: 1 | -1) => Promise<void>;
}

export type TournamentLocationMapRef = Ref<TournamentLocationMapHandle | null>;

/** Metro resolves `.native` / `.web` at bundle time; web re-export satisfies TypeScript. */
export { TournamentLocationMap } from './TournamentLocationMap.web';
