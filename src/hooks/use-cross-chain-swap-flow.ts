import {
  createPublicClientFromNetworkData,
  createWalletClientForWalletAccount,
} from "@dynamic-labs-sdk/evm/viem";
import {
  getActiveNetworkData,
  getNetworksData,
  switchActiveNetwork,
} from "@dynamic-labs-sdk/client";
import type { EvmWalletAccount } from "@dynamic-labs-sdk/evm";
import { useDynamicClient, useGetWalletAccounts } from "@dynamic-labs-sdk/react-hooks";
import { useOmniston } from "@ston-fi/omniston-sdk-react";
import {
  isHtlcOrderQuote,
  type ChainAddress,
  type Order,
  type QuoteOfType,
  type RegisterSignedOrderRequest,
} from "@ston-fi/omniston-sdk-react";
import { useQueryClient } from "@tanstack/react-query";
import { useTonConnectUI } from "@tonconnect/ui-react";
import * as React from "react";
import {
  encodeAbiParameters,
  hexToBytes,
  parseAbi,
  parseAbiParameters,
  parseUnits,
  parseSignature,
  serializeCompactSignature,
  signatureToCompactSignature,
  type Address,
  type Hex,
} from "viem";

import {
  OMNISTON_INTEGRATOR_ADDRESS_ON_EVM,
  OMNISTON_INTEGRATOR_FEE_PIPS,
  OMNISTON_INTEGRATOR_ADDRESS_ON_TON,
  type Asset,
  TON_ASSET,
} from "~/constants";
import { useWalletAssetBalance } from "~/hooks/use-wallet-asset-balance";
import {
  createAssetChainAddress,
  ensureOrderQuote,
  generateHtlcHashlock,
  generateHtlcSecret,
  hexToBase64,
  isSuccessfulTradeStatus,
  isTerminalTradeStatus,
} from "~/lib/omniston";
import { formatAssetInputAmount, validateAssetAmountInput, ensureError } from "~/lib/utils";

type UseCrossChainSwapFlowOptions = {
  sourceAsset: Asset;
  sourceWalletAddress: string;
  destinationAsset: Asset;
  destinationWalletAddress: string;
};

type CrossChainSwapFlowState = {
  amount: string;
  error?: string;
  isQuoteLoading: boolean;
  isSwapSubmitting: boolean;
  quote: QuoteOfType<"order"> | null;
};

type OmnistonClient = ReturnType<typeof useOmniston>;
type TonConnectUiController = ReturnType<typeof useTonConnectUI>[0];
type DynamicSdkClient = ReturnType<typeof useDynamicClient>;
type DynamicWalletAccountSummary = Array<{ address: string; chain: string }>[number];
type DynamicEvmPermitWalletClient = Awaited<ReturnType<typeof createWalletClientForWalletAccount>>;

export type CrossChainSwapFlow = ReturnType<typeof useCrossChainSwapFlow>;

