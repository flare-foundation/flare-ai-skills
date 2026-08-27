# Flare Confidential Compute (FCC) / TEE Extensions — Reference

Use these links for official docs, source repositories, contract surfaces, and the platform the TEEs run on.

## Flare Developer Hub (FCC)

- [FCC Overview](https://dev.flare.network/fcc/overview) — Architecture, key features, Flare Compute Extensions, Protocol Managed Wallets, TEE-based FDC. FCC is in the final stages of development, available on Coston2 and Coston today, and coming to other Flare networks soon.
- [FCC Reference](https://dev.flare.network/fcc/reference) — Solidity ABI reference for the `FlareTeeManager` diamond and its facets: [`IFlareTeeManager`](https://dev.flare.network/fcc/reference/IFlareTeeManager), [`IExtensionManager`](https://dev.flare.network/fcc/reference/IExtensionManager), [`IMachineManager`](https://dev.flare.network/fcc/reference/IMachineManager), [`IVerification`](https://dev.flare.network/fcc/reference/IVerification), [`IOperationFees`](https://dev.flare.network/fcc/reference/IOperationFees), [`IOwnerAllowlist`](https://dev.flare.network/fcc/reference/IOwnerAllowlist), [`ITeeCommonErrors`](https://dev.flare.network/fcc/reference/ITeeCommonErrors)
- [TEE Public and Private Keys](https://dev.flare.network/fcc/tee-keys) — The per-machine identity keypair, ECDSA (sign/verify) vs ECIES (encrypt/decrypt), and the encrypt-off-chain/decrypt-inside-the-enclave pattern via `POST /decrypt`.
- [Data Providers and Cosigners](https://dev.flare.network/fcc/data-providers) — How instructions are relayed and signed by the Flare Systems Protocol data-provider set (>50% signing weight) before a TEE executes, and the cosigner gate for sensitive operations.
- [FCC Troubleshooting](https://dev.flare.network/fcc/troubleshooting) — `query-tee` diagnostics, stale tunnel URLs, `tee-node`/`tee-proxy` version skew, reserved `F_` operation names, and indexer DB credential issues.
- [Build Your First Extension (Getting Started)](https://dev.flare.network/fcc/guides/getting-started) — Hello World scaffold walkthrough: instruction lifecycle, the files you own, OPType/OPCommand customization, and deploying/testing on Coston2. Start here.
- [Private Key Extension Guide](https://dev.flare.network/fcc/guides/sign-extension) — Step-by-step walkthrough: contract code, offchain handler (Go/Python/TypeScript), Coston2 deployment with ngrok, end-to-end test, troubleshooting, and cleanup
- [Weather Insurance Extension Guide](https://dev.flare.network/fcc/guides/weather-insurance-extension) — Full FCC application: parametric rainfall insurance, ECIES-encrypted private policies, settlement via OpenWeatherMap data, Next.js frontend. Prerequisites: Docker Desktop, Foundry, Go, an HTTPS tunnel (ngrok or cloudflared) to port 6674, an OpenWeatherMap API key, and a funded Coston2 wallet.
- [FCC Whitepaper](https://dev.flare.network/pdf/whitepapers/20260706-FlareConfidentialCompute.pdf) — "Flare Confidential Compute: Powering Interoperability for Flare through TEEs" (Jul 6, 2026): the FCC mechanism, Protocol Managed Wallets, Flare Compute Extensions, and FDC2

## Reference Repositories

- [flare-foundation/fce-extension-scaffold](https://github.com/flare-foundation/fce-extension-scaffold) — Runnable "Hello World" TEE extension (Go): contracts, deploy/registration tooling, types server, and Claude Code skills (`/create-extension`, `/rename-scaffold`, `/test-extension`, `/verify-deploy`). The starting point for building an extension.
- [fce-extension-scaffold README](https://github.com/flare-foundation/fce-extension-scaffold/blob/main/README.md) — Repo structure, env vars, ports, local + Coston2 deployment walkthroughs
- [Extension Development Guide](https://github.com/flare-foundation/fce-extension-scaffold/blob/main/docs/extension-guide.md) — How an extension works, architecture, the files you modify, the action-handler pattern, data flow
- [InstructionSender Contract Guide](https://github.com/flare-foundation/fce-extension-scaffold/blob/main/docs/instruction-sender.md) — On-chain entry point requirements, scaffold contract, writing a custom sender
- [Extension Contract Guide](https://github.com/flare-foundation/fce-extension-scaffold/blob/main/docs/extension-contract.md) — Decoding instruction data (`DataFixed`), the on-chain contract surface
- [Testing Guide](https://github.com/flare-foundation/fce-extension-scaffold/blob/main/docs/testing.md) — Writing and running extension tests
- [Making It Your Own](https://github.com/flare-foundation/fce-extension-scaffold/blob/main/docs/manual-setup.md) — Renaming the Hello World placeholders
- [Deployment Steps](https://github.com/flare-foundation/fce-extension-scaffold/blob/main/docs/deployment-steps.md) — Linear Coston/Coston2 deploy recipe

## Signing Example

- [flare-foundation/fce-sign](https://github.com/flare-foundation/fce-sign) — Example TEE extension that stores a private key and signs messages with it. Ships in Go, Python, and TypeScript (select with `LANGUAGE`). **Demo only**: it stores an encrypted secret on-chain, which is not safe for production.
- [fce-sign REPRODUCIBILITY.md](https://github.com/flare-foundation/fce-sign/blob/main/REPRODUCIBILITY.md) — `SOURCE_DATE_EPOCH`, reproducible image builds, and the cross-machine code-hash caveats for Python/TS

## Weather Insurance Extension

- [flare-foundation/fce-weather-insurance](https://github.com/flare-foundation/fce-weather-insurance) — Full FCC application: parametric rainfall insurance using OpenWeatherMap data inside a TEE. Includes Go handler, `WeatherInsurance.sol`, ECIES-encrypted private policies, and a Next.js frontend.
- [flare-foundation/fce-weather-insurance-x402-agent](https://github.com/flare-foundation/fce-weather-insurance-x402-agent) — AI agent showcase: buys and settles weather insurance policies against the extension above using [x402 payments](https://dev.flare.network/fxrp/token-interactions/x402-payments).

## Contract Interfaces

Onchain, the registry surface lives behind one [EIP-2535](https://eips.ethereum.org/EIPS/eip-2535) diamond, `FlareTeeManager` — see the [FCC Reference](https://dev.flare.network/fcc/reference) link above for the full ABI. The scaffold's local interfaces map to its facets:

- [`ITeeExtensionRegistry.sol`](https://github.com/flare-foundation/fce-extension-scaffold/blob/main/contracts/interfaces/ITeeExtensionRegistry.sol) — `sendInstructions(address[] teeIds, TeeInstructionParams params)`, `nextPublicExtensionId()` (public extension IDs start at `0x10000`), `getTeeExtensionInstructionsSender(uint256)`; matches the diamond's `IExtensionManager` facet
- [`ITeeMachineRegistry.sol`](https://github.com/flare-foundation/fce-extension-scaffold/blob/main/contracts/interfaces/ITeeMachineRegistry.sol) — `getRandomTeeIds(uint256 extensionId, uint256 count)`; matches the diamond's `IMachineManager` facet
- [`InstructionSender.sol`](https://github.com/flare-foundation/fce-extension-scaffold/blob/main/contracts/InstructionSender.sol) — Reference on-chain entry point (`HelloWorldInstructionSender`)

## Related Flare Confidential Compute Work

- [flare-foundation/flare-ai-kit](https://github.com/flare-foundation/flare-ai-kit) — SDK for building verifiable AI agents on Flare using Confidential Space
- [Flare Foundation on GitHub](https://github.com/flare-foundation) — Full org, including `flare-smart-contracts-v2`
- [Flare Hackathon: Verifiable AI with Google Cloud Confidential Space](https://flare.network/news/flare-hackathon-winners) — Background on Flare's TEE/Confidential Space direction

## TEE Platform (GCP Confidential Space / AMD SEV)

- [Google Cloud Confidential Space overview](https://cloud.google.com/confidential-computing/confidential-space/docs/confidential-space-overview) — The platform Flare TEEs run on
- [Remote attestation in Confidential Space](https://docs.cloud.google.com/confidential-computing/docs) — How the attestation tokens / measurements that back the on-chain code hash work
- [AMD SEV](https://www.amd.com/en/developer/sev.html) — The memory-encryption technology behind the `GCP_AMD_SEV` platform value reported by the proxy `/info` endpoint

## Networks (deploy targets)

- **Coston2** (Flare testnet): RPC `https://coston2-api.flare.network/ext/C/rpc`, chain ID `114`, faucet `https://faucet.flare.network/coston2`
- **Coston** (Songbird testnet): RPC `https://coston-api.flare.network/ext/C/rpc`, faucet `https://faucet.flare.network/coston`
- See the [flare-general skill](../flare-general-skill/SKILL.md) and [Flare Developer Hub](https://dev.flare.network/) for the full network table.

## Key Operational Values

- **Attestation mode:** `MODE=0` = production attestation (FTDC-accepted); `MODE=1` = simulated (rejected on testnet/mainnet).
- **Local vs live:** `LOCAL_MODE=true` skips attestation for local dev; set `false` on Coston/Coston2. Pair with `SIMULATED_TEE=false`.
- **Reproducible builds:** set `SOURCE_DATE_EPOCH` (e.g. `git log -1 --format=%ct`) so the same source yields the same code hash. Go is bit-for-bit cross-machine; Python/TS are best-effort.
- **`register-tee -command rRap`** — issues a fresh attestation challenge on re-runs (avoids `Verification.ChallengeExpired`).
- **Proxy `/info` → `machineData`:** `platform` starts `0x4743505f414d445f534556…` (GCP_AMD_SEV); `codeHash` must be a real measured hash (not the simulated `0x194844cf…`); `extensionId`/`initialOwner` must match `config/extension.env`.
