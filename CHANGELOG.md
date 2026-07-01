# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **flare-fcc-skill**: Flare Confidential Compute (FCC) / TEE extension domain knowledge — confidential extensions in a Trusted Execution Environment, the TeeExtensionRegistry and TeeMachineRegistry, the InstructionSender contract pattern, OPType/OPCommand routing, the instruction lifecycle, the extension action handler, the types server, attestation and code-hash whitelisting, reproducible builds, and the Coston/Coston2 deploy lifecycle (sourced from `fce-extension-scaffold` and `fce-sign`)
- **flare-fcc-skill**: dedicated `fce-weather-insurance` section — WEATHER `FETCH`/`SETTLE`/`BUY` commands, policy lifecycle, public vs ECIES-encrypted private policies, `SettlementTime`, TEE signature verification, and the `extension-setup.sh`/`PAY_TOKEN` deploy notes
- **flare-smart-accounts-skill**: Failure Handling & Recovery section — atomic revert semantics of `executeDirectMintingWithData`, the `0xE0` skip-memo recovery flow (with `IgnoreMemoSet`), duplicate-nonce avoidance, and a link to the Recover Stuck Mint Transaction guide
- `DEVELOPER_HUB_SYNC.md` — tracks the last integrated `developer-hub` commit and documents the sync process

### Changed

- Synced skills with `developer-hub` up to commit `70c274bd` — FAssets direct-minting "Finalizing on Flare" entry points (`executeDirectMinting` vs `executeDirectMintingWithData`) and smart-account atomicity/failure-handling clarifications

## [v1.0.0](https://github.com/flare-foundation/flare-ai-skills) - 2026-02-12

### Added

- Initial release
- **flare-fassets-skill**: FAssets domain knowledge, including FXRP, FBTC, FDOGE, minting, redemption, agents, and collateral
- **flare-fdc-skill**: Flare Data Connector domain knowledge, including attestation types (EVMTransaction, Web2Json, Payment), request flow, Merkle proofs, and contract verification
- **flare-smart-accounts-skill**: Smart Accounts domain knowledge for XRPL account abstraction on Flare
