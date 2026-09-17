import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, View, type ViewStyle } from 'react-native';

import type { ScorecardResponse } from '@acc/types';

import { Text } from '../../ui/Text';
import type {
  AscInningsHighlightResult,
  AscObsBridge,
  AscObsStatus,
} from '../../../types/asc-broadcast';
import { CockpitPanel } from './CockpitPanel';
import { ObsConnectionSettingsModal } from './ObsConnectionSettingsModal';
import {
  HIGHLIGHT_BUILD_DELAY_MS,
  collectFirstInningsClipPaths,
  collectFullMatchClipPaths,
  isFirstInningsClosed,
  isMatchCompleted,
  type HighlightKind,
} from './first-innings-highlight';

import { hasAscObsBridge } from '../../../lib/asc-broadcast-bridge';

export { hasAscObsBridge };

function getObsBridge() {
  if (typeof window === 'undefined') {
    return undefined;
  }
  if (!hasAscObsBridge()) {
    return undefined;
  }
  return window.ascBroadcast?.obs;
}

function connectionLabel(status: AscObsStatus): string {
  if (status.lifecycle === 'launching') return 'Launching OBS…';
  if (status.lifecycle === 'waiting') return 'Waiting for OBS…';
  if (status.connection === 'connected') return 'Connected';
  if (status.connection === 'connecting') return 'Connecting…';
  if (status.connection === 'error' || status.lifecycle === 'error') return 'Error';
  return 'Disconnected';
}

function streamStateLabel(status: AscObsStatus): string {
  const state = status.stream.outputState;
  if (state === 'OBS_WEBSOCKET_OUTPUT_STARTING') return 'Stream starting…';
  if (state === 'OBS_WEBSOCKET_OUTPUT_STOPPING') return 'Stream stopping…';
  if (status.stream.outputReconnecting || state === 'OBS_WEBSOCKET_OUTPUT_RECONNECTING') {
    return 'Stream reconnecting…';
  }
  if (status.stream.outputActive) {
    const clock = status.stream.outputTimecode ? ` ${status.stream.outputTimecode}` : '';
    return `Streaming${clock}`;
  }
  return 'Stream idle';
}

function statusLine(status: AscObsStatus): string {
  const connected = status.connection === 'connected';
  const isReplaying = Boolean(status.isReplaying);
  const instantPhase = status.instantReplayPhase || 'idle';
  const savingReplay = instantPhase === 'saving';

  let detail = 'Stream idle';
  if (connected) {
    if (isReplaying || instantPhase === 'playing') {
      detail = 'Replay on air';
    } else if (savingReplay) {
      detail = 'Saving replay…';
    } else {
      detail = streamStateLabel(status);
      if (status.replayBufferState === 'active' || status.replayBufferActive) {
        detail += ' · Replay ready';
      } else if (status.replayBufferState === 'inactive') {
        detail += ' · Replay off';
      } else if (status.replayBufferState === 'unavailable') {
        detail += ' · Replay unavailable';
      }
    }
  }
  return `${connectionLabel(status)} · ${detail}`;
}

const ROW: ViewStyle = {
  flexDirection: 'row',
  flexWrap: 'wrap',
  gap: 6,
  alignItems: 'center',
  minWidth: 0,
  width: '100%',
  maxWidth: '100%',
};

const BTN_BASE =
  'items-center justify-center rounded-control px-2.5 py-1.5';
const BTN_PRIMARY = `${BTN_BASE} bg-primary`;
const BTN_DANGER = `${BTN_BASE} bg-red-700`;
const BTN_GHOST = `${BTN_BASE} border border-outline-variant bg-surface`;
const BTN_DISABLED = 'opacity-40';

function ObsButton({
  label,
  onPress,
  disabled,
  variant = 'ghost',
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'danger' | 'ghost';
}): React.ReactElement {
  const cls =
    variant === 'primary' ? BTN_PRIMARY : variant === 'danger' ? BTN_DANGER : BTN_GHOST;
  const textCls =
    variant === 'ghost'
      ? 'font-sans-semibold text-[10px] uppercase tracking-wide text-on-surface'
      : 'font-sans-semibold text-[10px] uppercase tracking-wide text-white';
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      className={`${cls}${disabled ? ` ${BTN_DISABLED}` : ''}`}
    >
      <Text className={textCls}>{label}</Text>
    </Pressable>
  );
}

function buildHighlightViaBridge(
  bridge: AscObsBridge,
  payload: {
    matchId: string;
    matchFolderStamp: string;
    clipPaths: string[];
    kind: HighlightKind;
  },
): Promise<AscInningsHighlightResult> {
  if (typeof bridge.buildHighlight === 'function') {
    return bridge.buildHighlight(payload);
  }
  if (payload.kind === 'innings-1' && typeof bridge.buildInningsHighlight === 'function') {
    return bridge.buildInningsHighlight(payload);
  }
  return Promise.reject(new Error('Highlight build is not available in this bridge.'));
}

