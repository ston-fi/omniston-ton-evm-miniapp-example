import { useQuery } from "@tanstack/react-query";

import type { Asset } from "~/constants";
import { fetchEvmWalletAssetBalance } from "~/lib/evm-api";
import { fetchTonWalletAssetBalance } from "~/lib/ton-api";

export function useWalletAssetBalance({
  asset,
  walletAddress,
}: {
  asset: Asset;
  walletAddress: string | null | undefined;
}) {
  const assetChain = asset.id.chain.$case;
  const assetAddress = asset.id.chain.value.kind.value;

  const enabled = !!walletAddress && !!assetChain && !!assetAddress;

  return useQuery({
    queryKey: [
      "wallet-asset-balance",
      `wallet-${walletAddress ?? "unknown"}`,
      `asset-${assetChain}:${assetAddress}`,
    ],
    enabled,
    queryFn: async () => {
      if (!walletAddress) {
        return null;
      }

      return assetChain === "ton"
        ? fetchTonWalletAssetBalance(walletAddress, assetAddress)
        : fetchEvmWalletAssetBalance(walletAddress, assetAddress, assetChain);
    },
  });
}