export function useCrossChainSwapFlow({
  sourceAsset,
  sourceWalletAddress,
  destinationAsset,
  destinationWalletAddress,
}: UseCrossChainSwapFlowOptions) {
  const queryClient = useQueryClient();
  const omnistonClient = useOmniston();
  const [tonConnectUI] = useTonConnectUI();

  const dynamicClient = useDynamicClient();
  const { data: dynamicWalletAccounts = [] } = useGetWalletAccounts();

  const sourceAssetBalanceQuery = useWalletAssetBalance({
    asset: sourceAsset,
    walletAddress: sourceWalletAddress,
  });
  const sourceAssetBalance = sourceAssetBalanceQuery.data?.balance;

  const [isAmountModalOpen, setIsAmountModalOpen] = React.useState(false);

  const [flowState, setFlowState] = React.useState<CrossChainSwapFlowState>(createInitialFlowState);

  const activeQuoteRequestIdRef = React.useRef(0);
  const isSwapSubmittingRef = React.useRef(flowState.isSwapSubmitting);

  React.useEffect(() => {
    isSwapSubmittingRef.current = flowState.isSwapSubmitting;
  }, [flowState.isSwapSubmitting]);

  const amountError = getCrossChainSwapAmountError({
    amount: flowState.amount,
    asset: sourceAsset,
    balance: sourceAssetBalance,
  });

  const invalidatePendingQuote = React.useCallback(() => {
    activeQuoteRequestIdRef.current += 1;
  }, []);

  const replaceAmountAndClearQuote = React.useCallback(
    (amount: string) => {
      invalidatePendingQuote();
      setFlowState((current) => ({
        ...current,
        amount,
        isQuoteLoading: false,
        quote: null,
      }));
    },
    [invalidatePendingQuote],
  );

  const resetClosedModalState = React.useCallback(() => {
    invalidatePendingQuote();
    setFlowState(createInitialFlowState());
  }, [invalidatePendingQuote]);

  const resetAfterSuccessfulSwap = React.useCallback(() => {
    invalidatePendingQuote();
    setFlowState(createInitialFlowState());
    setIsAmountModalOpen(false);
  }, [invalidatePendingQuote]);

  useManagedOrderQuote({
    amount: flowState.amount,
    amountError,
    inputAsset: sourceAsset,
    outputAsset: destinationAsset,
    isAmountModalOpen,
    isSwapSubmitting: flowState.isSwapSubmitting,
    omnistonClient,
    setFlowState,
    activeQuoteRequestIdRef,
  });

  const submitSwap = React.useCallback(async () => {
    if (!flowState.quote || amountError || flowState.isSwapSubmitting) {
      return;
    }

    setFlowState((current) => ({ ...current, isSwapSubmitting: true }));

    try {
      const closeAmountModalAfterWalletSign = () => {
        setIsAmountModalOpen(false);
      };

      if (sourceAsset.id.chain.value.kind.$case === "jetton") {
        await executeTonSourcedSwap({
          inputAsset: sourceAsset,
          inputWalletAddress: sourceWalletAddress,
          onWalletSigned: closeAmountModalAfterWalletSign,
          omnistonClient,
          outputAsset: destinationAsset,
          outputWalletAddress: destinationWalletAddress,
          quote: flowState.quote,
          tonConnectUiController: tonConnectUI,
        });
      } else if (sourceAsset.id.chain.value.kind.$case === "erc20") {
        await executeEvmSourcedSwap({
          dynamicSdkClient: dynamicClient,
          inputAsset: sourceAsset,
          inputWalletAddress: sourceWalletAddress,
          onWalletSigned: closeAmountModalAfterWalletSign,
          omnistonClient,
          outputAsset: destinationAsset,
          outputWalletAddress: destinationWalletAddress,
          quote: flowState.quote,
          dynamicWalletAccounts,
        });
      } else {
        throw new Error("Unsupported source asset kind.");
      }

      await queryClient.invalidateQueries({ queryKey: ["wallet-asset-balance"] });
      resetAfterSuccessfulSwap();
    } catch (error) {
      setFlowState((current) => ({
        ...current,
        error: ensureError(error, "The cross-chain swap failed.").message,
        isSwapSubmitting: false,
      }));
    }
  }, [
    amountError,
    dynamicClient,
    dynamicWalletAccounts,
    flowState.isSwapSubmitting,
    flowState.quote,
    sourceAsset,
    sourceWalletAddress,
    omnistonClient,
    destinationAsset,
    destinationWalletAddress,
    queryClient,
    resetAfterSuccessfulSwap,
    tonConnectUI,
  ]);

  return {
    amount: flowState.amount,
    amountError,
    sourceAsset,
    sourceAssetBalance,
    fillMaxAmount: () => {
      if (!sourceAssetBalance) {
        return;
      }

      replaceAmountAndClearQuote(
        formatAssetInputAmount(sourceAssetBalance, sourceAsset.meta.decimals),
      );
    },
    isAmountModalOpen,
    isBusy: flowState.isQuoteLoading || flowState.isSwapSubmitting,
    isQuoteLoading: flowState.isQuoteLoading,
    isSwapSubmitting: flowState.isSwapSubmitting,
    openAmountModal: () => setIsAmountModalOpen(true),
    destinationAsset,
    quoteOutputUnits: flowState.quote?.outputUnits ?? null,
    swapError: flowState.error,
    setAmount: replaceAmountAndClearQuote,
    setAmountModalOpen: (open: boolean) => {
      if (!open && isSwapSubmittingRef.current) {
        return;
      }

      if (!open) {
        resetClosedModalState();
      }

      setIsAmountModalOpen(open);
    },
    submitSwap,
    submitDisabled:
      Boolean(amountError) ||
      Boolean(flowState.error && !flowState.quote?.outputUnits) ||
      flowState.isQuoteLoading ||
      flowState.isSwapSubmitting ||
      !flowState.quote?.outputUnits,
  };
}

