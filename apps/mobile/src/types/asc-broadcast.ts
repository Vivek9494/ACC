/**
 * Window types for ASC Broadcast Electron BrowserView bridge.
 * Present only inside Electron; absent in plain browser.
 */

export interface AscObsStreamStatus {
  outputActive: boolean;
  outputReconnecting: boolean;
  outputTimecode: string;
  outputDuration: number;
  outputState: string;
}

export interface AscObsStatus {
  connection: 'disconnected' | 'connecting' | 'connected' | 'error' | string;
  error: string;
  stream: AscObsStreamStatus;
  replayBufferState: 'unknown' | 'unavailable' | 'inactive' | 'active' | string;
  replayBufferActive: boolean;
  isReplaying: boolean;
  instantReplayPhase: 'idle' | 'saving' | 'playing' | string;
  studioModeWarning: string;
  lifecycle?: string;
  replayBufferWarning?: string;
}

/** Same fields as shell OBS Settings / obs-connection.json. */
export interface AscObsConfig {
  host: string;
  port: number;
  password: string;
  obsAppPath: string;
  sceneCollection: string;
  profile: string;
  liveSceneName: string;
  replaySceneName: string;
  replayMediaSourceName: string;
}

export interface AscInningsHighlightResult {
  highlightPath: string | null;
  clipCount?: number;
  skipped?: number;
  status: 'ready' | 'empty' | 'error' | string;
  kind?: 'innings-1' | 'full-match' | string;
  error?: string;
}

export interface AscObsBridge {
  getStatus: () => Promise<AscObsStatus>;
  connect: () => Promise<AscObsStatus>;
  disconnect: () => Promise<AscObsStatus>;
  startStream: () => Promise<AscObsStatus>;
  stopStream: () => Promise<AscObsStatus>;
  startReplayBuffer: () => Promise<AscObsStatus>;
  startInstantReplay: () => Promise<AscObsStatus>;
  /** Null when OBS is disconnected or the replay buffer is inactive (soft skip). */
  saveBoundaryClip: (payload: {
    deliveryId: string;
    matchId: string;
    matchFolderStamp: string;
    battingTeamId: string | null;
    overNumber: number | null;
    ballNumber: number | null;
    sequence: number | null;
  }) => Promise<{ deliveryId: string; videoPath: string } | null>;
  playDeliveryClip: (payload: {
    videoPath: string;
    deliveryId?: string;
  }) => Promise<AscObsStatus>;
  /** Play any local media file on air via the shared Replay engine. */
  playFileOnAir: (filePath: string) => Promise<AscObsStatus>;
  buildHighlight: (payload: {
    matchId: string;
    matchFolderStamp: string;
    clipPaths: string[];
    kind: 'innings-1' | 'full-match';
  }) => Promise<AscInningsHighlightResult>;
  getHighlight: (payload: {
    matchId: string;
    matchFolderStamp: string;
    kind: 'innings-1' | 'full-match';
  }) => Promise<AscInningsHighlightResult>;
  /** @deprecated Prefer buildHighlight({ kind: 'innings-1' }). */
  buildInningsHighlight?: (payload: {
    matchId: string;
    matchFolderStamp: string;
    clipPaths: string[];
  }) => Promise<AscInningsHighlightResult>;
  /** @deprecated Prefer getHighlight({ kind: 'innings-1' }). */
  getInningsHighlight?: (matchId: string) => Promise<AscInningsHighlightResult>;
  returnToLive: () => Promise<AscObsStatus>;
  getConfig: () => Promise<AscObsConfig>;
  saveConfig: (config: AscObsConfig) => Promise<AscObsConfig>;
  onStatus: (callback: (status: AscObsStatus) => void) => () => void;
  onOpenSettings: (callback: () => void) => () => void;
}

export interface AscBroadcastApi {
  capabilities?: { obs?: boolean };
  /** Hide cockpit and show ASC Broadcast Match-ID entry (Electron panel only). */
  returnToBroadcastHome?: () => void;
  obs?: AscObsBridge;
}

declare global {
  interface Window {
    ascBroadcast?: AscBroadcastApi;
  }
}

export {};
