import { miniApp, useSignal } from "@tma.js/sdk-react";
import { THEME, TonConnectUIProvider } from "@tonconnect/ui-react";
import * as React from "react";

export function TonConnectProvider({ children }: { children: React.ReactNode }) {
  const isDarkMode = useSignal(miniApp.isDark);

  return (
    <TonConnectUIProvider
      manifestUrl={
        import.meta.env.VITE_TONCONNECT_MANIFEST_URL ??
        new URL(`${import.meta.env.BASE_URL}tonconnect-manifest.json`, window.location.origin).href
      }
      uiPreferences={{
        theme: isDarkMode ? THEME.DARK : THEME.LIGHT,
      }}
    >
      {children}
    </TonConnectUIProvider>
  );
}
