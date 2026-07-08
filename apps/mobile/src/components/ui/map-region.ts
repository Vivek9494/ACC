/** Map region shape — mirrors react-native-maps Region without importing native modules. */
export interface MapRegion {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

/** Default map center (Toronto) when no place is selected yet. */
export const DEFAULT_MAP_REGION: MapRegion = {
  latitude: 43.6532,
  longitude: -79.3832,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

export const SELECTED_MAP_REGION_DELTA = 0.02;

export function regionForCoordinate(
  latitude: number,
  longitude: number,
  delta = SELECTED_MAP_REGION_DELTA,
): MapRegion {
  return {
    latitude,
    longitude,
    latitudeDelta: delta,
    longitudeDelta: delta,
  };
}
