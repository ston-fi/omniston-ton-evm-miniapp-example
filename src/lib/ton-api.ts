import { STON_API_BASE_URL } from "~/constants";

async function fetchStonApi<T>(path: string) {
  const response = await fetch(`${STON_API_BASE_URL}${path}`);

  if (!response.ok) {
    throw new Error(`STON.fi API request failed with status ${response.status}.`);
  }

  return (await response.json()) as T;
}

export async function fetchTonWalletAssetBalance(walletAddress: string, assetAddress: string) {
  const response = await fetchStonApi<{
    asset: {
      balance: string | null;
      contract_address: string;
      decimals: number;
      display_name: string | null;
      image_url: string | null;
      symbol: string;
      wallet_address: string | null;
    };
  }>(`/v1/wallets/${encodeURIComponent(walletAddress)}/assets/${encodeURIComponent(assetAddress)}`);

  return {
    balance: response.asset.balance,
  };
}
