import {
  connectWithWalletProvider,
  getWalletAccounts,
  verifyWalletAccount,
} from "@dynamic-labs-sdk/client";
import {
  getNonce,
  getWalletProviders,
  waitForProjectSettings,
} from "@dynamic-labs-sdk/client/core";
import {
  createWaasWalletAccounts,
  getChainsMissingWaasWalletAccounts,
} from "@dynamic-labs-sdk/client/waas";
import {
  useDynamicClient,
  useGetWalletAccounts as useDynamicGetWalletAccounts,
  useInitStatus as useDynamicInitStatus,
  useLogout as useDynamicLogout,
  useUser as useDynamicUser,
} from "@dynamic-labs-sdk/react-hooks";
import { useTonConnectUI, useTonWallet } from "@tonconnect/ui-react";
import * as React from "react";

type WalletAuthState =
  | { status: "initial" }
  | { status: "restoring-ton-session" }
  | { status: "getting-dynamic-nonce" }
  | { status: "waiting-ton-wallet" }
  | { status: "authorizing-with-dynamic" }
  | { status: "creating-evm-wallet" }
  | { status: "unauthorized" }
  | { status: "authorized"; evmAddress: string; tonAddress: string }
  | { status: "error"; error: Error };

type WalletAuthAction =
  | { type: "set_restoring_ton_session" }
  | { type: "set_getting_dynamic_nonce" }
  | { type: "set_waiting_ton_wallet" }
  | { type: "set_authorizing_with_dynamic" }
  | { type: "set_creating_evm_wallet" }
  | { type: "set_unauthorized" }
  | { type: "set_authorized"; evmAddress: string; tonAddress: string }
  | { type: "set_error"; error: Error }
  | { type: "reset" };

export type WalletAuthContextValue =
  | { status: "initial" }
  | { status: "restoring-ton-session" }
  | { status: "getting-dynamic-nonce" }
  | { status: "waiting-ton-wallet" }
  | { status: "authorizing-with-dynamic" }
  | { status: "creating-evm-wallet" }
  | { status: "unauthorized"; openAuthModal: () => Promise<void> }
  | { status: "authorized"; evmAddress: string; logout: () => Promise<void>; tonAddress: string }
  | { status: "error"; error: Error; retry: () => Promise<void> };

const WalletAuthContext = React.createContext<WalletAuthContextValue | null>(null);

function walletAuthReducer(state: WalletAuthState, action: WalletAuthAction): WalletAuthState {
  switch (action.type) {
    case "set_restoring_ton_session":
      return { status: "restoring-ton-session" };
    case "set_getting_dynamic_nonce":
      return { status: "getting-dynamic-nonce" };
    case "set_waiting_ton_wallet":
      return { status: "waiting-ton-wallet" };
    case "set_authorizing_with_dynamic":
      return { status: "authorizing-with-dynamic" };
    case "set_creating_evm_wallet":
      return { status: "creating-evm-wallet" };
    case "set_unauthorized":
      return { status: "unauthorized" };
    case "set_authorized":
      return {
        status: "authorized",
        evmAddress: action.evmAddress,
        tonAddress: action.tonAddress,
      };
    case "set_error":
      return { status: "error", error: action.error };
    case "reset":
      return { status: "initial" };
  }
}

function getError(error: unknown, fallback: string) {
  return error instanceof Error ? error : new Error(fallback);
}

function getTonWalletProviderKey(dynamicClient: ReturnType<typeof useDynamicClient>) {
  const tonWalletProvider = getWalletProviders(dynamicClient).find((provider) =>
    hasChain(provider.chain, "ton"),
  );

  if (!tonWalletProvider) {
    throw new Error("Dynamic TON wallet provider is unavailable.");
  }

  return tonWalletProvider.key;
}

function getConnectedTonWalletProviderKey(
  dynamicClient: ReturnType<typeof useDynamicClient>,
  tonWallet: NonNullable<ReturnType<typeof useTonWallet>>,
) {
  const tonWalletProviders = getWalletProviders(dynamicClient).filter((provider) =>
    hasChain(provider.chain, "ton"),
  );
  const selectedWalletNames = [
    "appName" in tonWallet && typeof tonWallet.appName === "string" ? tonWallet.appName : null,
    typeof tonWallet.device?.appName === "string" ? tonWallet.device.appName : null,
  ]
    .filter((name): name is string => Boolean(name))
    .map((name) => name.toLowerCase());

  const matchingProvider = tonWalletProviders.find((provider) =>
    selectedWalletNames.includes(provider.metadata.displayName.toLowerCase()),
  );

  if (matchingProvider) {
    return matchingProvider.key;
  }

  return getTonWalletProviderKey(dynamicClient);
}

function getEvmWalletAddress(
  walletAccounts: ReturnType<typeof useDynamicGetWalletAccounts>["data"] = [],
) {
  return (
    walletAccounts.find((walletAccount) => hasChain(walletAccount.chain, "evm"))?.address ?? null
  );
}

