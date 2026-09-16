/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the tablet app's box API. Empty means "no live source". */
  readonly VITE_API_BASE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv & { readonly DEV: boolean; readonly PROD: boolean }
}
