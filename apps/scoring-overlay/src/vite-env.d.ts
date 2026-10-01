/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Web-admin origin allowed to drive /preview.html via postMessage. */
  readonly VITE_DASHBOARD_ORIGIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
