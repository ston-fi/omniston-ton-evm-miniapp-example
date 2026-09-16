import * as React from "react";

import { Button } from "~/components/ui/button";
import { Drawer, DrawerContent, DrawerFooter } from "~/components/ui/drawer";
import { Input } from "~/components/ui/input";
import type { CrossChainSwapFlow } from "~/hooks/use-cross-chain-swap-flow";
import { formatAssetAmount, normalizeAssetAmountInput } from "~/lib/utils";

type OmnistonCrossChainSwapModalProps = {
  cta: string;
  flow: CrossChainSwapFlow;
  title: string;
};

export function OmnistonCrossChainSwapModal({
  cta,
  flow,
  title,
}: OmnistonCrossChainSwapModalProps) {
  const hasBlockingSwapError = Boolean(flow.swapError && !flow.quoteOutputUnits);

  const primaryCtaLabel = flow.isSwapSubmitting
    ? cta
    : flow.isQuoteLoading
      ? "Fetching quote..."
      : !flow.amount.trim()
        ? "Enter an amount"
        : flow.amountError
          ? flow.amountError
          : hasBlockingSwapError
            ? "Error"
            : cta;

  const handleAmountChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    flow.setAmount(normalizeAssetAmountInput(event.target.value));
  };

  return (
    <Drawer open={flow.isAmountModalOpen} onOpenChange={flow.setAmountModalOpen}>
      <DrawerContent>
        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto px-4 pb-4">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium">{title}</span>
            <Input
              autoComplete="off"
              aria-invalid={!!flow.amountError}
              disabled={flow.isSwapSubmitting}
              inputMode="decimal"
              min="0"
              pattern="[0-9]*[.,]?[0-9]*"
              placeholder="0.0"
              step="any"
              type="text"
              value={flow.amount}
              onChange={handleAmountChange}
            />
          </label>
          {flow.sourceAssetBalance ? (
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">{`Balance: ${formatAssetAmount(flow.sourceAssetBalance, flow.sourceAsset.meta)} ${flow.sourceAsset.meta.symbol}`}</p>
              <Button
                size="sm"
                variant="ghost"
                disabled={flow.isSwapSubmitting}
                onClick={flow.fillMaxAmount}
              >
                Max
              </Button>
            </div>
          ) : null}
          {hasBlockingSwapError ? (
            <p className="text-sm text-destructive">{flow.swapError}</p>
          ) : null}
        </div>
        <DrawerFooter className="flex flex-col gap-2 *:w-full *:h-11">
          <Button disabled={flow.submitDisabled} onClick={flow.submitSwap}>
            <span className={flow.isSwapSubmitting ? "shimmer" : undefined}>{primaryCtaLabel}</span>
          </Button>
          <Button
            variant="outline"
            disabled={flow.isSwapSubmitting}
            onClick={() => flow.setAmountModalOpen(false)}
          >
            Cancel
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