function createInitialFlowState(): CrossChainSwapFlowState {
  return {
    amount: "",
    isQuoteLoading: false,
    isSwapSubmitting: false,
    quote: null,
  };
}

function getCrossChainSwapAmountError({
  amount,
  asset,
  balance,
}: {
  amount: string;
  asset: Asset;
  balance?: string | null;
}) {
  if (!amount.trim()) {
    return null;
  }

  return validateAssetAmountInput(amount, {
    balance,
    decimals: asset.meta.decimals,
    symbol: asset.meta.symbol,
  });
}

function useManagedOrderQuote({
  amount,
  amountError,
  inputAsset,
  isAmountModalOpen,
  isSwapSubmitting,
  omnistonClient,
  outputAsset,
  activeQuoteRequestIdRef,
  setFlowState,
}: {
  amount: string;
  amountError: string | null;
  inputAsset: Asset;
  isAmountModalOpen: boolean;
  isSwapSubmitting: boolean;
  omnistonClient: OmnistonClient;
  outputAsset: Asset;
  activeQuoteRequestIdRef: React.MutableRefObject<number>;
  setFlowState: React.Dispatch<React.SetStateAction<CrossChainSwapFlowState>>;
}) {
  React.useEffect(() => {
    if (
      !shouldRequestOrderQuote({
        amount,
        amountError,
        isAmountModalOpen,
        isSwapSubmitting,
      })
    ) {
      clearActiveQuote(setFlowState);
      return;
    }

    const quoteRequestId = ++activeQuoteRequestIdRef.current;
    const timeoutId = window.setTimeout(() => {
      setFlowState((current) => ({ ...current, isQuoteLoading: true, quote: null }));

      void requestOrderQuote({
        amount,
        inputAsset,
        omnistonClient,
        outputAsset,
      })
        .then((orderQuote) => {
          if (activeQuoteRequestIdRef.current !== quoteRequestId) {
            return;
          }

          setFlowState((current) => ({
            ...current,
            isQuoteLoading: false,
            quote: orderQuote,
          }));
        })
        .catch((error) => {
          if (activeQuoteRequestIdRef.current !== quoteRequestId) {
            return;
          }

          setFlowState((current) => ({
            ...current,
            error: ensureError(error, "Unable to fetch quote.").message,
            isQuoteLoading: false,
            quote: null,
          }));
        });
    }, 350);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    amount,
    amountError,
    inputAsset,
    isAmountModalOpen,
    isSwapSubmitting,
    omnistonClient,
    outputAsset,
    activeQuoteRequestIdRef,
    setFlowState,
  ]);
}

function shouldRequestOrderQuote({
  amount,
  amountError,
  isAmountModalOpen,
  isSwapSubmitting,
}: {
  amount: string;
  amountError: string | null;
  isAmountModalOpen: boolean;
  isSwapSubmitting: boolean;
}) {
  return Boolean(isAmountModalOpen && amount && !amountError && !isSwapSubmitting);
}

function clearActiveQuote(
  setFlowState: React.Dispatch<React.SetStateAction<CrossChainSwapFlowState>>,
) {
  setFlowState((current) =>
    current.isQuoteLoading || current.quote
      ? { ...current, isQuoteLoading: false, quote: null }
      : current,
  );
}

