import { OmnistonCrossChainSwapModal } from "~/components/omniston-cross-chain-swap-modal";
import { SectionAccountSummary } from "~/components/section-account-summary";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "~/components/ui/card";
import { Empty } from "~/components/ui/empty";
import { EVM_ASSET, TON_ASSET } from "~/constants";
import { useCrossChainSwapFlow } from "~/hooks/use-cross-chain-swap-flow";
import { useWalletAuthContext } from "~/providers/wallet-auth-provider";
import { formatAddress, formatAssetAmount } from "~/lib/utils";

export function DynamicWalletSection() {
  const authContext = useWalletAuthContext();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dynamic WaaS Wallet</CardTitle>
      </CardHeader>
      {authContext.status === "authorized" ? (
        <AuthorizedDynamicWalletSection
          evmAddress={authContext.evmAddress}
          tonAddress={authContext.tonAddress}
        />
      ) : (
        <UnauthorizedDynamicWalletSection />
      )}
    </Card>
  );
}

function AuthorizedDynamicWalletSection({
  evmAddress,
  tonAddress,
}: {
  evmAddress: string;
  tonAddress: string;
}) {
  const depositFlow = useCrossChainSwapFlow({
    sourceAsset: TON_ASSET,
    sourceWalletAddress: tonAddress,
    destinationAsset: EVM_ASSET,
    destinationWalletAddress: evmAddress,
  });

  const withdrawFlow = useCrossChainSwapFlow({
    sourceAsset: EVM_ASSET,
    sourceWalletAddress: evmAddress,
    destinationAsset: TON_ASSET,
    destinationWalletAddress: tonAddress,
  });

  const isDepositSourceBalanceZero = (depositFlow.sourceAssetBalance ?? "0") === "0";
  const isWithdrawSourceBalanceZero = (withdrawFlow.sourceAssetBalance ?? "0") === "0";
  const isAnyFlowBusy = depositFlow.isBusy || withdrawFlow.isBusy;
  const isDepositDisabled = isDepositSourceBalanceZero || isAnyFlowBusy;
  const isWithdrawDisabled = isWithdrawSourceBalanceZero || isAnyFlowBusy;

  return (
    <>
      <CardContent className="flex flex-col gap-4">
        <SectionAccountSummary
          address={formatAddress(evmAddress)}
          avatarSrc="https://pbs.twimg.com/profile_images/1999597754549452806/eNqJ2r3X_400x400.png"
          balance={`${formatAssetAmount(withdrawFlow.sourceAssetBalance, withdrawFlow.sourceAsset.meta)} ${withdrawFlow.sourceAsset.meta.symbol} (${withdrawFlow.sourceAsset.id.chain.$case.toUpperCase()})`}
          explorerUrl={`https://etherscan.io/address/${evmAddress}#asset-multichain`}
        />
      </CardContent>
      <CardFooter className="grid grid-cols-2 gap-2 *:flex-1 *:h-11">
        <Button disabled={isDepositDisabled} onClick={depositFlow.openAmountModal}>
          <span className={depositFlow.isSwapSubmitting ? "shimmer" : undefined}>
            Bridge to EVM
          </span>
        </Button>
        <Button
          variant="outline"
          disabled={isWithdrawDisabled}
          onClick={withdrawFlow.openAmountModal}
        >
          <span className={withdrawFlow.isSwapSubmitting ? "shimmer" : undefined}>
            Return to TON
          </span>
        </Button>
      </CardFooter>

      <OmnistonCrossChainSwapModal
        cta="Deposit"
        flow={depositFlow}
        title={`Deposit ${TON_ASSET.meta.symbol}`}
      />

      <OmnistonCrossChainSwapModal
        cta="Withdraw"
        flow={withdrawFlow}
        title={`Withdraw ${EVM_ASSET.meta.symbol}`}
      />
    </>
  );
}

function UnauthorizedDynamicWalletSection() {
  return (
    <CardContent>
      <Empty>
        <p>Wallet unavailable</p>
        <p>Firstly connect TON wallet to create and use your EVM wallet.</p>
      </Empty>
    </CardContent>
  );
}
