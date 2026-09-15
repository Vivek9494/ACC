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

export interface AscObsBridge {
  getStatus: () => Promise<AscObsStatus>;
  connect: () => Promise<AscObsStatus>;
  disconnect: () => Promise<AscObsStatus>;
  startStream: () => Promise<AscObsStatus>;
  stopStream: () => Promise<AscObsStatus>;
  startReplayBuffer: () => Promise<AscObsStatus>;
  startInstantReplay: () => Promise<AscObsStatus>;
  saveBoundaryClip: (deliveryId: string) => Promise<{ deliveryId: string; videoPath: string }>;
  playDeliveryClip: (payload: {
    videoPath: string;
    deliveryId?: string;
  }) => Promise<AscObsStatus>;
  returnToLive: () => Promise<AscObsStatus>;
  getConfig: () => Promise<AscObsConfig>;
  saveConfig: (config: AscObsConfig) => Promise<AscObsConfig>;
  onStatus: (callback: (status: AscObsStatus) => void) => () => void;
  onOpenSettings: (callback: () => void) => () => void;
}

export interface AscBroadcastApi {
  capabilities?: { obs?: boolean };
  obs?: AscObsBridge;
}

declare global {
  interface Window {
    ascBroadcast?: AscBroadcastApi;
  }
}

export {};
