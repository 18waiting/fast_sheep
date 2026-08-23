// Ambient typing for the context-isolated preload surface (M6).
// The renderer only ever sees `window.fastworkDesktop` (narrow typed API).
import type { FastWorkDesktopAPI } from "@fastwork/desktop-ipc";

declare global {
  interface Window {
    fastworkDesktop: FastWorkDesktopAPI;
  }
}

export {};
