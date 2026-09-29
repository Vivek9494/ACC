import {
  LOCATION_INPUT_MESSAGES,
  isCoordinateLikeInput,
  looksLikeGoogleMapsUrl,
  normalizeMapsUrlInput,
  parseCoordinatePair,
  parseGoogleMapsUrlCoordinates,
} from '@acc/types';
import { Loader2, MapPin } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Input } from '@/components/ui/input';
import { ApiError } from '@/lib/api-client';

import { FieldShell } from './form-fields';
import {
  placeDetails,
  resolveMapsLink,
  reverseGeocode,
  searchPlaces,
} from './tournament-manage-api';

const AUTOCOMPLETE_DEBOUNCE_MS = 350;

type Suggestion =
  | { kind: 'place'; placeId: string; description: string }
  | { kind: 'resolved'; latitude: number; longitude: number; description: string };

function placesErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'PLACES_UNAVAILABLE')
      return 'Location search is not configured on the server.';
    if (err.code === 'PLACES_RATE_LIMIT') return 'Too many searches. Wait a moment and try again.';
    if (err.code === 'MAPS_LINK_UNRESOLVED') return LOCATION_INPUT_MESSAGES.mapsLinkFailed;
    if (err.message) return err.message;
  }
  return 'Could not search locations. Check your connection and try again.';
}

/** Tennis venue: search, paste a Google Maps link, or type "lat, lng". Typing clears the pinned coordinates. */
export function LocationField({
  address,
  latitude,
  longitude,
  onChange,
  error,
}: {
  address: string;
  latitude: number | null;
  longitude: number | null;
  onChange: (address: string, latitude: number | null, longitude: number | null) => void;
  error?: string;
}): React.ReactElement {
  const sessionToken = useRef(crypto.randomUUID());
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestSeq = useRef(0);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(
    () => () => {
      if (debounce.current) clearTimeout(debounce.current);
    },
    [],
  );

  const runSearch = async (query: string) => {
    const seq = ++requestSeq.current;
    const current = () => seq === requestSeq.current;
    setSearchError(null);
    try {
      if (isCoordinateLikeInput(query)) {
        const coords = parseCoordinatePair(query);
        if (!coords) {
          setSuggestions([]);
          setSearchError(LOCATION_INPUT_MESSAGES.invalidCoordinates);
          return;
        }
        setStatus(LOCATION_INPUT_MESSAGES.resolvingCoordinates);
        const result = await reverseGeocode(coords.latitude, coords.longitude);
        if (current())
          setSuggestions([{ kind: 'resolved', ...coords, description: result.address }]);
        return;
      }
      if (looksLikeGoogleMapsUrl(query)) {
        setStatus(LOCATION_INPUT_MESSAGES.resolvingLink);
        const embedded = parseGoogleMapsUrlCoordinates(query);
        const resolved = embedded
          ? {
              ...embedded,
              address: (await reverseGeocode(embedded.latitude, embedded.longitude)).address,
            }
          : await resolveMapsLink(normalizeMapsUrlInput(query).toString());
        if (current()) {
          setSuggestions([
            {
              kind: 'resolved',
              latitude: resolved.latitude,
              longitude: resolved.longitude,
              description: resolved.address,
            },
          ]);
        }
        return;
      }
      setStatus('Searching locations…');
      const results = await searchPlaces(query, sessionToken.current);
      if (current()) setSuggestions(results.map((item) => ({ kind: 'place', ...item })));
    } catch (err) {
      if (current()) {
        setSuggestions([]);
        setSearchError(placesErrorMessage(err));
      }
    } finally {
      if (current()) setStatus(null);
    }
  };

  const onInput = (text: string) => {
    onChange(text, null, null);
    setSuggestions([]);
    setSearchError(null);
    if (debounce.current) clearTimeout(debounce.current);
    const trimmed = text.trim();
    if (trimmed.length < 2 && !looksLikeGoogleMapsUrl(trimmed) && !isCoordinateLikeInput(trimmed)) {
      requestSeq.current += 1;
      setStatus(null);
      setOpen(false);
      return;
    }
    setOpen(true);
    setStatus('Searching locations…');
    debounce.current = setTimeout(() => void runSearch(trimmed), AUTOCOMPLETE_DEBOUNCE_MS);
  };

  const select = async (item: Suggestion) => {
    setOpen(false);
    setSuggestions([]);
    requestSeq.current += 1;
    if (item.kind === 'resolved') {
      onChange(item.description, item.latitude, item.longitude);
      return;
    }
    setStatus('Pinning location…');
    try {
      const details = await placeDetails(item.placeId, sessionToken.current);
      onChange(item.description, details.latitude, details.longitude);
    } catch (err) {
      onChange(item.description, null, null);
      setSearchError(placesErrorMessage(err));
    } finally {
      sessionToken.current = crypto.randomUUID();
      setStatus(null);
    }
  };

  const pinned = latitude != null && longitude != null;
  const showEmpty =
    open && !status && !searchError && suggestions.length === 0 && address.trim().length >= 2;

  return (
    <FieldShell
      id="tournament-location"
      field="tournamentLocation"
      label="Tournament Location"
      error={error ?? searchError ?? undefined}
      hint={
        status ? undefined : pinned ? (
          <span className="inline-flex items-center gap-1 text-primary">
            <MapPin className="size-3" />
            Pinned at {latitude.toFixed(5)}, {longitude.toFixed(5)}
          </span>
        ) : (
          'Search a venue, paste a Google Maps link, or enter "latitude, longitude", then pick a result.'
        )
      }
    >
      <div className="relative">
        <Input
          id="tournament-location"
          value={address}
          onChange={(e) => onInput(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Search venue or paste a Maps link"
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls="tournament-location-options"
          aria-invalid={Boolean(error)}
        />
        {status ? (
          <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" />
            {status}
          </p>
        ) : null}
        {open && (suggestions.length > 0 || showEmpty) ? (
          <ul
            id="tournament-location-options"
            role="listbox"
            className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border bg-popover p-1 text-sm shadow-md"
          >
            {suggestions.map((item) => (
              <li
                key={item.kind === 'place' ? item.placeId : `${item.latitude},${item.longitude}`}
                role="option"
                aria-selected={false}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => void select(item)}
                className="flex cursor-pointer items-start gap-2 rounded-sm px-2 py-1.5 hover:bg-accent"
              >
                <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                {item.description}
              </li>
            ))}
            {showEmpty ? (
              <li className="px-2 py-1.5 text-muted-foreground">No matching places.</li>
            ) : null}
          </ul>
        ) : null}
      </div>
    </FieldShell>
  );
}
