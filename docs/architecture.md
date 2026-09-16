# Architecture

This repository demonstrates an EVM-native Telegram Mini App flow controlled through a TON wallet, with Dynamic WaaS for EVM wallet access and Omniston for TON <-> EVM transfers.

The code is provided as an integration example. It is not a production-ready application.

The implementation has three main responsibilities:

- Authenticate the user with a TON wallet.
- Create and use an EVM WaaS wallet for the authenticated user.
- Move supported assets between TON and EVM.

## Components

### TonConnect

TonConnect is the user-facing wallet connection layer.

The application requests a TON wallet connection and attaches a `tonProof` payload. The proof is used later by Dynamic to verify ownership of the connected TON wallet.

Relevant files:

- `src/providers/ton-connect-provider.tsx`
- `src/providers/wallet-auth-provider.tsx`
- `src/routes/_public/tonconnect-manifest[.]json.ts`

### Dynamic

Dynamic is used as the authentication and EVM wallet creation layer.

After the TON wallet connection is completed, the application verifies the TON wallet account through Dynamic. Once the Dynamic user session exists, the application creates or restores the linked EVM WaaS wallet.

The EVM wallet is not selected by the user in a separate EVM wallet interface. It is created and accessed through Dynamic WaaS.

Relevant files:

- `src/providers/dynamic-provider.tsx`
- `src/providers/wallet-auth-provider.tsx`

### Omniston

Omniston is the cross-chain layer used under the hood for quotes, order construction, and settlement tracking.

In this example, it is used to move liquidity between TON and EVM.

The demo requests order quotes from Omniston and then executes the correct source-chain flow:

- TON source asset: build a TON escrow transfer and send it through TonConnect.
- EVM source asset: sign permit and order data through the Dynamic EVM wallet client, then register the signed order with Omniston.

Relevant files:

- `src/hooks/use-cross-chain-swap-flow.ts`
- `src/lib/omniston.ts`

## Authorization Flow

This example requests `tonProof` during the TonConnect connection flow:

1. The user starts wallet connection from the app.
2. The app requests a Dynamic nonce.
3. The nonce is passed to TonConnect as `tonProof`.
4. The user signs the TonConnect request with a TON wallet.
5. The app verifies the TON wallet account through Dynamic.
6. The app creates or restores the user's EVM WaaS wallet.
7. The app state becomes authorized with both TON and EVM addresses.

The user-facing identity remains the TON wallet. The EVM wallet is associated with the Dynamic user and accessed by the application through Dynamic WaaS.

Some TON wallets may not support sending `tonProof` during the initial connection. In that case, the integration should use a split authorization flow:

1. Connect the TON wallet.
2. Request and sign `tonProof` for the connected wallet.
3. Verify the TON wallet account through Dynamic.
4. Create or restore the user's EVM WaaS wallet.

## Cross-chain Flow

The current demo uses:

- TON USD₮ jetton as the TON asset.
- Arbitrum USD₮0 ERC-20 as the EVM asset.

The asset configuration is defined in `src/constants.ts`.

The example also includes optional Omniston integrator fee configuration. When `VITE_OMNISTON_INTEGRATOR_ADDRESS_ON_TON` or `VITE_OMNISTON_INTEGRATOR_ADDRESS_ON_EVM` is set, quote requests include the configured integrator address and fee parameters for the corresponding destination chain.

### TON to EVM

For TON-to-EVM movement, the app:

1. Requests an Omniston order quote.
2. Builds a TON escrow transfer for the quote.
3. Sends the transaction through TonConnect.
4. Tracks the Omniston order until settlement.
5. Refreshes wallet balances.

### EVM to TON

For EVM-to-TON movement, the app:

1. Requests an Omniston order quote.
2. Selects the Dynamic EVM WaaS wallet account.
3. Switches the Dynamic wallet to the required EVM network.
4. Builds EIP-2612 permit data for the ERC-20 transfer.
5. Builds and signs the Omniston EVM order.
6. Registers the signed order with Omniston.
7. Tracks the Omniston order until settlement.
8. Refreshes wallet balances.

## Application Boundary

This repository stops at the transfer layer. It does not implement a protocol-specific EVM action after funding.