export function WalletAuthProvider({ children }: { children: React.ReactNode }) {
  const tonWallet = useTonWallet();
  const [tonConnectUI] = useTonConnectUI();

  const dynamicClient = useDynamicClient();
  const { data: dynamicInitStatus } = useDynamicInitStatus();
  const { data: dynamicUser } = useDynamicUser();
  const { data: dynamicWalletAccounts = [] } = useDynamicGetWalletAccounts();
  const { mutateAsync: dynamicLogout } = useDynamicLogout();

  const [state, dispatch] = React.useReducer(walletAuthReducer, { status: "initial" });

  const authFlowPromiseRef = React.useRef<Promise<void> | null>(null);
  const authNonceRef = React.useRef<string | null>(null);
  const autoProvisionAttemptedRef = React.useRef(false);
  const provisionPromiseRef = React.useRef<Promise<string> | null>(null);

  const tonAddress = tonWallet?.account.address ?? null;
  const evmAddress = dynamicUser ? getEvmWalletAddress(dynamicWalletAccounts) : null;

  const clearTonProofRequest = React.useCallback(() => {
    authNonceRef.current = null;
    tonConnectUI.setConnectRequestParameters(null);
  }, [tonConnectUI]);

  const ensureEvmWallet = React.useCallback(async () => {
    if (provisionPromiseRef.current) {
      return provisionPromiseRef.current;
    }

    const promise = (async () => {
      dispatch({ type: "set_creating_evm_wallet" });

      await waitForProjectSettings(dynamicClient);

      const missingEvmChains = getChainsMissingWaasWalletAccounts(dynamicClient).filter((chain) =>
        hasChain(chain, "evm"),
      );

      if (missingEvmChains.length > 0) {
        await createWaasWalletAccounts({ chains: missingEvmChains }, dynamicClient);
      }

      const nextEvmAddress = getEvmWalletAddress(getWalletAccounts(dynamicClient));

      if (!nextEvmAddress) {
        throw new Error("Dynamic EVM WaaS wallet is missing after provisioning.");
      }

      return nextEvmAddress;
    })();

    provisionPromiseRef.current = promise;

    try {
      return await promise;
    } finally {
      provisionPromiseRef.current = null;
    }
  }, [dynamicClient]);

  const completeTonWalletAuth = React.useCallback(
    async (selectedTonWallet: NonNullable<ReturnType<typeof useTonWallet>>) => {
      const authNonce = authNonceRef.current;

      if (!authNonce) {
        throw new Error("Dynamic auth nonce is missing.");
      }

      dispatch({ type: "set_authorizing_with_dynamic" });

      const walletProviderKey = getConnectedTonWalletProviderKey(dynamicClient, selectedTonWallet);
      const tonWalletProvider = getWalletProviders(dynamicClient).find(
        (provider) => provider.key === walletProviderKey,
      );

      if (!tonWalletProvider) {
        throw new Error("Dynamic TON wallet provider is unavailable.");
      }

      const originalGetConnectProofNonce = tonWalletProvider.getConnectProofNonce;

      tonWalletProvider.getConnectProofNonce = () => authNonce;

      try {
        const tonWalletAccount = await connectWithWalletProvider(
          {
            addToDynamicWalletAccounts: false,
            walletProviderKey,
          },
          dynamicClient,
        );
        const verifiedTonWalletAccount = await verifyWalletAccount(
          {
            walletAccount: tonWalletAccount,
          },
          dynamicClient,
        );
        const nextEvmAddress = await ensureEvmWallet();

        dispatch({
          type: "set_authorized",
          evmAddress: nextEvmAddress,
          tonAddress: verifiedTonWalletAccount.address,
        });
      } finally {
        tonWalletProvider.getConnectProofNonce = originalGetConnectProofNonce;
        clearTonProofRequest();
      }
    },
    [clearTonProofRequest, dynamicClient, ensureEvmWallet],
  );

  const openAuthModal = React.useCallback(async () => {
    if (authFlowPromiseRef.current) {
      return authFlowPromiseRef.current;
    }

    const promise = (async () => {
      try {
        if (tonWallet && !dynamicUser) {
          await tonConnectUI.disconnect();
        }

        dispatch({ type: "set_getting_dynamic_nonce" });
        const authNonce = await getNonce(dynamicClient);

        authNonceRef.current = authNonce;
        tonConnectUI.setConnectRequestParameters({
          state: "ready",
          value: { tonProof: authNonce },
        });
        dispatch({ type: "set_waiting_ton_wallet" });
        const unsubscribe = tonConnectUI.onModalStateChange((modalState) => {
          if (modalState.status !== "closed") {
            return;
          }

          unsubscribe();

          if (
            modalState.closeReason !== "wallet-selected" &&
            !tonConnectUI.wallet &&
            !dynamicUser
          ) {
            clearTonProofRequest();
            dispatch({ type: "set_unauthorized" });
          }
        });

        await tonConnectUI.openModal();
      } catch (error) {
        dispatch({
          type: "set_error",
          error: getError(error, "TON authentication failed."),
        });
        clearTonProofRequest();
      }
    })();

    authFlowPromiseRef.current = promise;

    try {
      await promise;
    } finally {
      authFlowPromiseRef.current = null;
    }
  }, [clearTonProofRequest, dynamicClient, tonConnectUI, tonWallet, dynamicUser]);

  const retry = React.useCallback(async () => {
    if (dynamicUser && tonAddress && !evmAddress) {
      try {
        autoProvisionAttemptedRef.current = false;
        const nextEvmAddress = await ensureEvmWallet();

        dispatch({
          type: "set_authorized",
          evmAddress: nextEvmAddress,
          tonAddress,
        });
      } catch (error) {
        dispatch({
          type: "set_error",
          error: getError(error, "Failed to provision the Dynamic EVM WaaS wallet."),
        });
      }

      return;
    }

    await openAuthModal();
  }, [ensureEvmWallet, evmAddress, openAuthModal, tonAddress, dynamicUser]);

  const logout = React.useCallback(async () => {
    clearTonProofRequest();

    if (tonWallet) {
      await tonConnectUI.disconnect();
    }

    if (dynamicUser) {
      await dynamicLogout();
    }

    dispatch({ type: "reset" });
  }, [clearTonProofRequest, dynamicLogout, tonConnectUI, tonWallet, dynamicUser]);

  React.useEffect(() => {
    if (dynamicInitStatus !== "finished") {
      return;
    }

    if (dynamicUser && tonAddress && evmAddress) {
      autoProvisionAttemptedRef.current = false;
      dispatch({
        type: "set_authorized",
        evmAddress,
        tonAddress,
      });
      return;
    }

    if (dynamicUser && tonAddress && !evmAddress) {
      if (!autoProvisionAttemptedRef.current) {
        autoProvisionAttemptedRef.current = true;
        void ensureEvmWallet()
          .then((nextEvmAddress) => {
            dispatch({
              type: "set_authorized",
              evmAddress: nextEvmAddress,
              tonAddress,
            });
          })
          .catch((error) => {
            dispatch({
              type: "set_error",
              error: getError(error, "Failed to provision the Dynamic EVM WaaS wallet."),
            });
          });
      } else if (provisionPromiseRef.current && state.status !== "creating-evm-wallet") {
        dispatch({ type: "set_creating_evm_wallet" });
      }

      return;
    }

    if (!dynamicUser && tonWallet && state.status === "waiting-ton-wallet") {
      if (!authFlowPromiseRef.current) {
        authFlowPromiseRef.current = completeTonWalletAuth(tonWallet)
          .catch((error) => {
            dispatch({
              type: "set_error",
              error: getError(error, "TON authentication failed."),
            });
          })
          .finally(() => {
            authFlowPromiseRef.current = null;
          });
      }

      return;
    }

    if (!dynamicUser && !tonAddress && state.status === "waiting-ton-wallet") {
      return;
    }

    if (dynamicUser && !tonAddress) {
      autoProvisionAttemptedRef.current = false;
      if (state.status !== "restoring-ton-session") {
        dispatch({ type: "set_restoring_ton_session" });
      }

      return;
    }

    autoProvisionAttemptedRef.current = false;

    if (state.status !== "unauthorized") {
      dispatch({ type: "set_unauthorized" });
    }
  }, [
    completeTonWalletAuth,
    ensureEvmWallet,
    evmAddress,
    dynamicInitStatus,
    state.status,
    tonAddress,
    tonWallet,
    dynamicUser,
  ]);

  const value = React.useMemo<WalletAuthContextValue>(() => {
    switch (state.status) {
      case "initial":
        return { status: "initial" };
      case "restoring-ton-session":
        return { status: "restoring-ton-session" };
      case "getting-dynamic-nonce":
        return { status: "getting-dynamic-nonce" };
      case "waiting-ton-wallet":
        return { status: "waiting-ton-wallet" };
      case "authorizing-with-dynamic":
        return { status: "authorizing-with-dynamic" };
      case "creating-evm-wallet":
        return { status: "creating-evm-wallet" };
      case "unauthorized":
        return {
          status: "unauthorized",
          openAuthModal,
        };
      case "authorized":
        return {
          status: "authorized",
          evmAddress: state.evmAddress,
          logout,
          tonAddress: state.tonAddress,
        };
      case "error":
        return {
          status: "error",
          error: state.error,
          retry,
        };
    }
  }, [logout, openAuthModal, retry, state]);

  return <WalletAuthContext.Provider value={value}>{children}</WalletAuthContext.Provider>;
}

export function useWalletAuthContext() {
  const context = React.useContext(WalletAuthContext);

  if (!context) {
    throw new Error("useWalletAuthContext must be used inside WalletAuthProvider.");
  }

  return context;
}

function hasChain(chain: string, expected: string) {
  return chain.toLowerCase() === expected.toLowerCase();
}
