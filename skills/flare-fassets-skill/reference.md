# Flare FAssets — Reference Links

Use these when you need detailed specs, contract ABIs, or step-by-step developer guides.

## Overview and Concepts

- [FAssets Overview](https://dev.flare.network/fassets/overview) — System summary, workflow, participants, Core Vault
- [FXRP Overview](https://dev.flare.network/fxrp/overview) — FXRP architecture, mint/redeem paths, and usage options on Flare
- [FAssets Minting](https://dev.flare.network/fassets/minting) — Standard minting flow: single XRPL payment to the Core Vault (destination tag or memo encoding), fees, executor restrictions, MintingTagManager, rate limits, large-mint delays. (This is what was previously "direct minting"; the older collateral-reservation flow is now archived.)
- [Standard Minting (Archived)](https://dev.flare.network/fassets/standard-minting) — Legacy collateral-reservation minting flow, kept for reference
- [FAssets Redemption](https://dev.flare.network/fassets/redemption) — Redemption flow; includes `redeemWithTag` for exchange addresses requiring XRP destination tags
- [FAssets Collateral](https://dev.flare.network/fassets/collateral) — Collateral types and rules
- [FAssets Liquidation](https://dev.flare.network/fassets/liquidation) — Liquidators and challengers
- [FAssets Core Vault](https://dev.flare.network/fassets/core-vault) — Core Vault behavior and governance
- [Operational Parameters](https://dev.flare.network/fassets/operational-parameters) — e.g. `underlyingSecondsForPayment`, `underlyingBlocksForPayment`

## Developer Guides

- **Skill guide:** [direct-minting-guide.md](direct-minting-guide.md) — **standard** minting via Core Vault: destination tag vs memo encoding, MintingTagManager NFT, executor restrictions, rate limiting, operational parameters, IMintingTagManager API
- **Skill guide:** [minting-guide.md](minting-guide.md) — **legacy** collateral-reservation walkthrough (reserve collateral → XRP payment → FDC proof → execute minting), including executor-based minting; archived path kept for reference
- **Skill guide:** [redemption-guide.md](redemption-guide.md) — complete redemption walkthrough (approve → redeem → agent pays → default handling); includes `redeemWithTag` for exchange addresses
- [Developer Guides Index](https://dev.flare.network/fassets/developer-guides)
- [Get Asset Manager Address](https://dev.flare.network/fassets/developer-guides/fassets-asset-manager-address-contracts-registry) — From Flare Contract Registry
- [Read FAssets Settings (Solidity)](https://dev.flare.network/fassets/developer-guides/fassets-settings-solidity) — Fetch lot size and asset decimals via a Solidity contract using `ContractRegistry.getAssetManagerFXRP()` → `getSettings()`; deploy and interact with Hardhat + `@flarenetwork/flare-periphery-contracts`
- [Read FAssets Settings (Node.js)](https://dev.flare.network/fassets/developer-guides/fassets-settings-node) — TypeScript script using **viem** and **`@flarenetwork/flare-wagmi-periphery-package`** (the recommended periphery package for Node.js); resolves AssetManager via registry, reads `getSettings()`, fetches XRP/USD price from FtsoV2, and calculates lot value in USD
- [Mint FXRP](https://dev.flare.network/fassets/developer-guides/fassets-mint) — TypeScript/viem walkthrough (flare-viem-starter): build a 32-byte memo (`0x4642505266410018` prefix + 4 zero bytes + recipient address), send a single XRPL payment to the Core Vault, wait for the `DirectMintingExecuted` event. This is the **standard** minting guide (formerly "Direct Mint FXRP"). Uses `xrpl`, `viem`, `@flarenetwork/flare-wagmi-periphery-package`. Key calls: `getDirectMintingPaymentAddress()`, `computeDirectMintingPaymentAmountXrp()`, `waitForDirectMintingOutcome()` (handles a `DirectMintingDelayed` event from rate limits before the eventual `DirectMintingExecuted`)
- [Mint FXRP with Tag](https://dev.flare.network/fassets/developer-guides/fassets-mint-tag) — TypeScript/viem walkthrough (flare-viem-starter): reserve a tag once via `IMintingTagManager.reserve()` (pays native fee), bind it to a recipient via `setMintingRecipient`, then send XRP payments to the Core Vault using that destination tag. Uses `xrpl`, `viem`, `@flarenetwork/flare-wagmi-periphery-package`. Key calls: `IMintingTagManager.reserve()`, `setMintingRecipient()`, `getDirectMintingPaymentAddress()`, `getDirectMintingOthersCanExecuteAfterSeconds()`
- [Check Minting Limits](https://dev.flare.network/fassets/developer-guides/fassets-mint-limits) — Read live hourly and daily minting rate limits off-chain and pre-flight a proposed mint against the hourly, daily, and large-mint delay rules. Covers tumbling-window math, `getDirectMintingHourlyLimiterState`, `getDirectMintingDailyLimiterState`, `getDirectMintingsUnblockUntilTimestamp`, `assetMintingGranularityUBA`
- [Minting Troubleshooting](https://dev.flare.network/fassets/troubleshooting/minting-troubleshooting) — Pre-flight checklist, irreversible failure modes (payment below minimum fee, wrong recipient, wrong XRPL address, unrecognized memo → smart account routing), `executeDirectMinting` revert table, delay/retry steps for `DirectMintingDelayed`/`LargeDirectMintingDelayed`, and MintingTagManager pitfalls
- [Transfer a Minting Tag](https://dev.flare.network/fassets/developer-guides/fassets-mint-tag-transfer) — Transfer an existing minting tag NFT to another owner via `IMintingTagManager.transferFrom()`. After transfer: recipient is reset to new owner, allowed executor is cleared, tag ID unchanged.
- [Redeem FAssets](https://dev.flare.network/fassets/developer-guides/fassets-redeem)
- [Redeem FXRP by Amount](https://dev.flare.network/fassets/developer-guides/fassets-redeem-amount) — TypeScript/viem walkthrough (flare-viem-starter) for `redeemAmount()`: redeem arbitrary amounts (UBA), not whole lots. Validate against `minimumRedeemAmountUBA()`, simulate, submit, parse `RedemptionRequested` events. Uses `viem`, `@flarenetwork/flare-wagmi-periphery-package`. Note: redemptions may be partial if ticket demand is high; multiple agents may fulfill one request
- [Redeem FXRP with Tag](https://dev.flare.network/fassets/developer-guides/fassets-redeem-with-tag) — TypeScript/viem walkthrough (flare-viem-starter) for `redeemWithTag()`: redeem to XRPL exchange addresses that require a destination tag. Parameters: amount (UBA), XRPL destination address, executor, destination tag. Validate against `minimumRedeemAmountUBA()`. Events: `RedemptionWithTagRequested`, `RedemptionAmountIncomplete`. Uses `viem`, `@flarenetwork/flare-wagmi-periphery-package`
- [Swap and Redeem](https://dev.flare.network/fassets/developer-guides/fassets-swap-redeem)
- [Redemption Defaults](https://dev.flare.network/fassets/developer-guides/fassets-redemption-default)
- [Redemption Queue](https://dev.flare.network/fassets/developer-guides/fassets-redemption-queue)
- [FAsset Auto-Redeem](https://dev.flare.network/fxrp/oft/fxrp-autoredeem)
- [Get FXRP Token Address](https://dev.flare.network/fxrp/token-interactions/fxrp-address)
- [FXRP Omnichain Fungible Token (OFT)](https://dev.flare.network/fxrp/oft) — LayerZero OFT overview, DVN security stack (LayerZero Labs, Nethermind, Canary, Horizen), and current deployment addresses (OFT Adapter on Flare; native OFT on HyperEVM, HyperCore, Ethereum Mainnet, Base, BNB Smart Chain, Monad, Katana — plus Coston2/Hyperliquid testnet)
- [Bridge FXRP to Ethereum](https://dev.flare.network/fxrp/oft/fxrp-bridge-ethereum) — move FXRP you already hold from Coston2 to Sepolia: approve the OFT Adapter, then `send()`, using Viem (no Smart Account or minting step)
- [Auto Minting and Bridging FXRP](https://dev.flare.network/fxrp/oft/fxrp-automint) — mint FXRP from an XRPL payment and bridge it to another chain atomically in one flow, via a [Smart Accounts Custom Instruction (`0xFE`)](../flare-smart-accounts-skill/SKILL.md) that calls the OFT Adapter directly (no bridge-shim contract)
- **Skill script:** [scripts/get-fxrp-address.ts](scripts/get-fxrp-address.ts) — get FXRP address at runtime (FlareContractsRegistry → AssetManagerFXRP → fAsset())
- **Skill script:** [scripts/get-fassets-settings.ts](scripts/get-fassets-settings.ts) — read lot size, decimals, and XRP/USD price via FTSOv2
- **Skill script:** [scripts/list-agents.ts](scripts/list-agents.ts) — list all available FAssets agents with fees and free collateral
- **Skill script:** [scripts/get-redemption-queue.ts](scripts/get-redemption-queue.ts) — get redemption queue total value and lots
- **Skill script:** [scripts/reserve-collateral.ts](scripts/reserve-collateral.ts) — find best agent and reserve collateral for minting (write tx)
- **Skill script:** [scripts/xrp-payment.ts](scripts/xrp-payment.ts) — send XRP payment with memo for FAssets minting (XRPL tx)
- **Skill script:** [scripts/execute-minting.ts](scripts/execute-minting.ts) — execute minting with FDC proof after XRP payment (write tx)
- **Skill script:** [scripts/redeem-fassets.ts](scripts/redeem-fassets.ts) — redeem FXRP for underlying XRP (write tx)
- **Skill script:** [scripts/redeem-fassets-amount.ts](scripts/redeem-fassets-amount.ts) — redeem an arbitrary FXRP amount (UBA) via `redeemAmount` (write tx)
- **Skill script:** [scripts/redeem-fassets-with-tag.ts](scripts/redeem-fassets-with-tag.ts) — redeem FXRP with an XRPL destination tag via `redeemWithTag` (write tx)
- **Skill script:** [scripts/direct-mint-fxrp.ts](scripts/direct-mint-fxrp.ts) — direct mint FXRP via memo (XRPL Payment to Core Vault, single-tx)
- **Skill script:** [scripts/direct-mint-fxrp-tag.ts](scripts/direct-mint-fxrp-tag.ts) — direct mint FXRP via destination tag (reserve tag, bind recipient, then send XRPL Payment with the tag)
- **Skill script:** [scripts/swap-usdt0-to-fxrp.ts](scripts/swap-usdt0-to-fxrp.ts) — swap USDT0 to FXRP via SparkDEX Uniswap V3 (write tx)
- [Swap USDT0 to FXRP](https://dev.flare.network/fxrp/token-interactions/usdt0-fxrp-swap)
- [Gasless FXRP Payments](https://dev.flare.network/fxrp/token-interactions/gasless-fxrp-payments) — EIP-712 meta-transactions: user signs off-chain, relayer submits on-chain; `GaslessPaymentForwarder` contract handles nonce/replay protection and fetches FXRP from registry at runtime; uses `ethers`, `viem`, `@openzeppelin/contracts`, `@flarenetwork/flare-periphery-contracts`
- **Skill guide:** [gasless-payments-guide.md](gasless-payments-guide.md) — full walkthrough of gasless FXRP payments (architecture, contract, relayer, replay protection, one-time approval)
- [x402 Payment Protocol](https://dev.flare.network/fxrp/token-interactions/x402-payments)
- [FXRP Auto-Redeem](https://dev.flare.network/fxrp/oft/fxrp-autoredeem)
- [List FAssets Agents](https://dev.flare.network/fassets/developer-guides/fassets-list-agents)
- [Read FAssets Agent Details](https://dev.flare.network/fassets/developer-guides/fassets-agent-details)
- **Skill guide:** [agent-details-guide.md](agent-details-guide.md) — read agent name, description, icon URL, and terms of use from `AgentOwnerRegistry`

## Contract Reference

- [FAssets Reference](https://dev.flare.network/fassets/reference) — Deployed contracts per network, core interfaces
- [IAssetManager](https://dev.flare.network/fassets/reference/IAssetManager) — Full interface. Groups: Information (`getSettings`, `getAgentInfo`, `getCollateralTypes`, `collateralReservationFee`, `collateralReservationInfo`, `fAsset`, `assetMintingGranularityUBA`); Direct Minting Settings (`directMintingPaymentAddress`, `getDirectMintingMinimumFeeUBA`, `getDirectMintingFeeBIPS`, `getDirectMintingExecutorFeeUBA`, `getDirectMintingOthersCanExecuteAfterSeconds`, `getDirectMintingHourlyLimitUBA`, `getDirectMintingDailyLimitUBA`, `getDirectMintingLargeMintingThresholdUBA`, `getDirectMintingLargeMintingDelaySeconds`, `getDirectMintingFeeReceiver`, `getDirectMintingHourlyLimiterState`, `getDirectMintingDailyLimiterState`, `getDirectMintingsUnblockUntilTimestamp`, `directMintingDelayState`, `markUnblockedDirectMintingAllowed`); Redeem With Tag Settings (`minimumRedeemAmountUBA`, `getMintingTagManager`); Agents (`getAllAgents`, `getAvailableAgentsList`, `getAvailableAgentsDetailedList`); Redemption Queue (`redemptionQueue`, `agentRedemptionQueue`); Collateral Reservation & Minting (`reserveCollateral`, `executeMinting`, `executeDirectMinting`, `executeDirectMintingWithData`); Redemption (`redeem`, `redeemAmount`, `redeemWithTag`, `redemptionPaymentDefault`); Core Vault Settings (`getCoreVaultManager`, `getCoreVaultDonationTag`, `getCoreVaultMinimumAmountLeftBIPS`, `getCoreVaultTransferTimeExtensionSeconds`, `getCoreVaultTransferFeeBIPS`, `getCoreVaultMinimumRedeemLots`, `getCoreVaultRedemptionFeeBIPS`).
- [IMintingTagManager](https://dev.flare.network/fassets/reference/IMintingTagManager) — NFT-based minting tag management (ERC-721). Full interface: `reserve()` (payable), `reservationFee()`, `reservedTagsForOwner(owner)`, `setMintingRecipient(tagId, recipient)`, `mintingRecipient(tagId)`, `setAllowedExecutor(tagId, executor)`, `allowedExecutor(tagId)`, `transfer(to, tagId)`, `transferFrom(from, to, tagId)`. After `transferFrom`: recipient resets to new owner, allowed executor cleared. Access via `AssetManager.getMintingTagManager()`.
- [IAssetManagerController](https://dev.flare.network/fassets/reference/IAssetManagerController)
- [IAssetManagerEvents](https://dev.flare.network/fassets/reference/IAssetManagerEvents) — Direct minting events: `DirectMintingExecuted`, `DirectMintingExecutedToSmartAccount` (unrecognized memo/tag → smart account manager), `DirectMintingPaymentTooSmallForFee` (payment below minimum fee, consumed by fee receiver), `DirectMintingDelayed` (hourly/daily throttle), `LargeDirectMintingDelayed` (large-mint threshold, independent of hourly/daily), `DirectMintingsUnblocked` (governance bypass of hourly/daily limiter)
- [ICollateralPool](https://dev.flare.network/fassets/reference/ICollateralPool)
- [ICoreVaultManager](https://dev.flare.network/fassets/reference/ICoreVaultManager)
- [IAgentOwnerRegistry](https://dev.flare.network/fassets/reference/IAgentOwnerRegistry)

## Smart Accounts

- [Flare Smart Accounts](https://dev.flare.network/smart-accounts/overview) — Account abstraction for XRPL users to interact with FAssets on Flare without owning FLR

## Supporting Protocols

- [FTSO Overview](https://dev.flare.network/ftso/overview)
- [FDC Overview](https://dev.flare.network/fdc/overview)
- [FDC Payment (Hardhat)](https://dev.flare.network/fdc/guides/hardhat/payment) — Validate payment and generate Merkle proof
