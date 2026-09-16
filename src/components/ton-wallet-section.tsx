import { toUserFriendlyAddress } from "@tonconnect/ui-react";
import { LogOut } from "lucide-react";

import { SectionAccountSummary } from "~/components/section-account-summary";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { TON_ASSET } from "~/constants";
import { useWalletAssetBalance } from "~/hooks/use-wallet-asset-balance";
import { useWalletAuthContext } from "~/providers/wallet-auth-provider";
import { formatAddress, formatAssetAmount } from "~/lib/utils";

export function TonWalletSection() {
  const authContext = useWalletAuthContext();

  return (
    <Card>
      <CardHeader>
        <CardTitle>TON Wallet</CardTitle>
      </CardHeader>
      {authContext.status === "authorized" ? (
        <AuthorizedTonWalletSection
          tonAddress={authContext.tonAddress}
          logout={authContext.logout}
        />
      ) : authContext.status === "unauthorized" ? (
        <UnauthorizedTonWalletSection openAuthModal={authContext.openAuthModal} />
      ) : (
        <LoadingTonWalletSection />
      )}
    </Card>
  );
}

function AuthorizedTonWalletSection({
  tonAddress,
  logout,
}: {
  tonAddress: string;
  logout: () => void;
}) {
  const userDepositAssetBalanceQuery = useWalletAssetBalance({
    asset: TON_ASSET,
    walletAddress: tonAddress,
  });

  const tonWalletAddress = tonAddress.includes(":")
    ? toUserFriendlyAddress(tonAddress)
    : tonAddress;

  return (
    <CardContent className="flex items-center justify-between gap-4">
      <SectionAccountSummary
        address={formatAddress(tonWalletAddress)}
        avatarSrc="https://s2.coinmarketcap.com/static/img/coins/64x64/11419.png"
        balance={`${formatAssetAmount(userDepositAssetBalanceQuery.data?.balance, TON_ASSET.meta)} ${TON_ASSET.meta.symbol} (${TON_ASSET.id.chain.$case.toUpperCase()})`}
        explorerUrl={`https://tonviewer.com/${tonWalletAddress}?section=tokens`}
      />
      <div>
        <Button variant="outline" className="size-10" onClick={logout}>
          <LogOut />
        </Button>
      </div>
    </CardContent>
  );
}

function UnauthorizedTonWalletSection({ openAuthModal }: { openAuthModal: () => void }) {
  return (
    <CardContent>
      <Button className="w-full h-11" size="lg" onClick={openAuthModal}>
        Connect TON Wallet
      </Button>
    </CardContent>
  );
}

function LoadingTonWalletSection() {
  return (
    <CardContent>
      <Button className="w-full h-11" size="lg" disabled>
        <span className="shimmer">Connecting...</span>
      </Button>
    </CardContent>
  );
}