function requestOrderQuote({
  amount,
  inputAsset,
  omnistonClient,
  outputAsset,
}: {
  amount: string;
  inputAsset: Asset;
  omnistonClient: OmnistonClient;
  outputAsset: Asset;
}) {
  const integratorAddressString =
    outputAsset === TON_ASSET
      ? OMNISTON_INTEGRATOR_ADDRESS_ON_TON
      : OMNISTON_INTEGRATOR_ADDRESS_ON_EVM;

  return new Promise<QuoteOfType<"order">>((resolve, reject) => {
    const quoteStream = omnistonClient.requestForQuote({
      inputAsset: inputAsset.id,
      outputAsset: outputAsset.id,
      amount: {
        $case: "inputUnits",
        value: parseUnits(amount, inputAsset.meta.decimals).toString(),
      },
      integratorAddress: integratorAddressString
        ? {
            chain: {
              $case: outputAsset.id.chain.$case,
              value: integratorAddressString,
            },
          }
        : undefined,
      integratorFeePips: integratorAddressString ? OMNISTON_INTEGRATOR_FEE_PIPS : undefined,
      settlementParams: [
        {
          params: {
            $case: "order",
            value: {},
          },
        },
      ],
    });
    const cleanup = () => {
      subscription.unsubscribe();
    };

    const subscription = quoteStream.subscribe({
      next: (event) => {
        if (event?.$case === "quoteUpdated") {
          cleanup();
          resolve(ensureOrderQuote(event.value));
          return;
        }

        if (event?.$case === "noQuote") {
          cleanup();
          reject(new Error("No Omniston quote is currently available for this route."));
        }
      },
      error: (error) => {
        cleanup();
        reject(error);
      },
      complete: () => {
        cleanup();
        reject(new Error("Omniston quote stream closed before a quote was received."));
      },
    });
  });
}

async function executeTonSourcedSwap({
  inputAsset,
  inputWalletAddress,
  onWalletSigned,
  omnistonClient,
  outputAsset,
  outputWalletAddress,
  quote,
  tonConnectUiController,
}: {
  inputAsset: Asset;
  inputWalletAddress: string;
  onWalletSigned: () => void;
  omnistonClient: OmnistonClient;
  outputAsset: Asset;
  outputWalletAddress: string;
  quote: QuoteOfType<"order">;
  tonConnectUiController: TonConnectUiController;
}) {
  const sourceAddress = createAssetChainAddress(inputAsset, inputWalletAddress);
  const destinationAddress = createAssetChainAddress(outputAsset, outputWalletAddress);
  const { htlcSecrets, transaction } = await buildTonEscrowTransferForSwap({
    destinationAddress,
    omnistonClient,
    quote,
    sourceAddress,
  });

  await tonConnectUiController.sendTransaction({
    validUntil: Math.floor(Date.now() / 1000) + 5 * 60,
    from: tonConnectUiController.account?.address,
    messages: transaction.messages.map((message) => ({
      address: message.targetAddress,
      amount: message.sendAmount,
      payload: hexToBase64(message.payload),
      stateInit: message.jettonWalletStateInit
        ? hexToBase64(message.jettonWalletStateInit)
        : undefined,
    })),
  });
  onWalletSigned();

  await waitForTrackedOrderSettlement({
    htlcSecrets,
    inputAsset,
    inputWalletAddress,
    omnistonClient,
    quote,
  });
}

async function executeEvmSourcedSwap({
  dynamicSdkClient,
  inputAsset,
  inputWalletAddress,
  onWalletSigned,
  omnistonClient,
  outputAsset,
  outputWalletAddress,
  quote,
  dynamicWalletAccounts,
}: {
  dynamicSdkClient: DynamicSdkClient;
  inputAsset: Asset;
  inputWalletAddress: string;
  onWalletSigned: () => void;
  omnistonClient: OmnistonClient;
  outputAsset: Asset;
  outputWalletAddress: string;
  quote: QuoteOfType<"order">;
  dynamicWalletAccounts: DynamicWalletAccountSummary[];
}) {
  const dynamicEvmSourceWalletAccount = getAuthorizedDynamicEvmWalletAccount(
    dynamicWalletAccounts,
    inputWalletAddress,
  );

  if (!dynamicEvmSourceWalletAccount) {
    throw new Error("Dynamic wallet account is unavailable.");
  }

  const { activeEvmPublicClient, dynamicEvmPermitWalletClient } = await prepareDynamicEvmClients({
    dynamicSdkClient,
    inputAsset,
    dynamicEvmWalletAccount: dynamicEvmSourceWalletAccount,
  });

  const sourceAddress = createAssetChainAddress(inputAsset, inputWalletAddress);
  const destinationAddress = createAssetChainAddress(outputAsset, outputWalletAddress);
  const { htlcSecrets, registerRequest } = await buildSignedOrderRegistration({
    inputAsset,
    omnistonClient,
    activeEvmPublicClient,
    quote,
    dynamicEvmPermitWalletClient,
    inputWalletAddress: sourceAddress,
    outputWalletAddress: destinationAddress,
  });

  onWalletSigned();
  await omnistonClient.orderRegisterSignedOrder(registerRequest);
  await waitForTrackedOrderSettlement({
    htlcSecrets,
    inputAsset,
    inputWalletAddress,
    omnistonClient,
    quote,
  });
}

