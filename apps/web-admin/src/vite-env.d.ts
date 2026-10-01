/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  /** Overlay app origin framed by the Overlay preview page. */
  readonly VITE_OVERLAY_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
