# TON-controlled EVM Telegram Mini App with Omniston

This repository demonstrates how an EVM-native Telegram Mini App flow can be exposed to users through TON wallet authorization, Dynamic WaaS, and Omniston cross-chain transfers.

The code is provided as an integration example. It is not a production-ready application.

The example combines:

- TON wallet connection through TonConnect.
- EVM wallet creation with Dynamic WaaS (Wallet-as-a-Service).
- Cross-chain liquidity movement between TON and EVM through Omniston.

Omniston is the cross-chain layer used under the hood for quotes, order construction, and settlement tracking.

The user-facing wallet is a TON wallet. The EVM wallet is created and accessed through Dynamic WaaS for EVM operations.

## Flow

```txt
TON wallet
  -> TonConnect initialization
  -> Dynamic initialization
  -> TON wallet connect with Dynamic nonce
  -> EVM wallet creation with Dynamic WaaS
  -> Omniston TON <-> EVM transfers
  -> optional EVM application logic
```

The current demo uses TON USD₮ and Arbitrum USD₮0 to show both directions of the cross-chain flow:

- `Bridge to EVM`: move liquidity from the connected TON wallet to the Dynamic EVM WaaS wallet.
- `Return to TON`: move liquidity from the Dynamic EVM WaaS wallet back to the connected TON wallet.

## Documentation

- [Architecture](./docs/architecture.md) explains the role of TonConnect, Dynamic, and Omniston in this repository.
- [Extending the Example](./docs/extending.md) describes the code areas to inspect when adapting the example for another EVM use case.

## Requirements

- Node.js `>=24 <25`
- pnpm `11.9.0`
- A [Dynamic environment](https://app.dynamic.xyz/dashboard/developer/api) configured with TON authentication and EVM WaaS support.
- Arbitrum enabled in the Dynamic environment for the default EVM asset.

## Configuration

Copy `.env.example` to `.env`:

```sh
cp .env.example .env
```

Set the required Dynamic environment ID. You can find it in the [Dynamic dashboard](https://app.dynamic.xyz/dashboard/developer/api):

```env
VITE_DYNAMIC_ENVIRONMENT_ID=
```

Configure the optional values as needed:

```env
# Wallet addresses for receiving Omniston integrator fees
VITE_OMNISTON_INTEGRATOR_ADDRESS_ON_TON= # UQ...
VITE_OMNISTON_INTEGRATOR_ADDRESS_ON_EVM= # 0x...

# Uncomment and set a URL to use an externally hosted TonConnect manifest
# VITE_TONCONNECT_MANIFEST_URL=https://your-domain.com/tonconnect-manifest.json
```

Leave `VITE_TONCONNECT_MANIFEST_URL` unset to use the manifest served by this app.

## Development

Install dependencies:

```sh
pnpm install
```

Start the development server:

```sh
pnpm dev
```

Build and type-check:

```sh
pnpm build
```