function getAuthorizedDynamicEvmWalletAccount(
  dynamicWalletAccounts: DynamicWalletAccountSummary[],
  inputWalletAddress: string,
) {
  return (dynamicWalletAccounts.find(
    (dynamicWalletAccount) =>
      dynamicWalletAccount.chain.toLowerCase() === "evm" &&
      dynamicWalletAccount.address.toLowerCase() === inputWalletAddress.toLowerCase(),
  ) ?? null) as EvmWalletAccount | null;
}

async function prepareDynamicEvmClients({
  dynamicSdkClient,
  inputAsset,
  dynamicEvmWalletAccount,
}: {
  dynamicSdkClient: DynamicSdkClient;
  inputAsset: Asset;
  dynamicEvmWalletAccount: EvmWalletAccount;
}) {
  await switchDynamicWalletToSourceChain({
    chain: inputAsset.id.chain.$case,
    dynamicSdkClient,
    dynamicEvmWalletAccount,
  });

  const { networkData } = await getActiveNetworkData(
    {
      walletAccount: dynamicEvmWalletAccount,
    },
    dynamicSdkClient,
  );

  if (!networkData) {
    throw new Error("Active Dynamic network data is unavailable.");
  }

  return {
    activeEvmPublicClient: createPublicClientFromNetworkData({ networkData }),
    dynamicEvmPermitWalletClient: await createWalletClientForWalletAccount(
      {
        walletAccount: dynamicEvmWalletAccount as never,
      },
      dynamicSdkClient,
    ),
  };
}

async function switchDynamicWalletToSourceChain({
  chain,
  dynamicSdkClient,
  dynamicEvmWalletAccount,
}: {
  chain: string;
  dynamicSdkClient: DynamicSdkClient;
  dynamicEvmWalletAccount: EvmWalletAccount;
}) {
  await switchActiveNetwork(
    {
      networkId: findConfiguredDynamicEvmNetwork(dynamicSdkClient, chain).networkId,
      walletAccount: dynamicEvmWalletAccount,
    },
    dynamicSdkClient,
  );
}

function findConfiguredDynamicEvmNetwork(dynamicSdkClient: DynamicSdkClient, chain: string) {
  const normalizedChain = chain.trim().toLowerCase();

  const network = getNetworksData(dynamicSdkClient).find((networkData) => {
    if (networkData.chain.toLowerCase() !== "evm") {
      return false;
    }

    const candidates = [networkData.displayName, networkData.name]
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.toLowerCase());

    return candidates.some((value) => value.includes(normalizedChain));
  });

  if (!network) {
    throw new Error(
      `Dynamic EVM network for chain "${chain}" is not configured. Please ensure the network is enabled in your Dynamic dashboard https://app.dynamic.xyz/dashboard/chains-and-networks and try again.`,
    );
  }

  return network;
}

const ERC20_NONCES_ABI = parseAbi(["function nonces(address owner) view returns (uint256)"]);

