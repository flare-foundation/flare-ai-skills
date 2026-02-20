# Flare FAssets — Reference Links

Use these when you need detailed specs, contract ABIs, or step-by-step developer guides.

## Overview and Concepts

- [FAssets Overview](https://dev.flare.network/fassets/overview) — System summary, workflow, participants, Core Vault
- [FXRP Overview](https://dev.flare.network/fxrp/overview) — FXRP architecture, mint/redeem paths, and usage options on Flare
- [FAssets Minting](https://dev.flare.network/fassets/minting) — Minting flow, fees, payment deadlines, failure handling
- [FAssets Redemption](https://dev.flare.network/fassets/redemption) — Redemption flow
- [FAssets Collateral](https://dev.flare.network/fassets/collateral) — Collateral types and rules
- [FAssets Liquidation](https://dev.flare.network/fassets/liquidation) — Liquidators and challengers
- [FAssets Core Vault](https://dev.flare.network/fassets/core-vault) — Core Vault behavior and governance
- [Operational Parameters](https://dev.flare.network/fassets/operational-parameters) — e.g. `underlyingSecondsForPayment`, `underlyingBlocksForPayment`

## Developer Guides

- **Skill guide:** [minting-guide.md](minting-guide.md) — complete minting walkthrough (reserve collateral → XRP payment → FDC proof → execute minting) including executor-based minting
- **Skill guide:** [redemption-guide.md](redemption-guide.md) — complete redemption walkthrough (approve → redeem → agent pays → default handling)
- [Developer Guides Index](https://dev.flare.network/fassets/developer-guides)
- [Get Asset Manager Address](https://dev.flare.network/fassets/developer-guides/fassets-asset-manager-address-contracts-registry) — From Flare Contract Registry
- [Read FAssets Settings (Solidity)](https://dev.flare.network/fassets/developer-guides/fassets-settings-solidity) — Lot size, value via FTSO
- [Read FAssets Settings (Node.js)](https://dev.flare.network/fassets/developer-guides/fassets-settings-node)
- [Mint FAssets](https://dev.flare.network/fassets/developer-guides/fassets-mint) — Reserve collateral, XRP payment, FDC proof, executeMinting
- [Mint with Executor](https://dev.flare.network/fassets/developer-guides/fassets-mint-executor)
- [Redeem FAssets](https://dev.flare.network/fassets/developer-guides/fassets-redeem)
- [Swap and Redeem](https://dev.flare.network/fassets/developer-guides/fassets-swap-redeem)
- [Redemption Defaults](https://dev.flare.network/fassets/developer-guides/fassets-redemption-default)
- [Redemption Queue](https://dev.flare.network/fassets/developer-guides/fassets-redemption-queue)
- [FAsset Auto-Redeem](https://dev.flare.network/fxrp/oft/fxrp-autoredeem)
- [Get FXRP Token Address](https://dev.flare.network/fxrp/token-interactions/fxrp-address)
- **Skill script:** [scripts/get-fxrp-address.ts](scripts/get-fxrp-address.ts) — get FXRP address at runtime (FlareContractsRegistry → AssetManagerFXRP → fAsset())
- **Skill script:** [scripts/get-fassets-settings.ts](scripts/get-fassets-settings.ts) — read lot size, decimals, and XRP/USD price via FTSOv2
- **Skill script:** [scripts/list-agents.ts](scripts/list-agents.ts) — list all available FAssets agents with fees and free collateral
- **Skill script:** [scripts/get-redemption-queue.ts](scripts/get-redemption-queue.ts) — get redemption queue total value and lots
- **Skill script:** [scripts/reserve-collateral.ts](scripts/reserve-collateral.ts) — find best agent and reserve collateral for minting (write tx)
- **Skill script:** [scripts/xrp-payment.ts](scripts/xrp-payment.ts) — send XRP payment with memo for FAssets minting (XRPL tx)
- **Skill script:** [scripts/execute-minting.ts](scripts/execute-minting.ts) — execute minting with FDC proof after XRP payment (write tx)
- **Skill script:** [scripts/redeem-fassets.ts](scripts/redeem-fassets.ts) — redeem FXRP for underlying XRP (write tx)
- **Skill script:** [scripts/swap-usdt0-to-fxrp.ts](scripts/swap-usdt0-to-fxrp.ts) — swap USDT0 to FXRP via SparkDEX Uniswap V3 (write tx)
- [Swap USDT0 to FXRP](https://dev.flare.network/fxrp/token-interactions/usdt0-fxrp-swap)
- [x402 Payment Protocol](https://dev.flare.network/fxrp/token-interactions/x402-payments)
- [FXRP Auto-Redeem](https://dev.flare.network/fxrp/oft/fxrp-autoredeem)
- [List FAssets Agents](https://dev.flare.network/fassets/developer-guides/fassets-list-agents)
- [Read FAssets Agent Details](https://dev.flare.network/fassets/developer-guides/fassets-agent-details)

## Contract Reference

- [FAssets Reference](https://dev.flare.network/fassets/reference) — Deployed contracts per network, core interfaces
- [IAssetManager](https://dev.flare.network/fassets/reference/IAssetManager)
- [IAssetManagerController](https://dev.flare.network/fassets/reference/IAssetManagerController)
- [IAssetManagerEvents](https://dev.flare.network/fassets/reference/IAssetManagerEvents)
- [ICollateralPool](https://dev.flare.network/fassets/reference/ICollateralPool)
- [ICoreVaultManager](https://dev.flare.network/fassets/reference/ICoreVaultManager)
- [IAgentOwnerRegistry](https://dev.flare.network/fassets/reference/IAgentOwnerRegistry)

## Bots

- [Agent Bot CLI](https://dev.flare.network/fassets/reference/agent-bot)
- [User Bot CLI](https://dev.flare.network/fassets/reference/user-bot)

## Smart Accounts

- [Flare Smart Accounts](https://dev.flare.network/smart-accounts/overview) — Account abstraction for XRPL users to interact with FAssets on Flare without owning FLR

## Supporting Protocols

- [FTSO Overview](https://dev.flare.network/ftso/overview)
- [FDC Overview](https://dev.flare.network/fdc/overview)
- [FDC Payment (Hardhat)](https://dev.flare.network/fdc/guides/hardhat/payment) — Validate payment and generate Merkle proof