function getHighlightViaBridge(
  bridge: AscObsBridge,
  matchId: string,
  matchFolderStamp: string,
  kind: HighlightKind,
): Promise<AscInningsHighlightResult> {
  if (typeof bridge.getHighlight === 'function') {
    return bridge.getHighlight({ matchId, matchFolderStamp, kind });
  }
  if (kind === 'innings-1' && typeof bridge.getInningsHighlight === 'function') {
    return bridge.getInningsHighlight(matchId);
  }
  return Promise.resolve({ highlightPath: null, status: 'empty', kind });
}

type HighlightSlotState = {
  path: string | null;
  note: string;
  building: boolean;
};

const EMPTY_SLOT: HighlightSlotState = { path: null, note: '', building: false };

/**
 * Broadcast / OBS controls — Electron BrowserView only.
 * Uses existing IPC via window.ascBroadcast.obs (including Settings).
 */
export function BroadcastObsPanel({
  matchId,
  matchFolderStamp,
  card,
  matchState,
}: {
  matchId: string;
  /** Stable YYYYMMDD-HHMMSS for the match clips folder. */
  matchFolderStamp: string;
  card: ScorecardResponse;
  matchState: string;
}): React.ReactElement | null {
  const bridge = getObsBridge();
  const [status, setStatus] = useState<AscObsStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [innings1, setInnings1] = useState<HighlightSlotState>(EMPTY_SLOT);
  const [fullMatch, setFullMatch] = useState<HighlightSlotState>(EMPTY_SLOT);
  const innings1ReadyKeyRef = useRef<string | null>(null);
  const innings1BuildKeyRef = useRef<string | null>(null);
  const fullMatchReadyKeyRef = useRef<string | null>(null);
  const fullMatchBuildKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!bridge) {
      return;
    }
    let cancelled = false;
    void bridge.getStatus().then((snap) => {
      if (!cancelled) {
        setStatus(snap);
      }
    });
    const unsubStatus = bridge.onStatus((snap) => {
      setStatus(snap);
      setLocalError('');
    });
    const unsubSettings = bridge.onOpenSettings(() => {
      setSettingsOpen(true);
    });
    return () => {
      cancelled = true;
      unsubStatus();
      unsubSettings();
    };
  }, [bridge]);

  // Restore previously built highlights for this match.
  useEffect(() => {
    if (!bridge || !matchId || !matchFolderStamp) {
      return;
    }
    let cancelled = false;
    void (async () => {
      const [i1, full] = await Promise.all([
        getHighlightViaBridge(bridge, matchId, matchFolderStamp, 'innings-1'),
        getHighlightViaBridge(bridge, matchId, matchFolderStamp, 'full-match'),
      ]);
      if (cancelled) return;
      if (i1.status === 'ready' && i1.highlightPath) {
        setInnings1({ path: i1.highlightPath, note: '', building: false });
      }
      if (full.status === 'ready' && full.highlightPath) {
        setFullMatch({ path: full.highlightPath, note: '', building: false });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bridge, matchId, matchFolderStamp]);

  // Auto-build innings-1 highlight when innings 1 closes.
  useEffect(() => {
    if (!bridge || !matchId || !matchFolderStamp || !isFirstInningsClosed(card)) {
      return;
    }
    const clipPaths = collectFirstInningsClipPaths(card);
    const attemptKey = `innings-1:${matchId}:${clipPaths.join('\0')}`;
    if (innings1ReadyKeyRef.current === attemptKey) {
      return;
    }
    if (innings1BuildKeyRef.current === attemptKey && innings1.building) {
      return;
    }

    const timer = window.setTimeout(() => {
      void (async () => {
        const paths = collectFirstInningsClipPaths(card);
        const key = `innings-1:${matchId}:${paths.join('\0')}`;
        innings1BuildKeyRef.current = key;
        setInnings1((prev) => ({
          ...prev,
          building: true,
          note: paths.length === 0 ? 'No clips to merge' : 'Building highlight…',
        }));
        try {
          const result = await buildHighlightViaBridge(bridge, {
            matchId,
            matchFolderStamp,
            clipPaths: paths,
            kind: 'innings-1',
          });
          if (result.status === 'ready' && result.highlightPath) {
            innings1ReadyKeyRef.current = key;
            const skipped =
              typeof result.skipped === 'number' && result.skipped > 0
                ? ` · skipped ${result.skipped} missing`
                : '';
            setInnings1({
              path: result.highlightPath,
              building: false,
              note: `Ready · ${result.clipCount ?? paths.length} clip${
                (result.clipCount ?? paths.length) === 1 ? '' : 's'
              }${skipped}`,
            });
          } else if (result.status === 'empty') {
            innings1ReadyKeyRef.current = key;
            setInnings1({ path: null, building: false, note: 'No clips for first innings' });
          } else {
            setInnings1({
              path: null,
              building: false,
              note: result.error || 'Highlight build failed',
            });
          }
        } catch (err) {
          setInnings1({
            path: null,
            building: false,
            note: err instanceof Error ? err.message : 'Highlight build failed',
          });
        }
      })();
    }, HIGHLIGHT_BUILD_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [bridge, matchId, matchFolderStamp, card, innings1.building]);

  // Auto-build full-match highlight when the match is completed.
  useEffect(() => {
    if (!bridge || !matchId || !matchFolderStamp || !isMatchCompleted(matchState)) {
      return;
    }
    const clipPaths = collectFullMatchClipPaths(card);
    const attemptKey = `full-match:${matchId}:${clipPaths.join('\0')}`;
    if (fullMatchReadyKeyRef.current === attemptKey) {
      return;
    }
    if (fullMatchBuildKeyRef.current === attemptKey && fullMatch.building) {
      return;
    }

    const timer = window.setTimeout(() => {
      void (async () => {
        const paths = collectFullMatchClipPaths(card);
        const key = `full-match:${matchId}:${paths.join('\0')}`;
        fullMatchBuildKeyRef.current = key;
        setFullMatch((prev) => ({
          ...prev,
          building: true,
          note: paths.length === 0 ? 'No clips to merge' : 'Building highlight…',
        }));
        try {
          const result = await buildHighlightViaBridge(bridge, {
            matchId,
            matchFolderStamp,
            clipPaths: paths,
            kind: 'full-match',
          });
          if (result.status === 'ready' && result.highlightPath) {
            fullMatchReadyKeyRef.current = key;
            const skipped =
              typeof result.skipped === 'number' && result.skipped > 0
                ? ` · skipped ${result.skipped} missing`
                : '';
            setFullMatch({
              path: result.highlightPath,
              building: false,
              note: `Ready · ${result.clipCount ?? paths.length} clip${
                (result.clipCount ?? paths.length) === 1 ? '' : 's'
              }${skipped}`,
            });
          } else if (result.status === 'empty') {
            fullMatchReadyKeyRef.current = key;
            setFullMatch({ path: null, building: false, note: 'No clips for this match' });
          } else {
            setFullMatch({
              path: null,
              building: false,
              note: result.error || 'Highlight build failed',
            });
          }
        } catch (err) {
          setFullMatch({
            path: null,
            building: false,
            note: err instanceof Error ? err.message : 'Highlight build failed',
          });
        }
      })();
    }, HIGHLIGHT_BUILD_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [bridge, matchId, matchFolderStamp, card, matchState, fullMatch.building]);

  const run = useCallback(
    async (fn: () => Promise<AscObsStatus>) => {
      if (!bridge || busy) {
        return;
      }
      setBusy(true);
      setLocalError('');
      try {
        const snap = await fn();
        setStatus(snap);
      } catch (err) {
        setLocalError(err instanceof Error ? err.message : 'OBS command failed.');
      } finally {
        setBusy(false);
        try {
          const snap = await bridge.getStatus();
          setStatus(snap);
        } catch {
          // keep prior status
        }
      }
    },
    [bridge, busy],
  );

  if (!bridge) {
    return null;
  }

  const connected = status?.connection === 'connected';
  const connecting =
    status?.connection === 'connecting' ||
    status?.lifecycle === 'launching' ||
    status?.lifecycle === 'waiting';
  const starting = status?.stream.outputState === 'OBS_WEBSOCKET_OUTPUT_STARTING';
  const stopping = status?.stream.outputState === 'OBS_WEBSOCKET_OUTPUT_STOPPING';
  const isReplaying = Boolean(status?.isReplaying);
  const instantPhase = status?.instantReplayPhase || 'idle';
  const savingReplay = instantPhase === 'saving';
  const replayBusy = isReplaying || instantPhase !== 'idle';
  const replayActive = status?.replayBufferState === 'active' || status?.replayBufferActive;
  const needsReplayStart =
    Boolean(connected) &&
    !replayActive &&
    !replayBusy &&
    (status?.replayBufferState === 'inactive' ||
      status?.replayBufferState === 'unavailable' ||
      Boolean(status?.replayBufferWarning));
  const canPlayInnings1 =
    typeof bridge.playFileOnAir === 'function' && Boolean(innings1.path) && !innings1.building;
  const canPlayFullMatch =
    typeof bridge.playFileOnAir === 'function' && Boolean(fullMatch.path) && !fullMatch.building;
  const showInnings1Note = isFirstInningsClosed(card) || Boolean(innings1.path) || innings1.building;
  const showFullMatchNote =
    isMatchCompleted(matchState) || Boolean(fullMatch.path) || fullMatch.building;

  const errorText =
    localError || status?.error || status?.replayBufferWarning || status?.studioModeWarning || '';

  return (
    <>
      <CockpitPanel title="Broadcast / OBS" live={Boolean(connected)} fitContent>
        <View className="min-w-0 gap-2" style={{ width: '100%', maxWidth: '100%' }}>
          <Text className="font-sans text-[11px] text-on-surface-variant" numberOfLines={2}>
            {status ? statusLine(status) : 'Connecting…'}
          </Text>
          {errorText ? (
            <Text className="font-sans text-[10px] text-primary" numberOfLines={3}>
              {errorText}
            </Text>
          ) : null}
          {showInnings1Note && innings1.note ? (
            <Text className="font-sans text-[10px] text-on-surface-variant" numberOfLines={2}>
              1st innings highlight: {innings1.note}
            </Text>
          ) : null}
          {showFullMatchNote && fullMatch.note ? (
            <Text className="font-sans text-[10px] text-on-surface-variant" numberOfLines={2}>
              Full match highlight: {fullMatch.note}
            </Text>
          ) : null}
          <View style={ROW}>
            <ObsButton
              label="Settings"
              variant="ghost"
              disabled={busy}
              onPress={() => setSettingsOpen(true)}
            />
            {!connected ? (
              <ObsButton
                label={
                  status?.connection === 'error' || status?.lifecycle === 'error'
                    ? 'Reconnect'
                    : 'Start OBS'
                }
                variant="ghost"
                disabled={busy || connecting}
                onPress={() => void run(() => bridge.connect())}
              />
            ) : (
              <ObsButton
                label="Disconnect"
                variant="ghost"
                disabled={busy || isReplaying || savingReplay || replayBusy}
                onPress={() => void run(() => bridge.disconnect())}
              />
            )}
            <ObsButton
              label="Start Streaming"
              variant="primary"
              disabled={
                busy ||
                !connected ||
                Boolean(status?.stream.outputActive) ||
                Boolean(starting) ||
                Boolean(stopping) ||
                replayBusy
              }
              onPress={() => void run(() => bridge.startStream())}
            />
            <ObsButton
              label="Stop Streaming"
              variant="danger"
              disabled={
                busy ||
                !connected ||
                (!status?.stream.outputActive && !starting) ||
                Boolean(stopping)
              }
              onPress={() => void run(() => bridge.stopStream())}
            />
            {needsReplayStart ? (
              <ObsButton
                label="Start Replay Buffer"
                variant="ghost"
                disabled={busy || !connected}
                onPress={() => void run(() => bridge.startReplayBuffer())}
              />
            ) : null}
            {connected && replayActive ? (
              <ObsButton
                label={savingReplay ? 'Saving…' : isReplaying ? 'Replaying…' : 'Instant Replay'}
                variant="primary"
                disabled={busy || !connected || !replayActive || replayBusy}
                onPress={() => void run(() => bridge.startInstantReplay())}
              />
            ) : null}
            {canPlayInnings1 ? (
              <ObsButton
                label="First Innings Highlight"
                variant="primary"
                disabled={busy || !connected || replayBusy || !innings1.path}
                onPress={() => {
                  const path = innings1.path;
                  if (!path || !bridge.playFileOnAir) return;
                  void run(() => bridge.playFileOnAir(path));
                }}
              />
            ) : null}
            {canPlayFullMatch ? (
              <ObsButton
                label="Full Match Highlight"
                variant="primary"
                disabled={busy || !connected || replayBusy || !fullMatch.path}
                onPress={() => {
                  const path = fullMatch.path;
                  if (!path || !bridge.playFileOnAir) return;
                  void run(() => bridge.playFileOnAir(path));
                }}
              />
            ) : null}
            {connected && replayBusy && instantPhase !== 'saving' ? (
              <ObsButton
                label="Back to Live"
                variant="ghost"
                disabled={busy || !connected}
                onPress={() => void run(() => bridge.returnToLive())}
              />
            ) : null}
          </View>
        </View>
      </CockpitPanel>
      <ObsConnectionSettingsModal
        visible={settingsOpen}
        bridge={bridge}
        onClose={() => setSettingsOpen(false)}
      />
    </>
  );
}