const EIP2612_PERMIT_TYPES = {
  Permit: [
    { name: "owner", type: "address" },
    { name: "spender", type: "address" },
    { name: "value", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

const EIP2612_PERMIT_PARAMETERS = parseAbiParameters(
  "address owner, address spender, uint256 value, uint256 nonce, uint256 deadline",
);

async function buildEip2612PermitData({
  asset,
  ownerAddress,
  activeEvmPublicClient,
  quote,
  dynamicEvmPermitWalletClient,
}: {
  asset: Asset;
  ownerAddress: Address;
  activeEvmPublicClient: ReturnType<typeof createPublicClientFromNetworkData>;
  quote: QuoteOfType<"order">;
  dynamicEvmPermitWalletClient: DynamicEvmPermitWalletClient;
}) {
  if (!isHtlcOrderQuote(quote)) {
    throw new Error("Only HTLC-backed cross-chain order quotes can be authorized with EIP-2612.");
  }

  if (asset.id.chain.value.kind.$case !== "erc20") {
    throw new Error("EIP-2612 permit flow is only supported for ERC-20 assets.");
  }

  const permitConfig = (() => {
    if ("permit" in asset) {
      return asset.permit;
    }

    throw new Error("EIP-2612 permit config is missing for the asset.");
  })();

  const tokenAddress = asset.id.chain.value.kind.value as Address;
  const spenderAddress = quote.settlementData.value.srcProtocolContractAddress.chain
    .value as Address;
  const nonce = await activeEvmPublicClient.readContract({
    address: tokenAddress,
    abi: ERC20_NONCES_ABI,
    functionName: "nonces",
    args: [ownerAddress],
  });
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 60);
  const permitMessage = {
    owner: ownerAddress,
    spender: spenderAddress,
    value: BigInt(quote.inputUnits),
    nonce,
    deadline,
  };

  const permitSignature = await dynamicEvmPermitWalletClient.signTypedData({
    domain: permitConfig.domain,
    types: EIP2612_PERMIT_TYPES,
    primaryType: "Permit",
    message: permitMessage,
    account: dynamicEvmPermitWalletClient.account,
  });

  return {
    encodedPermitData: encodeEip2612PermitData(permitMessage),
    permitSignature: hexToBytes(permitSignature),
    usePermit2: false as const,
  };
}

function encodeEip2612PermitData(message: {
  owner: Address;
  spender: Address;
  value: bigint;
  nonce: bigint;
  deadline: bigint;
}) {
  return hexToBytes(
    encodeAbiParameters(EIP2612_PERMIT_PARAMETERS, [
      message.owner,
      message.spender,
      message.value,
      message.nonce,
      message.deadline,
    ]),
  );
}

async function buildSignedOrderRegistration({
  inputAsset,
  omnistonClient,
  activeEvmPublicClient,
  quote,
  dynamicEvmPermitWalletClient,
  inputWalletAddress,
  outputWalletAddress,
}: {
  inputAsset: Asset;
  omnistonClient: OmnistonClient;
  activeEvmPublicClient: ReturnType<typeof createPublicClientFromNetworkData>;
  quote: QuoteOfType<"order">;
  dynamicEvmPermitWalletClient: DynamicEvmPermitWalletClient;
  inputWalletAddress: ChainAddress;
  outputWalletAddress: ChainAddress;
}) {
  if (!isHtlcOrderQuote(quote)) {
    throw new Error(
      "Only HTLC-backed cross-chain order quotes are supported for EVM-sourced swaps.",
    );
  }

  const htlcSecrets = Array.from({ length: 4 }, generateHtlcSecret);
  const permitData = await buildEip2612PermitData({
    asset: inputAsset,
    ownerAddress: inputWalletAddress.chain.value as Address,
    activeEvmPublicClient,
    quote,
    dynamicEvmPermitWalletClient,
  });

  const evmOrderPayload = await omnistonClient.evmBuildOrderPayload({
    quoteId: quote.quoteId,
    ownerSrcAddress: inputWalletAddress,
    traderDstAddress: outputWalletAddress,
    traderDstDiscloseAddress: outputWalletAddress,
    ...permitData,
    htlcSecrets: {
      secretMode: {
        $case: "provided",
        value: {
          hashes: htlcSecrets.map((secret) =>
            generateHtlcHashlock(secret, quote.settlementData.value.htlcHashingFunction),
          ),
        },
      },
    },
  });

  const orderTypedData = JSON.parse(evmOrderPayload.typedData) as {
    domain: {
      chainId: number | string;
      verifyingContract: `0x${string}`;
    };
    message: {
      makerAsset: `0x${string}`;
    };
    primaryType: string;
    types: Record<string, Array<{ name: string; type: string }>>;
  };

  const chainId = Number(orderTypedData.domain.chainId);

  const orderSignature = await dynamicEvmPermitWalletClient.signTypedData({
    ...orderTypedData,
    domain: {
      ...orderTypedData.domain,
      chainId,
    },
    account: dynamicEvmPermitWalletClient.account,
  });

  const registerRequest: RegisterSignedOrderRequest = {
    quoteId: quote.quoteId,
    ownerSrcAddress: inputWalletAddress,
    signedOrder: {
      order: {
        $case: "evmV1",
        value: {
          encodedOrder: encodeTypedData(orderTypedData),
          signature: encodeCompactSignature(orderSignature),
          orderExtension: evmOrderPayload.orderExtension,
        },
      },
    },
    serializedOrderDetails: evmOrderPayload.serializedOrderDetails,
  };

  return {
    htlcSecrets,
    registerRequest,
  };
}

async function waitForTrackedOrderSettlement({
  htlcSecrets,
  inputAsset,
  inputWalletAddress,
  omnistonClient,
  quote,
}: {
  htlcSecrets?: Uint8Array[];
  inputAsset: Asset;
  inputWalletAddress: string;
  omnistonClient: OmnistonClient;
  quote: QuoteOfType<"order">;
}) {
  const revealedSecrets = Array.from({ length: htlcSecrets?.length ?? 0 }, () => false);
  const stream = await omnistonClient.orderTrack({
    quoteId: quote.quoteId,
    traderAddress: createAssetChainAddress(inputAsset, inputWalletAddress),
  });

  return new Promise<void>((resolve, reject) => {
    const subscription = stream.subscribe({
      next: (event) => {
        if (event?.$case !== "order") {
          return;
        }

        const order: Order = event.value;

        if (htlcSecrets) {
          discloseReadyHtlcSecrets({
            htlcSecrets,
            omnistonClient,
            quoteId: quote.quoteId,
            revealedSecrets,
            executions: order.executions,
          });
        }

        if (!isTerminalTradeStatus(order.status)) {
          return;
        }

        subscription.unsubscribe();

        if (isSuccessfulTradeStatus(order.status)) {
          resolve();
          return;
        }

        reject(new Error(`Omniston order settlement ended with status ${order.status}.`));
      },
      error: reject,
    });
  });
}

async function buildTonEscrowTransferForSwap({
  destinationAddress,
  omnistonClient,
  quote,
  sourceAddress,
}: {
  destinationAddress: ChainAddress;
  omnistonClient: OmnistonClient;
  quote: QuoteOfType<"order">;
  sourceAddress: ChainAddress;
}) {
  if (isHtlcOrderQuote(quote)) {
    const htlcSecrets = Array.from({ length: 4 }, generateHtlcSecret);

    return {
      htlcSecrets,
      transaction: await omnistonClient.tonBuildEscrowTransfer({
        quoteId: quote.quoteId,
        transferSrcAddress: sourceAddress,
        refundSrcAddress: sourceAddress,
        gasExcessAddress: sourceAddress,
        traderDstAddress: destinationAddress,
        traderDstDiscloseAddress: destinationAddress,
        ownerSrcAddress: sourceAddress,
        htlcSecrets: {
          secretMode: {
            $case: "provided",
            value: {
              hashes: htlcSecrets.map((secret) =>
                generateHtlcHashlock(secret, quote.settlementData.value.htlcHashingFunction),
              ),
            },
          },
        },
      }),
    };
  }

  return {
    htlcSecrets: undefined,
    transaction: await omnistonClient.tonBuildEscrowTransfer({
      quoteId: quote.quoteId,
      transferSrcAddress: sourceAddress,
      refundSrcAddress: sourceAddress,
      gasExcessAddress: sourceAddress,
      traderDstAddress: destinationAddress,
      ownerSrcAddress: sourceAddress,
    }),
  };
}

function discloseReadyHtlcSecrets({
  executions,
  htlcSecrets,
  omnistonClient,
  quoteId,
  revealedSecrets,
}: {
  executions: Order["executions"];
  htlcSecrets: Uint8Array[];
  omnistonClient: OmnistonClient;
  quoteId: string;
  revealedSecrets: boolean[];
}) {
  executions.forEach((execution, index) => {
    const secret = htlcSecrets[index];

    if (!secret || revealedSecrets[index] || !execution.outputPositionPhase) {
      return;
    }

    void omnistonClient.orderDiscloseHtlcSecret({
      quoteId,
      executionIndex: index,
      secret,
    });

    revealedSecrets[index] = true;
  });
}

function encodeCompactSignature(signature: Hex) {
  const parsedSignature = parseSignature(signature);
  const compactSignature = signatureToCompactSignature(parsedSignature);

  return hexToBytes(serializeCompactSignature(compactSignature));
}

function encodeTypedData(typedData: {
  message: Record<string, unknown>;
  primaryType: string;
  types: Record<string, Array<{ name: string; type: string }>>;
}) {
  return hexToBytes(
    encodeAbiParameters(
      typedData.types[typedData.primaryType],
      typedData.types[typedData.primaryType].map((item) => typedData.message[item.name]),
    ),
  );
}
