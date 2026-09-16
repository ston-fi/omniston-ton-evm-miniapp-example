import { createPublicClient, erc20Abi, http, type Address, type Chain } from "viem";
import * as viemChains from "viem/chains";

function normalizeChainName(chain: string) {
  return chain
    .trim()
    .replace(/[-_\s]+(.)?/g, (_, next: string | undefined) => next?.toUpperCase() ?? "");
}

function getViemChain(chain: string): Chain {
  const normalizedChain = normalizeChainName(chain);
  const viemChain = (viemChains as Record<string, Chain | undefined>)[normalizedChain];

  if (!viemChain) {
    throw new Error(`Unsupported viem chain: ${chain}.`);
  }

  return viemChain;
}

function getViemChainById(chainId: number): Chain {
  const viemChain = (Object.values(viemChains) as Chain[]).find((chain) => chain.id === chainId);

  if (!viemChain) {
    throw new Error(`Unsupported viem chain id: ${chainId}.`);
  }

  return viemChain;
}

export async function fetchEvmWalletAssetBalance(
  walletAddress: string,
  assetAddress: string,
  chain: string,
) {
  const publicClient = createPublicClient({
    chain: getViemChain(chain),
    transport: http(),
  });
  const balance = await publicClient.readContract({
    address: assetAddress as Address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [walletAddress as Address],
  });

  return {
    balance: balance.toString(),
  };
}

export async function fetchEvmWalletAssetBalanceByChainId(
  walletAddress: string,
  assetAddress: string,
  chainId: number,
) {
  const publicClient = createPublicClient({
    chain: getViemChainById(chainId),
    transport: http(),
  });
  const balance = await publicClient.readContract({
    address: assetAddress as Address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [walletAddress as Address],
  });

  return {
    balance: balance.toString(),
  };
}
