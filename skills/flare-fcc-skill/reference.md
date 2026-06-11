# Flare Confidential Compute (FCC) / TEE Extensions — Reference

Use these links for source repositories, contract surfaces, and the platform the TEEs run on. At time of writing the Flare Developer Hub does not yet have a dedicated FCC section, so the reference repos below are the authoritative source.

## Reference Repositories

- [flare-foundation/fce-extension-scaffold](https://github.com/flare-foundation/fce-extension-scaffold) — Runnable "Hello World" TEE extension (Go): contracts, deploy/registration tooling, types server, and Claude Code skills (`/create-extension`, `/rename-scaffold`, `/test-extension`, `/verify-deploy`). The starting point for building an extension.
- [fce-extension-scaffold README](https://github.com/flare-foundation/fce-extension-scaffold/blob/main/README.md) — Repo structure, env vars, ports, local + Coston2 deployment walkthroughs
- [Extension Development Guide](https://github.com/flare-foundation/fce-extension-scaffold/blob/main/docs/extension-guide.md) — How an extension works, architecture, the files you modify, the action-handler pattern, data flow
- [InstructionSender Contract Guide](https://github.com/flare-foundation/fce-extension-scaffold/blob/main/docs/instruction-sender.md) — On-chain entry point requirements, scaffold contract, writing a custom sender
- [Types Server Guide](https://github.com/flare-foundation/fce-extension-scaffold/blob/main/docs/types-server.md) — Decoding instruction data, registering decoders, the `/decode` API
- [Testing Guide](https://github.com/flare-foundation/fce-extension-scaffold/blob/main/docs/testing.md) — Writing and running extension tests
- [Making It Your Own](https://github.com/flare-foundation/fce-extension-scaffold/blob/main/docs/manual-setup.md) — Renaming the Hello World placeholders
- [Deployment Steps](https://github.com/flare-foundation/fce-extension-scaffold/blob/main/docs/deployment-steps.md) — Linear Coston/Coston2 deploy recipe

## Signing Example

- [flare-foundation/fce-sign](https://github.com/flare-foundation/fce-sign) — Example TEE extension that stores a private key and signs messages with it. Ships in Go, Python, and TypeScript (select with `LANGUAGE`). **Demo only**: it stores an encrypted secret on-chain, which is not safe for production.
- [fce-sign REPRODUCIBILITY.md](https://github.com/flare-foundation/fce-sign/blob/main/REPRODUCIBILITY.md) — `SOURCE_DATE_EPOCH`, reproducible image builds, and the cross-machine code-hash caveats for Python/TS
- [Flare Developer Hub — Private Key Extension Guide](https://dev.flare.network/fcc/guides/sign-extension) — Step-by-step walkthrough: contract code, offchain handler (Go/Python/TypeScript), Coston2 deployment with ngrok, end-to-end test, troubleshooting, and cleanup

## Contract Interfaces

These ship as minimal local interfaces in the scaffold and are slated to move into `flare-smart-contracts-v2` once published as a package:

- [`ITeeExtensionRegistry.sol`](https://github.com/flare-foundation/fce-extension-scaffold/blob/main/contracts/interfaces/ITeeExtensionRegistry.sol) — `sendInstructions(address[] teeIds, TeeInstructionParams params)`, `extensionsCounter()`, `getTeeExtensionInstructionsSender(uint256)`
- [`ITeeMachineRegistry.sol`](https://github.com/flare-foundation/fce-extension-scaffold/blob/main/contracts/interfaces/ITeeMachineRegistry.sol) — `getRandomTeeIds(uint256 extensionId, uint256 count)`
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
