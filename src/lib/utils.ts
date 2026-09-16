import { clsx, type ClassValue } from "clsx";
import { formatUnits, parseUnits } from "viem";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function ensureError(error: unknown, fallback: string) {
  return error instanceof Error ? error : new Error(fallback);
}

export function formatAssetAmount(
  amount: string | null | undefined,
  meta: { decimals: number },
  options?: { maxFractionDigits?: number },
) {
  if (!amount) {
    return "0";
  }

  const isNegative = amount.startsWith("-");
  const digits = (isNegative ? amount.slice(1) : amount).replace(/^0+(?=\d)/, "") || "0";
  const decimals = Math.max(meta.decimals, 0);
  const paddedDigits = decimals > 0 ? digits.padStart(decimals + 1, "0") : digits;
  const integerPart = decimals > 0 ? paddedDigits.slice(0, -decimals) : paddedDigits;
  const groupedIntegerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  if (decimals === 0) {
    return `${isNegative ? "-" : ""}${groupedIntegerPart}`;
  }

  const maxFractionDigits = options?.maxFractionDigits ?? decimals;
  const fractionPart = paddedDigits.slice(-decimals).slice(0, maxFractionDigits).replace(/0+$/, "");

  if (!fractionPart) {
    return `${isNegative ? "-" : ""}${groupedIntegerPart}`;
  }

  return `${isNegative ? "-" : ""}${groupedIntegerPart}.${fractionPart}`;
}

export function formatAssetInputAmount(amount: string | null | undefined, decimals: number) {
  if (!amount) {
    return "0";
  }

  const formattedAmount = formatUnits(BigInt(amount), decimals);

  return formattedAmount.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

export function normalizeAssetAmountInput(amount: string) {
  return amount.replace(/,/g, ".");
}

export function validateAssetAmountInput(
  amount: string,
  options: {
    balance?: string | null;
    decimals: number;
    symbol: string;
  },
) {
  const trimmedAmount = amount.trim();

  if (!trimmedAmount) {
    return "Enter an amount.";
  }

  if (!/^\d*\.?\d*$/.test(trimmedAmount)) {
    return "Enter a valid number.";
  }

  if (trimmedAmount === "." || Number(trimmedAmount) <= 0) {
    return "Amount must be greater than 0.";
  }

  const fractionPart = trimmedAmount.split(".")[1];

  if (fractionPart && fractionPart.length > options.decimals) {
    return `Amount supports up to ${options.decimals} decimals.`;
  }

  try {
    const amountInUnits = parseUnits(trimmedAmount, options.decimals);

    if (options.balance != null) {
      const balanceInUnits = BigInt(options.balance);

      if (amountInUnits > balanceInUnits) {
        return `Insufficient ${options.symbol} balance.`;
      }
    }
  } catch {
    return "Enter a valid amount.";
  }

  return null;
}
