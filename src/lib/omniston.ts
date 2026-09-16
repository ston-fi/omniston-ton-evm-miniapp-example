import type {
  ChainAddress,
  OrderSettlementData,
  Quote,
  QuoteOfType,
  TradeStatus,
} from "@ston-fi/omniston-sdk-react";
import {
  HashingFunction,
  SettlementMethod,
  TradeStatus as OmnistonTradeStatus,
} from "@ston-fi/omniston-sdk-react";
import { hexToBytes, keccak256, sha256 } from "viem";

import type { Asset } from "~/constants";

export function createAssetChainAddress(asset: Asset, address: string): ChainAddress {
  return {
    chain: {
      $case: asset.id.chain.$case,
      value: address,
    },
  } as ChainAddress;
}

export function generateHtlcSecret() {
  return crypto.getRandomValues(new Uint8Array(32));
}

export function generateHtlcHashlock(
  secret: Uint8Array,
  hashingFunction: OrderSettlementData["htlcHashingFunction"],
) {
  switch (hashingFunction) {
    case HashingFunction.HASHING_FUNCTION_KECCAK256:
      return hexToBytes(keccak256(secret));
    case HashingFunction.HASHING_FUNCTION_SHA256:
      return hexToBytes(sha256(secret));
    case HashingFunction.UNRECOGNIZED:
    case undefined:
      throw new Error("Omniston returned an unrecognized HTLC hashing function.");
    default:
      hashingFunction satisfies never;
      throw new Error(`Unsupported HTLC hashing function: ${hashingFunction}`);
  }
}

export function hexToBase64(hex: string) {
  const normalizedHex = hex.startsWith("0x") ? hex.slice(2) : hex;

  return Buffer.from(normalizedHex, "hex").toString("base64");
}

export function isTerminalTradeStatus(status: TradeStatus) {
  return (
    status === OmnistonTradeStatus.TRADE_STATUS_FULLY_FILLED ||
    status === OmnistonTradeStatus.TRADE_STATUS_PARTIALLY_FILLED ||
    status === OmnistonTradeStatus.TRADE_STATUS_CANCELLED ||
    status === OmnistonTradeStatus.TRADE_STATUS_FAILED
  );
}

export function isSuccessfulTradeStatus(status: TradeStatus) {
  return (
    status === OmnistonTradeStatus.TRADE_STATUS_FULLY_FILLED ||
    status === OmnistonTradeStatus.TRADE_STATUS_PARTIALLY_FILLED
  );
}

export function ensureOrderQuote(quote: Quote): QuoteOfType<"order"> {
  if (quote.settlementData?.$case !== SettlementMethod.ORDER) {
    throw new Error(
      `Expected an Omniston order quote for this cross-chain flow, received "${quote.settlementData?.$case ?? "unknown"}".`,
    );
  }

  return quote as QuoteOfType<"order">;
}
