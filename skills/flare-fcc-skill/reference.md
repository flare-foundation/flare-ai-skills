# Flare Confidential Compute (FCC) / TEE Extensions — Reference

Use these links for official docs, source repositories, contract surfaces, and the platform the TEEs run on.

## Flare Developer Hub (FCC)

- [FCC Overview](https://dev.flare.network/fcc/overview) — Architecture, instructions vs direct actions, Flare Compute Extensions, Protocol Managed Wallets, TEE-based FDC. FCC is in the final stages of development, available on Coston2, Coston, and Songbird today, and coming to other Flare networks soon.
- [TEE Public and Private Keys](https://dev.flare.network/fcc/tee-keys) — The per-machine identity keypair, ECDSA (sign/verify) vs ECIES (encrypt/decrypt), and decrypting inside the enclave through the sign port.
- [Data Providers and Cosigners](https://dev.flare.network/fcc/data-providers) — How instructions are relayed and signed by the Flare Systems Protocol data-provider set (>50% signing weight) before a TEE executes, and the cosigner gate for sensitive operations.
- [Instruction Fees](https://dev.flare.network/fcc/instruction-fees) — Protocol fee (per operation pair, per TEE) vs project fee (`setProjectFee`, once per instruction), `quoteFee(opType, opCommand)`, `InsufficientFee` vs `FeeTooLow`.
- [FCC Troubleshooting](https://dev.flare.network/fcc/troubleshooting) — `fce status`, `fce` refusals, machine never reaching production, protocol redeploys, send reverts, result errors, reserved `F_` operation names, test vs production machines, migrating from the legacy scaffold.
- [FCC Whitepaper](https://dev.flare.network/pdf/whitepapers/20260706-FlareConfidentialCompute.pdf) — "Flare Confidential Compute: Powering Interoperability for Flare through TEEs" (Jul 6, 2026): the FCC mechanism, Protocol Managed Wallets, Flare Compute Extensions, and FDC2

## Developer Guides

- [Guides index](https://dev.flare.network/fcc/guides) — All FCC guides (Coston2, FCE Go scaffold, `fce` CLI)
- [Build Your First Extension](https://dev.flare.network/fcc/guides/getting-started) — Install `fce`, fork `fce-go-scaffold`, the template's instruction (`MY_COMMAND`) and direct (`MY_DIRECT_COMMAND`) ops, `ExtensionBase`, `fce conformance`/`deploy`/`add-version -test`/`governance`/`run`/`send`/`direct`, going to production. Start here.
- [External API Extension](https://dev.flare.network/fcc/guides/external-api-extension) — Fetch prices over TLS from three APIs inside the TEE, long-running results with partial statuses, TEE-signed median verified onchain via `_teeSigner`
- [Direct Actions Extension](https://dev.flare.network/fcc/guides/direct-actions-extension) — Admin key set onchain, ECIES-encrypted secrets provisioned as signed direct actions, replay protection, sealed-bid auction, state verifier (`verifyTeeState`)
- [Wallets Extension](https://dev.flare.network/fcc/guides/wallets-extension) — Sign EIP-1559 transactions with a wallet key `tee-node` generates in the TEE; manual onchain wallet setup; nonces and replacement; restarts and backups
- [Deploy a TEE on Google Cloud](https://dev.flare.network/fcc/guides/deploy-on-gcp) — `fcc-node-suite-deployment` Terraform: Confidential Space tee-machine, tee-proxy, C-chain indexer; manual machine registration on `FlareTeeManager`

## Contract Reference (`FlareTeeManager` diamond)

- [FCC Reference](https://dev.flare.network/fcc/reference) — Solidity ABI reference index
- Core: [`IFlareTeeManager`](https://dev.flare.network/fcc/reference/IFlareTeeManager) (aggregate ABI), [`ITeeCommonErrors`](https://dev.flare.network/fcc/reference/ITeeCommonErrors)
- Extensions and TEE machines: [`IExtensionManager`](https://dev.flare.network/fcc/reference/IExtensionManager), [`IMachineManager`](https://dev.flare.network/fcc/reference/IMachineManager), [`IVerification`](https://dev.flare.network/fcc/reference/IVerification), [`IOwnerAllowlist`](https://dev.flare.network/fcc/reference/IOwnerAllowlist)
- Instructions: [`IInstructions`](https://dev.flare.network/fcc/reference/IInstructions) (`sendInstructions`, `TeeInstructionParams`, `TeeInstructionsSent`), [`IOperationFees`](https://dev.flare.network/fcc/reference/IOperationFees)
- Protocol Managed Wallets: [`IWalletProjectManager`](https://dev.flare.network/fcc/reference/IWalletProjectManager) (projects, key type, signing algorithm, backup manager), [`IWalletManager`](https://dev.flare.network/fcc/reference/IWalletManager) (wallet lifecycle `NONE → CREATED → INITIALIZED → PRODUCTION ⇄ PAUSED`, admins, cosigners), [`IWalletKeyManager`](https://dev.flare.network/fcc/reference/IWalletKeyManager) (`addKey`, `confirmKey`, multisig threshold, receiving TEEs)

## Reference Repositories

- [flare-foundation/fce-go-scaffold](https://github.com/flare-foundation/fce-go-scaffold) — The scaffold to fork: `template/`, `examples/external-api`, `examples/direct`, `examples/wallets`, the Go library (`pkg/extension`, `pkg/payload`), and `sol/src/ExtensionBase.sol`
  - [Extension guide](https://github.com/flare-foundation/fce-go-scaffold/blob/main/docs/extension-guide.md) — Errors, long-running jobs, state, the TEE key, wallet keys, environment variables
  - [Rules](https://github.com/flare-foundation/fce-go-scaffold/blob/main/docs/rules.md) — Every requirement an extension must meet and what enforces it
  - [Extension contract](https://github.com/flare-foundation/fce-go-scaffold/blob/main/docs/extension-contract.md) — Language-agnostic `tee-node` ↔ extension wire protocol
  - [Contracts guide](https://github.com/flare-foundation/fce-go-scaffold/blob/main/docs/contracts.md) — `ExtensionBase`, consuming results onchain, sending to several TEEs
  - [Direct actions](https://github.com/flare-foundation/fce-go-scaffold/blob/main/docs/direct-actions.md) and [assumptions](https://github.com/flare-foundation/fce-go-scaffold/blob/main/docs/assumptions.md) — Trust model
  - [Forking guide](https://github.com/flare-foundation/fce-go-scaffold/blob/main/docs/fork.md), [production draft](https://github.com/flare-foundation/fce-go-scaffold/blob/main/docs/production.md)
- [flare-foundation/fce-tooling](https://github.com/flare-foundation/fce-tooling) — The `fce` CLI
- [flare-foundation/fcc-node-suite-deployment](https://github.com/flare-foundation/fcc-node-suite-deployment) — Terraform for Confidential Space tee-machine, tee-proxy, and indexer ([`TESTING.md`](https://github.com/flare-foundation/fcc-node-suite-deployment/blob/main/TESTING.md), [`modules/tee-package/README.md`](https://github.com/flare-foundation/fcc-node-suite-deployment/blob/main/modules/tee-package/README.md))
- [flare-foundation/fce-weather-insurance-x402-agent](https://github.com/flare-foundation/fce-weather-insurance-x402-agent) — AI agent showcase composing a Flare Compute Extension with [x402 payments](https://dev.flare.network/fxrp/token-interactions/x402-payments)
- *Legacy (replaced by `fce-go-scaffold`):* `fce-extension-scaffold`, `fce-sign`, `fce-weather-insurance`

## Related Flare Confidential Compute Work

- [flare-foundation/flare-ai-kit](https://github.com/flare-foundation/flare-ai-kit) — SDK for building verifiable AI agents on Flare using Confidential Space
- [Flare Foundation on GitHub](https://github.com/flare-foundation) — Full org, including `flare-smart-contracts-v2`

## TEE Platform (GCP Confidential Space)

- [Google Cloud Confidential Space overview](https://cloud.google.com/confidential-computing/confidential-space/docs/confidential-space-overview) — The platform Flare TEEs run on
- [Remote attestation in Confidential Space](https://docs.cloud.google.com/confidential-computing/docs) — How the attestation tokens / measurements that back the on-chain code hash work
- [AMD SEV](https://www.amd.com/en/developer/sev.html) — The memory-encryption technology behind the `GCP_AMD_SEV` platform value (`GCP_INTEL_TDX` is also supported)
- [IAP TCP forwarding](https://cloud.google.com/iap/docs/using-tcp-forwarding) — How the GCP guide reaches the private VMs

## Networks (deploy targets)

- **Coston2** (Flare testnet, used by all guides): RPC `https://coston2-api.flare.network/ext/C/rpc`, chain ID `114`, faucet `https://faucet.flare.network/coston2`
- **Coston** (Songbird testnet): RPC `https://coston-api.flare.network/ext/C/rpc`, faucet `https://faucet.flare.network/coston`
- See the [flare-general skill](../flare-general-skill/SKILL.md) and [Flare Developer Hub](https://dev.flare.network/) for the full network table.

## Key Operational Values

- **Test vs production:** `fce run` = `tee-node` test mode (`MODE=1`), fixed test code hash `0x194844cf…` on `TEST_PLATFORM`; production = Confidential Space with `MODE=0`, hash allowed via `fce add-version -platform GCP_AMD_SEV,GCP_INTEL_TDX`. Disable the test hash with `fce disable-version -test` (permanent) before real users.
- **Handler timing:** 1.5 s per handler, `tee-node` waits 2 s; longer work returns a `Run` (status `2`, partials `4`–`255`).
- **Result statuses:** `0` error (final), `1` ok (final), `2` pending, `3` node timeout, `4`–`255` partial.
- **Proxy endpoints:** `GET /info` (`.teeInfo.publicKey`, `.teeInfo.lastSigningPolicyId`, `.teeInfo.state`, `.machineData`), `POST /direct` (`X-Api-Key`), `GET /action/result/<id>` (`?submissionTag=submit` for direct actions, `?submissionTag=threshold` for registration).
- **Proxy `/info` → `machineData` (production):** `platform` starts `0x4743505f414d445f534556` (`GCP_AMD_SEV`); `codeHash` = the hash `fce add-version` recorded; `extensionId`/`initialOwner` match `deployments/<chain>.json`.
- **Signature `V`:** sign port and `/info` return `V` as `0`/`1`; add 27 before `ecrecover` or `register`.
- **Flare contract registry:** `0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019` on all networks (resolve `FlareTeeManager`, `Relay`, `FlareSystemsManager`, `VoterRegistry`).
