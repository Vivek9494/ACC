import { useCallback, useEffect, useState } from 'react';
import { Pressable, View, type ViewStyle } from 'react-native';

import { Text } from '../../ui/Text';
import { CockpitPanel } from './CockpitPanel';
import { ObsConnectionSettingsModal } from './ObsConnectionSettingsModal';
import type { AscObsStatus } from '../../../types/asc-broadcast';

function getObsBridge() {
  if (typeof window === 'undefined') {
    return undefined;
  }
  const obs = window.ascBroadcast?.obs;
  if (typeof obs?.getStatus !== 'function' || typeof obs?.getConfig !== 'function') {
    return undefined;
  }
  return obs;
}

/** True only inside ASC Broadcast Electron (BrowserView preload present). */
export function hasAscObsBridge(): boolean {
  return getObsBridge() != null;
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

/**
 * Broadcast / OBS controls — Electron BrowserView only.
 * Uses existing IPC via window.ascBroadcast.obs (including Settings).
 */
export function BroadcastObsPanel(): React.ReactElement | null {
  const bridge = getObsBridge();
  const [status, setStatus] = useState<AscObsStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);

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

  const errorText =
    localError || status?.error || status?.replayBufferWarning || status?.studioModeWarning || '';

  return (
    <>
      <CockpitPanel title="Broadcast / OBS" live={Boolean(connected)} fitContent>
        <View className="gap-2">
          <Text className="font-sans text-[11px] text-on-surface-variant" numberOfLines={2}>
            {status ? statusLine(status) : 'Connecting…'}
          </Text>
          {errorText ? (
            <Text className="font-sans text-[10px] text-primary" numberOfLines={3}>
              {errorText}
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
