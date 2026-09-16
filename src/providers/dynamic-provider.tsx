import { createDynamicClient, initializeClient } from "@dynamic-labs-sdk/client";
import { addWaasEvmExtension } from "@dynamic-labs-sdk/evm/waas";
import { DynamicProvider } from "@dynamic-labs-sdk/react-hooks";
import { addTonConnectExtension } from "@dynamic-labs-sdk/ton/ton-connect";
import { useTonConnectUI } from "@tonconnect/ui-react";
import * as React from "react";

export function DynamicSdkProvider({ children }: { children: React.ReactNode }) {
  const [tonConnectUI] = useTonConnectUI();
  const [dynamicClient] = React.useState(() => {
    const client = createDynamicClient({
      autoInitialize: false,
      environmentId: import.meta.env.VITE_DYNAMIC_ENVIRONMENT_ID,
      metadata: {
        name: "STON.fi Demo MiniApp",
        universalLink: new URL(import.meta.env.BASE_URL, window.location.origin).href,
      },
    });

    addTonConnectExtension({ tonConnectUI: tonConnectUI as any }, client);
    addWaasEvmExtension(client);

    void initializeClient(client);

    return client;
  });

  return <DynamicProvider client={dynamicClient}>{children}</DynamicProvider>;
}
