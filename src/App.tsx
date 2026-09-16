import { MoveDown, MoveUp } from "lucide-react";
import { OmnistonProvider, Omniston } from "@ston-fi/omniston-sdk-react";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import * as React from "react";

import { DynamicSdkProvider } from "~/providers/dynamic-provider";
import { TelegramMiniAppProvider } from "~/providers/telegram-mini-app-provider";
import { TonConnectProvider } from "~/providers/ton-connect-provider";
import { WalletAuthProvider } from "~/providers/wallet-auth-provider";
import { OMNISTON_API_URL } from "~/constants";
import { TonWalletSection } from "~/components/ton-wallet-section";
import { DynamicWalletSection } from "~/components/dynamic-wallet-section";

export function App() {
  const [queryClient] = React.useState(() => new QueryClient());

  const [omniston] = React.useState(
    () =>
      new Omniston({
        apiUrl: OMNISTON_API_URL,
        logger: console,
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TelegramMiniAppProvider>
        <TonConnectProvider>
          <DynamicSdkProvider>
            <OmnistonProvider omniston={omniston}>
              <WalletAuthProvider>
                <main className="container mx-auto flex flex-col items-center p-4 *:w-full">
                  <TonWalletSection />
                  <div className="grid grid-cols-2 my-2">
                    <span className="flex justify-center">
                      <MoveDown className="size-4 text-muted-foreground" />
                    </span>
                    <span className="flex justify-center">
                      <MoveUp className="size-4 text-muted-foreground" />
                    </span>
                  </div>
                  <DynamicWalletSection />
                </main>
              </WalletAuthProvider>
            </OmnistonProvider>
          </DynamicSdkProvider>
        </TonConnectProvider>
      </TelegramMiniAppProvider>
    </QueryClientProvider>
  );
}
