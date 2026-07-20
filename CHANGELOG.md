# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **flare-fassets-skill**: Self-minting — agents minting FAssets from their own vaults (adds a redemption-queue ticket; supports non-public self-mint vaults)
- **flare-general-skill**: Staking validator limit warning — do not stake from one address to more than three validators at once (the stake-mirroring service only processes the first three; extra stakes earn no rewards)
- **flare-fcc-skill**: Getting Started guide reference ("Build Your First Extension" — Hello World scaffold walkthrough) and the FCC whitepaper; noted FCC is now buildable on Coston2 and that any HTTPS tunnel (ngrok or cloudflared) to port 6674 works
- **flare-fcc-skill**: Flare Confidential Compute (FCC) / TEE extension domain knowledge — confidential extensions in a Trusted Execution Environment, the TeeExtensionRegistry and TeeMachineRegistry, the InstructionSender contract pattern, OPType/OPCommand routing, the instruction lifecycle, the extension action handler, the types server, attestation and code-hash whitelisting, reproducible builds, and the Coston/Coston2 deploy lifecycle (sourced from `fce-extension-scaffold` and `fce-sign`)
- **flare-fcc-skill**: dedicated `fce-weather-insurance` section — WEATHER `FETCH`/`SETTLE`/`BUY` commands, policy lifecycle, public vs ECIES-encrypted private policies, `SettlementTime`, TEE signature verification, and the `extension-setup.sh`/`PAY_TOKEN` deploy notes
- **flare-smart-accounts-skill**: Failure Handling & Recovery section — atomic revert semantics of `executeDirectMintingWithData`, the `0xE0` skip-memo recovery flow (with `IgnoreMemoSet`), duplicate-nonce avoidance, and a link to the Recover Stuck Mint Transaction guide
- `DEVELOPER_HUB_SYNC.md` — tracks the last integrated `developer-hub` commit and documents the sync process
- **flare-fassets-skill**: FXRP Cross-Chain (OFT) section — LayerZero Omnichain Fungible Token mechanism (OFT Adapter on Flare, native OFT mint/burn on destination chains), the DVN security stack, bridging via Stargate or the auto-mint/auto-redeem flows, and current mainnet deployment chains (Flare, HyperEVM, HyperCore, Ethereum Mainnet, Base, BNB Smart Chain, Monad, Katana)

### Changed

- Synced skills with `developer-hub` up to commit `718cca3a` — added Katana to the list of FXRP OFT mainnet deployment chains
- Synced skills with `developer-hub` up to commit `7e8c0158` — **FAssets minting model reframe**: the single-XRPL-payment-to-Core-Vault path (formerly "direct minting") is now the **standard** minting model, and the collateral-reservation flow ("standard minting") is **archived/legacy**. Updated `flare-fassets-skill` (minting workflow, terminology, guides) and renamed all developer-guide links (`fassets-direct-minting` → `fassets-mint`, `-tag`, `-limits`, `-tag-transfer`; `direct-minting-troubleshooting` → `minting-troubleshooting`; `/fassets/direct-minting` → `/fassets/minting`; removed the deleted `fassets-mint`/`fassets-mint-executor` collateral-reservation guides, added the archived [Standard Minting](https://dev.flare.network/fassets/standard-minting) reference). In `flare-smart-accounts-skill`, marked the collateral-reservation (CRT) instructions (`0x00`, `0x10`, `0x20`) and their CLI encoders (`fxrp-cr`, `firelight-cr-deposit`, `upshift-cr-deposit`, `bridge mint-tx`) as legacy, and clarified that user minting now goes through the Core Vault (not an agent XRPL address)
- Synced skills with `developer-hub` up to commit `01146a9b` — split the direct-minting large-mint delay into its own `LargeDirectMintingDelayed` event (separate from `DirectMintingDelayed`, which now only covers hourly/daily throttling), added `DirectMintingExecutedToSmartAccount` and `DirectMintingPaymentTooSmallForFee` events, `directMintingDelayState()`/`markUnblockedDirectMintingAllowed()` and `DirectMintingsUnblocked`, and linked the new [Direct Minting Troubleshooting](https://dev.flare.network/fassets/troubleshooting/direct-minting-troubleshooting) guide from `flare-fassets-skill` and `flare-smart-accounts-skill`
- Synced skills with `developer-hub` up to commit `9ac2cee5` — FAssets direct-minting large-mint delay semantics (strict threshold, independent of the hourly/daily windows and governance's `unblockDirectMintingsUntil`), the `waitForDirectMintingOutcome` helper rename, a new "Fast-forwarding a stuck nonce (`0xE1`)" section in `flare-smart-accounts-skill` with the `NonceIncreased`/`InvalidNonceIncrease` events, and reordered FCC sign-extension deploy steps (reserve the ngrok proxy URL before deploying the contract, plus a port-6674 exposure warning)
- Synced skills with `developer-hub` up to commit `70c274bd` — FAssets direct-minting "Finalizing on Flare" entry points (`executeDirectMinting` vs `executeDirectMintingWithData`) and smart-account atomicity/failure-handling clarifications

## [v1.0.0](https://github.com/flare-foundation/flare-ai-skills) - 2026-02-12

### Added

- Initial release
- **flare-fassets-skill**: FAssets domain knowledge, including FXRP, FBTC, FDOGE, minting, redemption, agents, and collateral
- **flare-fdc-skill**: Flare Data Connector domain knowledge, including attestation types (EVMTransaction, Web2Json, Payment), request flow, Merkle proofs, and contract verification
- **flare-smart-accounts-skill**: Smart Accounts domain knowledge for XRPL account abstraction on Flare
