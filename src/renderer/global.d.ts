import type { UltraXApi } from "@shared/electron-api";

declare global {
  interface Window {
    ultraX: UltraXApi;
  }
}

export {};
