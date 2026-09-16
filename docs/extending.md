# Extending the Example

This repository can be used as a reference for TON-controlled EVM application flows.

The default implementation demonstrates wallet authorization, EVM wallet creation through Dynamic WaaS, and TON <-> EVM asset movement. It is not a production-ready application.

This repository does not implement a concrete EVM protocol integration.

## Add EVM Application Logic

Add EVM logic after the user has:

- An authorized TON wallet.
- A Dynamic EVM WaaS wallet.
- Funds available on the target EVM network.

The current EVM signing pattern is implemented in `src/hooks/use-cross-chain-swap-flow.ts`. The EVM-to-TON flow already uses the Dynamic EVM wallet account to sign typed data through `viem`.

For another EVM operation, reuse the same underlying pieces:

- Dynamic wallet accounts from `useGetWalletAccounts`.
- Dynamic EVM wallet client from `createWalletClientForWalletAccount`.
- EVM public client from `createPublicClientFromNetworkData` or `viem`.
- Network switching through Dynamic before signing or sending.

## Replace the Demo EVM Action

The current UI has two transfer actions in `src/components/dynamic-wallet-section.tsx`:

- `Bridge to EVM`
- `Return to TON`

For an EVM-native application, the `Bridge to EVM` action can remain the funding step. After that, add the application's primary EVM action next to it or after it.

Examples:

- Deposit bridged funds into an EVM protocol.
- Execute an EVM swap.
- Mint an EVM asset.
- Pay an EVM contract.
- Open an EVM position and later return funds to TON.

## Change Assets or Networks

Demo assets are defined in `src/constants.ts`.

To use another EVM asset or network:

1. Replace `EVM_ASSET`.
2. Ensure the chain is supported by Omniston for the intended route.
3. Enable the chain in the Dynamic dashboard.
4. Update permit configuration if the token uses EIP-2612.
5. Update balance fetching if the chain name cannot be resolved by `viem/chains`.

To use another TON asset:

1. Replace `TON_ASSET`.
2. Ensure the jetton is supported for the intended Omniston route.
3. Update labels and token metadata as needed.

## Configure Dynamic

The Dynamic environment must support:

- TON wallet authentication.
- EVM WaaS wallets.
- The EVM network used by the application.

The app expects `VITE_DYNAMIC_ENVIRONMENT_ID` to be set.

## Configure TonConnect

The app uses a TonConnect manifest URL from `VITE_TONCONNECT_MANIFEST_URL`.

If the variable is not provided, the repository serves a default manifest from:

```txt
/tonconnect-manifest.json
```

The manifest must be hosted correctly for TonConnect wallet authorization to work. See the [TonConnect manifest requirements](https://docs.ton.org/applications/ton-connect/get-started#prepare-the-manifest).

Local development may require an additional public HTTPS URL for the app and manifest.

This example requests `tonProof` during wallet connection. If a target TON wallet does not support that flow, adapt the authorization sequence to connect the wallet first and request `tonProof` after the wallet is connected.

## Configure Omniston

The app uses Omniston for quotes, transaction construction, order registration, and settlement tracking.

For a broader Omniston reference implementation, see the [Omniston demo app](https://omniston.ston.fi/) and its [source code](https://github.com/ston-fi/omniston-sdk/tree/main/examples/react-app). It covers more Omniston UI and signing scenarios.

Integrator addresses can be configured with:

```env
VITE_OMNISTON_INTEGRATOR_ADDRESS_ON_TON=
VITE_OMNISTON_INTEGRATOR_ADDRESS_ON_EVM=
```
