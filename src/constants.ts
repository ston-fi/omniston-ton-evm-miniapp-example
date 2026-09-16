export const STON_API_BASE_URL = import.meta.env.VITE_STON_API_BASE_URL ?? "https://api.ston.fi";

export const OMNISTON_API_URL = import.meta.env.VITE_OMNISTON_API_URL ?? "wss://omni-ws.ston.fi";

export const OMNISTON_INTEGRATOR_FEE_PIPS = 10_000;
export const OMNISTON_INTEGRATOR_ADDRESS_ON_TON = import.meta.env
  .VITE_OMNISTON_INTEGRATOR_ADDRESS_ON_TON;
export const OMNISTON_INTEGRATOR_ADDRESS_ON_EVM = import.meta.env
  .VITE_OMNISTON_INTEGRATOR_ADDRESS_ON_EVM;

export const TON_ASSET = {
  id: {
    chain: {
      $case: "ton",
      value: {
        kind: {
          $case: "jetton",
          value: "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs",
        },
      },
    },
  },
  meta: {
    symbol: "USD₮",
    decimals: 6,
    display_name: "Tether USD",
    image_url:
      "https://asset.ston.fi/assets/logo/ton:jetton:EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs/d26289df35e1d881b2efa64df3a250cfff97d6ab44abb1a62bc37f7f4566b49b",
  },
} as const;

export const EVM_ASSET = {
  id: {
    chain: {
      $case: "arbitrum",
      value: {
        kind: {
          $case: "erc20",
          value: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
        },
      },
    },
  },
  meta: {
    symbol: "USD₮0",
    decimals: 6,
    display_name: "USD₮0",
    image_url:
      "https://asset.ston.fi/assets/logo/arbitrum:erc20:0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9/f9607ba3b1665d12eb7b44bcc85387f7dfe1a0c9d5437624559c31091c714c7e",
  },
  permit: {
    kind: "eip2612",
    domain: {
      name: "USD₮0",
      version: "1",
      chainId: 42161,
      verifyingContract: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
    },
  },
} as const;

export type Asset = typeof TON_ASSET | typeof EVM_ASSET;
