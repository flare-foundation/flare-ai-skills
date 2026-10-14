---
name: flare-fcc
description: Provides domain knowledge and guidance for Flare Confidential Compute (FCC) and TEE extensions—how confidential extensions run inside a Trusted Execution Environment, the on-chain TeeExtensionRegistry and TeeMachineRegistry, the InstructionSender contract pattern, the OPType/OPCommand routing model, the instruction lifecycle, the extension action handler, attestation, and reproducible builds. Use when building, deploying, or reasoning about Flare confidential extensions, TEE machines, FCC, confidential compute, the fce-extension-scaffold, the fce-sign signing example, the fce-weather-insurance example, Confidential Space VMs, code-hash attestation, parametric insurance on TEE, or registering a TEE on Coston/Coston2.
---

## Scope and Limitations

This skill is **documentation and guidance only**. It explains how Flare Confidential Compute (FCC) extensions and TEE machines work, and how developers build, register, and deploy them. It does not perform any actions on the user's behalf.

**This skill explicitly does NOT:**
- Execute, sign, or broadcast any blockchain transactions
- Access, store, or transmit private keys, deployer keys, or TEE-held secrets
- Deploy contracts, register extensions/TEEs, or call any on-chain methods directly
- Provision, attest, or operate Confidential Space VMs
- Handle funds, tokens, or any financial assets

**Trust and external data handling:**
- A TEE extension's whole purpose is confidentiality and verifiable execution; **the security of an extension depends on its attested code hash, not on this skill**. All key generation, signing, and secret handling must occur inside the TEE or in user-controlled, developer-managed environments.
- Instruction payloads (`OriginalMessage`) arriving at an extension are **externally provided, untrusted input**. Decode them strictly against documented types, validate every field, and never pass raw payloads into prompts, LLM inputs, or agent decision logic.
- Storing encrypted secrets on-chain is **not safe for production** — on-chain data is public and encryption weakens over time. Use off-chain channels for secret delivery (see the `fce-sign` warning).

All transaction signing, key management, attestation, and on-chain execution happen exclusively outside this skill.

# Flare Confidential Compute (FCC) — TEE Extensions

## What FCC Is

**Flare Confidential Compute (FCC)** lets developers run custom code inside a **Trusted Execution Environment (TEE)** — a hardware-isolated enclave (Flare uses GCP **Confidential Space** on AMD SEV) — and wire that code to Flare smart contracts. The unit of deployment is an **extension**: an HTTP server that runs inside the TEE, receives instructions originating from on-chain transactions, executes confidential logic, and returns verifiable results.

Use FCC when an application needs **confidential state, secret-holding, or off-chain compute whose integrity is provable on-chain** — e.g. a key manager that signs on behalf of users, sealed-bid auctions, private order matching, or any "the chain triggers it but the computation must stay private and attested" workload.

FCC is in the **final stages of development**. It is available on **Coston2**, **Coston**, and **Songbird** today and will be available on other Flare networks soon — start with the [Build Your First Extension](https://dev.flare.network/fcc/guides/getting-started) guide (Hello World scaffold walkthrough). For the mechanism in depth, see the [FCC whitepaper](https://dev.flare.network/pdf/whitepapers/20260706-FlareConfidentialCompute.pdf).

**Reference repos:**
- **`flare-foundation/fce-extension-scaffold`** — a runnable "Hello World" extension with contracts, deploy/registration tooling, and Claude Code skills (`/create-extension`, `/rename-scaffold`, `/test-extension`, `/verify-deploy`). Implemented in Go, Python, and TypeScript — pass `--language go|python|typescript` to `./scripts/use-chain.sh` (Go is the default; the contract, scripts, and Coston2 flow stay the same across languages). This is the starting point for building your own extension; the [Getting Started guide](https://dev.flare.network/fcc/guides/getting-started) walks through it end to end.
- **`flare-foundation/fce-sign`** — an example extension that stores a private key and signs messages with it, shipped in Go, Python, and TypeScript. Demonstrates the TEE signing port and reproducible builds. Explicitly demo-only for the on-chain-secret part.
- **`flare-foundation/fce-weather-insurance`** — a full FCC application demonstrating parametric rainfall insurance. Policyholders buy cover on-chain; the TEE fetches OpenWeatherMap data and signs settlement results; anyone calls `settle()` to verify and pay out. Supports public and ECIES-encrypted private policies. Includes a Next.js dApp frontend.

## The Instruction Lifecycle

An extension controls only two things: the **on-chain contract** (step 1) and the **action handler** (step 6). The TEE infrastructure handles everything between.

```
1. User calls your InstructionSender contract (on-chain)
2. Contract routes through TeeExtensionRegistry.sendInstructions() → emits TeeInstructionsSent
3. TEE proxy picks up the instruction from the chain
4. TEE node fetches the instruction from the proxy
5. TEE node forwards it as POST /action to your extension server (inside the TEE)
6. Your extension decodes, validates, executes, and returns a result
7. TEE node returns the (optionally cosigned) result to the proxy
8. Caller polls the proxy for the result
```

## On-Chain Building Blocks

Two protocol contracts (from `flare-smart-contracts-v2`) front the system:

- **`TeeExtensionRegistry`** — the registry of extensions and the only path to submit instructions. Key surface:
  - `sendInstructions(address[] _teeIds, TeeInstructionParams _params) payable returns (bytes32 instructionId)` — the single entry point. `TeeInstructionParams` = `{ bytes32 opType; bytes32 opCommand; bytes message; address[] cosigners; uint64 cosignersThreshold; address claimBackAddress; }`.
  - `nextPublicExtensionId()` and `getTeeExtensionInstructionsSender(uint256 extensionId)` — used to discover an extension's ID. Public extension IDs start at `0x10000` (65536); IDs below that are reserved for system extensions, so `setExtensionId()` scans from `0x10000` up to `nextPublicExtensionId()`, not from zero.
  - **Access control:** when you register an extension you bind it to one **InstructionSender address**. The registry rejects any `sendInstructions` call whose `msg.sender` isn't that address — no EOA, no other contract.
- **`TeeMachineRegistry`** — maps extensions to the TEE machines serving them. `getRandomTeeIds(uint256 _extensionId, uint256 _count)` picks machine addresses to route an instruction to (use `_count > 1` to fan one instruction out to multiple TEEs).

Onchain both live behind **one [EIP-2535](https://eips.ethereum.org/EIPS/eip-2535) diamond, `FlareTeeManager`** — call the diamond address; `IFlareTeeManager` is the aggregate interface. `TeeExtensionRegistry`'s surface above is the diamond's `IExtensionManager` facet; `TeeMachineRegistry`'s is `IMachineManager`. Two more facets matter day-to-day: `IVerification` (attestation/availability-check requests, cosigners, `ChallengeExpired`/`InvalidAttestation` errors) and `IOperationFees` (per-instruction fee lookup — `getOperationFee`, `calculateFeeByTeeIds`). `IOwnerAllowlist` gates who may register an extension/machine/wallet project owner. `ITeeCommonErrors` holds errors shared across facets, including the ones already covered above (`TooMany`, `ChallengeExpired`, `InvalidGovernanceHash`). Full ABI reference: [FCC Reference](https://dev.flare.network/fcc/reference) ([`IFlareTeeManager`](https://dev.flare.network/fcc/reference/IFlareTeeManager), [`IExtensionManager`](https://dev.flare.network/fcc/reference/IExtensionManager), [`IMachineManager`](https://dev.flare.network/fcc/reference/IMachineManager), [`IVerification`](https://dev.flare.network/fcc/reference/IVerification), [`IOperationFees`](https://dev.flare.network/fcc/reference/IOperationFees), [`IOwnerAllowlist`](https://dev.flare.network/fcc/reference/IOwnerAllowlist), [`ITeeCommonErrors`](https://dev.flare.network/fcc/reference/ITeeCommonErrors)). Resolve `FlareTeeManager` through the `FlareContractRegistry` at runtime rather than hardcoding its address once it ships on mainnet; deployed today on Coston2, Coston, and Songbird.

### The InstructionSender contract

This is **your** contract and the only address allowed to submit instructions for your extension. Minimum requirements:

1. **Know its extension ID** — to look up serving TEE machines. The scaffold's `setExtensionId()` scans the registry (starting at `0x10000`, the first public extension ID) after registration and caches the ID (set-once).
2. **Call `sendInstructions` on `TeeExtensionRegistry`** with at least one `teeId`, the `opType`/`opCommand` `bytes32` identifiers, a non-empty `message`, and (usually empty) cosigners.
3. **Be `payable` and forward `msg.value`** — the registry charges a per-instruction fee.
4. **Exist before registration** — you register by passing the deployed InstructionSender address.

The scaffold's `HelloWorldInstructionSender` is a ready template: it defines `bytes32` operation constants and one `payable` send function per action (`sendSayHello`, `sendSayGoodbye`). You can also write a minimal custom sender for custom access control, on-chain validation, multi-TEE routing, cosigner workflows, or batching — the registry only cares that the registered address calls `sendInstructions` with valid params.

## The OPType / OPCommand Routing Model

The contract and the extension code are linked by a two-level identifier that **must match exactly across three layers**:

| Layer | Operation type | Command |
|-------|----------------|---------|
| Solidity | `bytes32 OP_TYPE_GREETING = bytes32("GREETING")` | `bytes32 OP_COMMAND_SAY_HELLO = bytes32("SAY_HELLO")` |
| Go config | `OPTypeGreeting = "GREETING"` | `OPCommandSayHello = "SAY_HELLO"` |
| Go router | `dataFixed.OPType == teeutils.ToHash(config.OPTypeGreeting)` | `df.OPCommand == teeutils.ToHash(config.OPCommandSayHello)` |

`OPType` selects an operation group; `OPCommand` sub-routes within it. A mismatched `OPType` falls through to "unsupported op type"; a mismatched `OPCommand` to "unsupported op command". `bytes32("...")` only holds up to 31 bytes — keep identifiers short.

**Reserved names:** the `F_` prefix on `OPType` is reserved for Flare system operations (`F_REG`, `F_WALLET`, `F_GET`, `F_POLICY`, `F_GOVERNANCE`, `F_XRP`, `F_BTC`, `F_FDC2`) — never prefix your own `OPType` with `F_`. Their command names are reserved too (`TEE_ATTESTATION`, `TEE_INFO`, `TEE_BACKUP`, `KEY_GENERATE`, `KEY_INFO`, `KEY_PROOF`, `KEY_DELETE`, `KEY_DIRECT_BACKUP`, `KEY_DIRECT_RESTORE`, `KEY_DATA_PROVIDER_RESTORE`, `INITIALIZE_POLICY`, `UPDATE_POLICY`, `SET_MACHINE_PATH_LIST`, `PAY`, `REISSUE`, `VRF`, `PROVE`) — reusing one of these command names under your own non-`F_` `OPType` passes local validation silently but the instruction never reaches your extension (no error at all), so pick domain-specific names for both.

## TEE Keys and the Signing Model

Each TEE machine generates an **identity key pair** at boot (ECDSA on secp256k1, matching Ethereum-style keys). The private half never leaves the enclave.

- **Public key** — verifiable identity; can live on-chain or be served from the proxy `/info` endpoint. Anyone can **verify** ECDSA signatures and **encrypt** ECIES payloads to it.
- **Private key** — enclave-only. Used to **sign** results (ECDSA) and **decrypt** payloads (ECIES) sent to that machine.

**ECDSA** proves origin (a stamp on a public message); **ECIES** hides content (a lockbox only the matching private key opens). Do not confuse the two — encrypting with the private key is backwards.

Pattern for secrets: **encrypt off-chain to the TEE's public key, decrypt only inside the enclave.** The extension does not hold the identity private key itself — it calls the TEE node locally (`POST /decrypt` on the sign port, localhost-only) and the node decrypts using the enclave-held key. Encryption hides bytes; it does not replace the consensus check below.

**Data providers and cosigners** gate who may make the TEE do work at all. An on-chain instruction only runs after [Flare Systems Protocol](https://dev.flare.network/network/fsp) data providers relay and **sign** it with **more than 50% of the current signing-policy weight** (the same weighted set backing FTSO/FDC) — a proxy cannot authorize work on its own. **Cosigners** add a second, independent authorization gate for sensitive operations (payments, key administration): both stamps — provider weight and cosigner threshold — must be present or the TEE does not execute.

See [TEE public and private keys](https://dev.flare.network/fcc/tee-keys) and [Data providers and cosigners](https://dev.flare.network/fcc/data-providers) for the full mechanism.

## The Extension (Go) — Action Handler

Inside the TEE, the extension is an HTTP server. The TEE node delivers each instruction as `POST /action`. You implement `processAction`, which parses `instruction.DataFixed` (carrying `OPType`, `OPCommand`, and the raw `OriginalMessage`) out of the action and routes on `OPType`, then on `OPCommand`.

Each handler follows the same **4-step pattern**:

```go
func (e *Extension) processSayHello(action teetypes.Action, df *instruction.DataFixed) teetypes.ActionResult {
    // 1. DECODE the raw OriginalMessage (JSON here; use structs.DecodeTo for ABI-encoded)
    var req types.SayHelloRequest
    dec := json.NewDecoder(bytes.NewReader(df.OriginalMessage))
    dec.DisallowUnknownFields()
    if err := dec.Decode(&req); err != nil {
        return buildResult(action, df, nil, 0, fmt.Errorf("decoding request: %w", err))
    }

    // 2. VALIDATE every field — this is untrusted external input
    if req.Name == "" {
        return buildResult(action, df, nil, 0, fmt.Errorf("name must not be empty"))
    }

    // 3. EXECUTE your confidential logic (guard shared state with the mutex)
    e.mu.Lock()
    e.greetingCount++
    n := e.greetingCount
    e.mu.Unlock()

    // 4. BUILD the result: status 1 = success (data returned), status 0 = error (err logged)
    data, _ := json.Marshal(types.SayHelloResponse{Greeting: "Hello, " + req.Name, GreetingNumber: n})
    return buildResult(action, df, data, 1, nil)
}
```

**Files a developer modifies** — one language directory plus the Solidity contract (the scaffold marks them ★, and `/rename-scaffold` automates renaming the Hello World placeholders):

| Role | Go | Python | TypeScript |
| ---- | -- | ------ | ---------- |
| `OPType`/`OPCommand` constants (+ SemVer `Version` in Go) | `go/internal/config/config.go` | `python/app/config.py` | `typescript/src/app/config.ts` |
| Handlers (main customization point) | `go/internal/extension/extension.go` | `python/app/handlers.py` (wire in `register()`) | `typescript/src/app/handlers.ts` (wire in `register()`) |
| Request/response types | `go/pkg/types/types.go` | inline in handlers | inline in handlers |
| ABI decoding | `go/pkg/types/types.go` | `python/app/abi.py` | `typescript/src/app/abi.ts` |
| Shared | `contracts/InstructionSender.sol` (matching `bytes32` constants + send functions), `tools/cmd/run-test/main.go` (E2E payloads/assertions) | — | — |

Leave the framework layer intact: `go/internal/extension/utils.go` and `pkg/server/` (Go), `python/base/`, `typescript/src/base/`. The constant strings must be identical in the contract and in every implementation you run.

The scaffold's Coston2 walkthrough mirrors fce-sign below: `./scripts/use-chain.sh coston2 --simulated [--language python|typescript]` → set deployer keys in `.env.local.coston2` → fill `[db]` in the generated proxy TOML → `./scripts/full-setup.sh --chain coston2 --test`. `start-services.sh` starts a Cloudflare tunnel to port 6674 and writes `EXT_PROXY_URL` for you; per-chain artifacts land in `config/coston2/extension.env`.

After editing the contract, run `./scripts/generate-bindings.sh` to regenerate Go bindings.

### TEE signing port

Extensions that need to sign, attest, or encrypt with TEE-managed keys call the TEE's **sign port** (e.g. `localhost:7701`/`SIGN_PORT`, or `9090` in some docs — read the scaffold's config) from inside the extension. This is how `fce-sign` signs messages without the key ever leaving the enclave.

## fce-sign: Private Key Extension Example

The `fce-sign` repo demonstrates the full TEE workflow: store an ECIES-encrypted private key, sign arbitrary messages. Available in Go, Python, and TypeScript (select with `use-chain.sh --language`).

### Docker Service Architecture

Three containers run as Docker services:

- **`extension-tee`** — your extension code. Receives decoded instructions from the proxy and returns results.
- **`ext-proxy`** — watches the chain for new instructions, forwards them to your handler, submits results back on-chain.
- **`redis`** — in-memory store used by the proxy.

For local runs a fourth container, **`cloudflared`**, publishes the proxy on a public HTTPS URL so Flare's infrastructure can deliver instructions. It lives in its own compose project (`tunnel`, `docker-compose.cloudflared.yaml`) shared across extensions — `start-services.sh` reuses one that is already running.

### Port Reference (fce-sign)

| Service            | Container port | Host port |
|--------------------|----------------|-----------|
| ext-proxy internal | 6663           | 6673      |
| ext-proxy external | 6664           | 6674      |
| redis              | 6379           | 6382      |

The tunnel exposes host port **6674** (ext-proxy external) to the internet. The internal port 6673 is used for communication between the extension container and the proxy within Docker.

### Deploying fce-sign on Coston2 (Local Simulated TEE)

Prerequisites: Docker Desktop (Linux containers), Foundry plus `jq` and `curl`, Go (deploy tooling in `go/tools/`), indexer DB credentials, a funded Coston2 wallet. No ngrok needed — `start-services.sh` starts a Cloudflare quick tunnel.

After steps 0–2 the whole lifecycle runs in one command (`pre-build.sh` → `start-services.sh` → `post-build.sh` → `test.sh`):
```bash
./scripts/full-setup.sh --chain coston2 --test
```

**Step 0 — Activate the chain and language:**
```bash
./scripts/use-chain.sh coston2 --simulated --language go   # or python / typescript
```
Creates anything missing (never overwrites) and copies the chosen env over `.env`: `.env.coston2`, `.env.local.coston2` (the `--simulated` variant), `config/proxy/extension_proxy.coston2.docker.toml` (addresses filled, `[db]` left to you), and `docker-compose.coston2.yaml`. `--simulated` sets `SIMULATED_TEE=true`, `LOCAL_MODE=false` (real Coston2 chain, simulated attestation), plus `CHAIN`, `CHAIN_ID=114`, `CHAIN_URL`, `ADDRESSES_FILE`, `NORMAL_PROXY_URL`. Every other script reads `CHAIN` from `.env`, and artifacts live per chain under `config/<chain>/`. Inspect with `--list` (chains with a `.env.<chain>`), `--status` (active chain/mode/language/config files), `--versions` (`tee-node`/`tee-proxy` pins vs latest upstream). A directory counts as a language implementation when it has a `language.env` manifest — drop one in to add a language.

**Step 1 — Configure deployer keys** in `.env.local.coston2` (**never edit `.env`** — it is a disposable copy `use-chain.sh` overwrites):
```bash
DEPLOYMENT_PRIVATE_KEY="<funded-coston2-private-key-hex-no-0x>"
INITIAL_OWNER="0x<your-address>"
```
Re-run `use-chain.sh coston2 --simulated` after editing so `.env` picks up changes.

**Step 2 — Configure the indexer DB:** edit the `[db]` block of the already-generated `config/proxy/extension_proxy.coston2.docker.toml` with the Coston2 indexer credentials (host `34.38.42.208`, port `3306`, database `indexer`). Credentials are provided on request via [support](https://flare.network/resources/technical-support) or [@flare_network](https://x.com/flare_network).

**Step 3 — Deploy contract and register extension:**
```bash
./scripts/pre-build.sh
```
Compiles Solidity, deploys `InstructionSender`, registers the extension on-chain. Writes `EXTENSION_ID` and `INSTRUCTION_SENDER` to `config/coston2/extension.env`.

> **Warning:** once `config/coston2/extension.env` exists, pre-build refuses to run again. Use `--force` only when intentionally creating a new extension — it deploys a new `InstructionSender` and registers a new extension ID, which will cause `MachineManager.TooMany()` if an older TEE machine is still registered under the previous extension ID.

**Step 4 — Start the extension stack:**
```bash
./scripts/start-services.sh
```
Builds the extension image, starts redis, ext-proxy, and extension-tee, and (with `SIMULATED_TEE=true`) starts a Cloudflare tunnel to host port **6674**, writes `EXT_PROXY_URL` into `.env` and `.env.local.coston2`, then waits for the public `/info`. To use ngrok instead: start `ngrok http 6674` first, set `EXT_PROXY_URL` in `.env.local.coston2`, re-run `use-chain.sh`, then start services.

> **Security:** the tunnel makes your local **ext-proxy** public — anyone with the URL can call the proxy HTTP API. Use it only for Coston2 testnet and stop it with `./scripts/stop-services.sh --chain coston2` when finished.

> **The tunnel URL is written on-chain once.** Flare delivers instructions to the URL stored in `MachineManager` at `post-build.sh` registration — it is never rewritten. A quick tunnel mints a new hostname every start, so a restarted tunnel makes a healthy TEE look dead (on-chain calls succeed, every poll times out). Repoint with `./scripts/update-tee-url.sh` (one transaction, no re-attestation; defaults to `EXT_PROXY_URL`), or use a named Cloudflare tunnel.

**Step 5 — Verify the proxy:**
```bash
curl -s "$EXT_PROXY_URL/info" | jq '.machineData'
```
Simulated TEE: `codeHash` = `0x194844cf…` (production rejects it), `extensionId` matches `config/coston2/extension.env`, `initialOwner` matches your address.

**Step 6 — Register the TEE machine:**
```bash
./scripts/post-build.sh
```
Runs three onchain steps: `allow-tee-version` (whitelists code hash), `set-governance` (registers the extension's TEE governance signer set/threshold — defaults to the deployer as sole signer with threshold 1 unless you set `GOVERNANCE_SIGNERS`/`GOVERNANCE_THRESHOLD`), and `register-tee -command rRap` (registers the machine, issues fresh attestation, runs FTDC check, promotes to production). The governance set must match what the `extension-tee` node container was given, or registration reverts with `InvalidGovernanceHash`. Before the availability check the tooling compares the FDC2 proxy's signing policy with the on-chain reward epoch and fails fast with `ErrPolicyOutOfSync` rather than polling a round that never appears.

**Step 7 — Run end-to-end test:**
```bash
./scripts/test.sh
```
Sequence: `setExtensionId()` (idempotent) → fetch TEE public key → ECIES-encrypt a fixed test private key → `updateKey` on-chain, poll → `sign` on-chain, poll → ABI-decode and `ecrecover` the signer, asserting it matches the test key's address (the real assertion).

Switching language (e.g. re-running `use-chain.sh ... --language python` then `start-services.sh`) builds a different image and therefore a different `codeHash` — re-run `post-build.sh` before `test.sh`.

### Python and TypeScript Handler Framework

Python and TypeScript use a `Framework` class that registers handlers by `(opType, opCommand)` pair:

```python
def register(framework: Framework) -> None:
    framework.handle(OP_TYPE_KEY, OP_COMMAND_UPDATE, handle_key_update)
    framework.handle(OP_TYPE_KEY, OP_COMMAND_SIGN, handle_key_sign)
```

Each handler receives a hex-encoded `originalMessage` and returns `(data, status, error)`:
- **`data`:** hex-encoded return data written back on-chain, or `None`
- **`status`:** `0` = error, `1` = success, `>=2` = pending
- **`error`:** error message string if the handler failed

The `base/` package (Python/TypeScript) provides `hex_to_bytes`/`bytes_to_hex` and the `Framework` HTTP server. **Do not modify `base/`** — it is framework infrastructure. The Python and TypeScript frameworks serialize handler calls, so module-level state is safe; in Go, protect shared state with a mutex.

### fce-sign Project Structure

```
sign/
├── contracts/                   # Solidity contracts (shared)
├── config/
│   ├── coston2/                 # Per-chain artifacts
│   │   ├── deployed-addresses.json
│   │   └── extension.env        # Generated by pre-build.sh
│   └── proxy/                   # ext-proxy TOML configs
├── docs/                        # getting-started, deployment-steps, cloudflared, testing
├── scripts/                     # use-chain.sh, full-setup.sh, pre-build.sh, start-services.sh, post-build.sh,
│                                # test.sh, check-tee-machines.sh, update-tee-url.sh, stop-services.sh
├── go/internal/extension/       # Go business logic (modify)
├── go/tools/cmd/                # Deploy CLIs (Go-only, shared across all languages)
├── python/app/                  # Python business logic (modify)
├── python/base/                 # Framework infrastructure (do not modify)
├── typescript/src/app/          # TypeScript business logic (modify)
├── typescript/src/base/         # Framework infrastructure (do not modify)
├── <lang>/language.env          # Language manifest (Dockerfile, test/run commands)
├── docker-compose.yaml
└── docker-compose.cloudflared.yaml   # Shared tunnel, compose project "tunnel"
```

Env files (`.env.<chain>`, `.env.local.<chain>`) and `config/<chain>/extension.env` are generated, not committed. Production deployment on a GCP Confidential Space VM: `docs/deployment-steps.md`.

### Building Your Own Extension from fce-sign

1. Clone the repo and pick a language.
2. Define `opType`/`opCommand` constants in both the Solidity contract and your handler.
3. Modify `contracts/InstructionSender.sol` with your constants and parameters.
4. Write handlers in `go/internal/extension/` (Go) or `app/` (Python/TypeScript).
5. Follow the deployment steps above — `go/tools/` deploy CLIs are shared regardless of language.

### Cleanup

**Stop the stack:**
```bash
./scripts/stop-services.sh --chain coston2
```
Stops redis, ext-proxy, extension-tee, and the tunnel last. With `SIMULATED_TEE=true` it also stops the **shared** Cloudflare tunnel, rotating the URL for every extension behind it; `--tunnel` forces it down in live mode.

**Full reset** (start from scratch):
```bash
./scripts/stop-services.sh --chain coston2
docker compose down --rmi local
rm -f .env .env.coston2 .env.local.coston2 \
   config/coston2/extension.env \
   config/proxy/extension_proxy.coston2.docker.toml
```

Then restart from Step 0. Note: on-chain state (deployed contracts, registered extensions, TEEs) cannot be reset — each `pre-build.sh` deploys new contracts.

### fce-sign Troubleshooting

- **Proxy won't start / DB sync error** — check `docker compose logs ext-proxy`; verify DB credentials in `config/proxy/extension_proxy.coston2.docker.toml`.
- **Transaction reverts** — insufficient C2FLR; use the [Coston2 faucet](https://faucet.flare.network/coston2).
- **`MachineManager.TooMany()`** — the extension ID `InstructionSender` is bound to doesn't match the on-chain TEE record (usually after `pre-build.sh --force`). Diagnose read-only first: `cd go/tools && go run ./cmd/check-tee-state -a ../../config/coston2/deployed-addresses.json -c "$CHAIN_URL" -p "$EXT_PROXY_URL" -instructionSender "$INSTRUCTION_SENDER"` — it compares proxy `/info`, the on-chain TEE record, the sender's bound ID, and `getActiveTeeMachines`, and prints a verdict. Then point `INSTRUCTION_SENDER` at the address it prints, or do a full reset.
- **Test passes sometimes, times out other times** — more than one TEE machine is active and instructions are load-balanced across them; the stale ones are identities from earlier relaunches (the TEE key lives only in memory, so every relaunch mints a new one). `./scripts/check-tee-machines.sh` reports `LIVE`/`STALE`/`UNREACHABLE`/`UNKNOWN` per machine; `--pause` confirms and pauses each stale one. `UNREACHABLE` is not `LIVE`. **There is no unpause** — never pause the live machine.
- **Every poll times out after the tunnel restarted** (`pollAction` timeout, `/action/result` 404) — the on-chain URL is stale; run `./scripts/update-tee-url.sh`.
- **`undefined: sign.InstructionSender`** — contract bindings are generated, not committed; run `./scripts/generate-bindings.sh` in a fresh clone.
- **`Verification.TeeNotFound`** — `NORMAL_PROXY_URL` points at the other chain's FDC2 proxy; for Coston2 it must be the HTTPS URL of `tee-proxy-coston2-1.flare.rocks`.
- **`Verification.ChallengeExpired`** — re-run `post-build.sh`.
- **`InvalidGovernanceHash`** — the `GOVERNANCE_SIGNERS`/`GOVERNANCE_THRESHOLD` used by `set-governance` don't match the governance hash signed by the TEE node; leave both unset for the default deployer-only setup, or ensure `.env.local.coston2` and the node container agree, then re-run `post-build.sh`.
- **`code hashes do not match`** — `SIMULATED_TEE` and container `MODE` disagree; use `SIMULATED_TEE=true` with `MODE=1` (injected by Docker Compose).
- **`signature must be 65 bytes, got 0`** — `CHAIN_ID` is unset on the node; `use-chain.sh` sets it (`114` for Coston2).
- **`docker-compose.coston2.yaml not found`** / edits in `.env` have no effect — run `./scripts/use-chain.sh coston2 --simulated`; edit `.env.local.coston2`, not `.env`.
- **TEE registration times out** — try `docker compose restart ext-proxy`; FDC attestation requires active relay providers on Coston2.

## fce-weather-insurance: Parametric Insurance Example

The `fce-weather-insurance` repo is a full FCC application: **parametric rainfall insurance** settled from OpenWeatherMap data inside the enclave. It shows the pattern for TEE workloads that fetch off-chain data, sign a result, and have an on-chain contract verify that signature before moving funds — the same shape as any oracle-backed settlement. See [flare-foundation/fce-weather-insurance-x402-agent](https://github.com/flare-foundation/fce-weather-insurance-x402-agent) for an AI agent that buys and settles policies against this extension using [x402 payments](https://dev.flare.network/fxrp/token-interactions/x402-payments).

### Flow

1. A policyholder buys rainfall cover for a date + location, paying an ERC-20 premium (`payToken`); the contract reserves the payout from pool liquidity.
2. From `settlementUnlockAt` (00:00 UTC the day after the coverage date), a keeper calls `requestSettlement`, which routes a `WEATHER`/`SETTLE` instruction to the extension.
3. The extension fetches that day's precipitation from OpenWeatherMap **inside the enclave** and signs the settlement result.
4. Anyone calls `settle()` with the signed `ActionResult`; the contract wraps the result hash in a domain-separated payload, `ecrecover`s the signer, requires it equals the registered `teeAddress`, and pays out if the rainfall threshold was met.

### OP identifiers (`OP_TYPE_WEATHER = bytes32("WEATHER")`)

| Command  | Purpose |
| -------- | ------- |
| `FETCH`  | Return current weather JSON for a city (testing / dApp display). |
| `SETTLE` | Fetch daily rainfall for a policy and return a signed settlement payload. |
| `BUY`    | Decrypt an ECIES-encrypted private policy and return attested terms. |

As always, the constants must match exactly across `WeatherInsurance.sol` and `internal/config/config.go`.

### Public vs private policies

- **Public buy** (`buyPolicy`): all terms are on-chain; caller `approve`s the premium first.
- **Private buy** (`buyPolicyPrivate`): the buyer ECIES-encrypts ABI-encoded `PrivateBuyParams` with the extension public key; the ciphertext is sent as a `WEATHER`/`BUY` instruction. The TEE decrypts via the node's `/decrypt` endpoint, holds the threshold in enclave memory keyed by `termsCommitment`, and the buyer finalizes with `relayPrivateBuy` (which verifies the TEE signature). Only the commitment lives on-chain until settlement.

### TEE signature verification

Both `relayPrivateBuy` and `settle` verify the TEE result the same way: reconstruct the hash the node signed and recover the signer, requiring it equal `teeAddress`.

```solidity
bytes32 resultHash = keccak256(abi.encodePacked(
    keccak256(_resultData), _actionId, keccak256(bytes(_submissionTag)), _status));
// Domain-separated payload — must match go-flare-common signing.TEEActionResult
bytes32 payloadHash = keccak256(abi.encode(bytes32("TEE_ACTION_RESULT"), block.chainid, resultHash));
address signer = _recover(_ethSigned(payloadHash), _signature); // EIP-191 personal-sign
require(signer == teeAddress, "bad TEE signature");
```

The node signs `keccak256(abi.encode(TEE_ACTION_RESULT_PREFIX, chainId, ActionResult.Hash()))` — not `ActionResult.Hash()` alone — with the EIP-191 prefix; only successful (`status == 1`) results are accepted. Verifying against the raw `resultHash` fails against current TEE node signatures. `SettlementTime` (a library) computes `settlementUnlockAt` = midnight UTC the day after coverage.

### Deploy notes (differ from the scaffold/fce-sign)

- Activate with `./scripts/use-chain.sh local coston2` (no language arg — the app is Go).
- Set `OPENWEATHERMAP_API_KEY` and `PAY_TOKEN` in `.env.local.coston2`. A mock ERC-20 exists on Coston2 at `0x53192e788991AD96bC180249B15AefB94E597dD1`, or deploy your own.
- Deploy with `./scripts/pre-build.sh` **then `./scripts/extension-setup.sh`** (the latter calls `setPayToken` on the deployed contract). The rest (ngrok on `6674`, `post-build.sh`, attestation, code-hash whitelisting) matches the scaffold lifecycle below.

## Attestation and Reproducible Builds

The TEE's trust comes from **remote attestation**: the Confidential Space VM measures the running image and reports a **code hash**. Flare's data providers (FTDC) only accept results from a TEE whose code hash has been **whitelisted on-chain** for that extension. This makes builds security-critical:

- **`MODE=0`** is the production attestation backend; **`MODE=1`** produces *simulated* attestation that FTDC rejects. For testnet/mainnet the image must bake `MODE=0` and `.env` must set `LOCAL_MODE=false` / `SIMULATED_TEE=false`.
- **Reproducibility:** set `SOURCE_DATE_EPOCH` (e.g. the last commit time) so the same source yields the same code hash. The **Go** path is bit-for-bit reproducible across machines (single static binary). **Python/TypeScript** reach same-machine determinism but cross-machine bit-for-bit is best-effort (pip wheels / `node_modules` embed host paths) — a rebuild on a different machine may change the code hash and force re-registration. `fce-sign` picks the language via `./scripts/use-chain.sh <chain> --language go|python|typescript`.

## Deployment Lifecycle (Coston / Coston2)

The scaffold scripts chain four phases (`./scripts/full-setup.sh --chain coston2 --test` runs all of them in one shot; each can also run individually):

1. **pre-build** (`pre-build.sh`) — compile + deploy the `InstructionSender`, register the extension on `TeeExtensionRegistry`, write `EXTENSION_ID` + `INSTRUCTION_SENDER` to `config/<chain>/extension.env`. Once that file exists pre-build refuses to run again; pass `--force` only when you intentionally want a new extension.
2. **start services** (`docker compose up -d --build`) — run `redis`, the `ext-proxy`, and the `extension-tee` (your code) as containers. Locally `LOCAL_MODE=true` skips attestation.
3. **post-build** (`post-build.sh`) — `allow-tee-version` whitelists the code hash, `set-governance` registers the extension's TEE governance signer set/threshold (defaults to the deployer with threshold 1 unless `GOVERNANCE_SIGNERS`/`GOVERNANCE_THRESHOLD` are set), then `register-tee` registers the TEE machine on-chain. Use `register-tee -command rRap` so re-runs issue a fresh attestation challenge (capital `R`) and avoid `Verification.ChallengeExpired`.
4. **test** (`test.sh`) — send instructions through the deployed TEE and verify the round-trip.

**Real testnet** adds: a funded deployer key (Coston2 faucet), a publicly reachable proxy URL (any HTTPS tunnel to port `6674` — e.g. ngrok or cloudflared), indexer-DB credentials for the proxy, and a GCP Confidential Space VM to run the image. Verify the deploy by curling the proxy `/info` and confirming `machineData`: `platform` starts with `0x4743505f414d445f534556…` (GCP_AMD_SEV), `codeHash` is a real measured hash (not the simulated `0x194844cf…`), and `extensionId`/`initialOwner` match `config/<chain>/extension.env`. If the `FlareTeeManager` diamond is redeployed, all registrations are wiped — re-run pre-build for a fresh `EXTENSION_ID`, have the VM operator restart with the new ID, then re-run post-build and test.

### Migrating after a protocol redeploy (`Relay` / `FlareSystemsManager` / `VoterRegistry`)

Different from a `FlareTeeManager` redeploy: your registration is untouched, but `ext-proxy` reads signing policies from these three contracts (they redeploy together), so a stack that didn't change at all breaks. Symptoms: proxy `lastSigningPolicyId` behind the reward epoch, `ext-proxy` panics with `initializing signing policy`, availability checks `404`. No rebuild, no new code hash — and **no rollback** (the old `Relay` stops receiving policies). Guide: [Migrate After a Protocol Redeploy](https://dev.flare.network/fcc/guides/protocol-redeploy-migration).

- **Version floor:** `tee-proxy v0.0.24` + `tee-node v0.0.26` (scaffold pins in `proxy/Dockerfile` / `tools/go.mod`). `tee-proxy ≤ v0.0.18` can't advance signing policies; `tee-node < v0.0.26` doesn't follow the current `Relay`. `scripts/check-versions.sh` only fails below `tee-node v0.0.24`/`tee-proxy v0.0.19`, so passing it isn't enough. A policy id that never moves is a version problem, not an address problem.
- **Steps:**
  1. Diff your `config/coston2/deployed-addresses.json` against the scaffold's published copy **by contract name** (`jq -r '.[]|"\(.name) \(.address)"' | sort`). Expect only `Relay` (usually with `FlareSystemsManager`, `VoterRegistry`). **Stop** if `FlareTeeManager` or any `Tee*` contract changed — that means re-registering from scratch.
  2. `curl -fsS -o "$ADDR" "$NEW"` the scaffold's `deployed-addresses.json` over yours — registration/verification tooling reads `FlareSystemsManager` from it, not from the proxy config.
  3. Edit only the changed keys under `[addresses]` (`flare_systems_manager`, `relay`, `voter_registry`) in the proxy TOML mounted as `config.toml` (scaffold: `config/proxy/extension_proxy.coston2.docker.toml`, gitignored — back it up; `use-chain.sh` won't regenerate an existing file). **Leave `[db]` untouched.**
  4. Wait until the new `Relay` has a policy — `lastInitializedRewardEpochData()(uint32,uint32)` first value above `initialRewardEpochId()(uint32)` (up to a full reward epoch, ~6 h on Coston2) — else the proxy panics `no signing policy logs`. Then restart **both** `extension-tee` and `ext-proxy` (a proxy-only restart panics `initializing signing policy: loading last policy <n>` because the node holds the old `Relay`'s policy ids). No rebuild; don't restart redis or the tunnel.
  5. The node restart mints a **new TEE identity** (key never persisted). Run `post-build.sh` to register it, confirm it appears in `getActiveTeeMachines(EXTENSION_ID)`, **then** `pause(address)` the stale id with the machine-owner key (`DEPLOYMENT_PRIVATE_KEY`; check `getTeeMachineOwner`). Identify the live id as `keccak256(pubkey.x ‖ pubkey.y)[12:]` from proxy `/info` `.teeInfo.publicKey`, or let `scripts/check-tee-machines.sh` do it. Until then `getRandomTeeIds` routes ~half the instructions to the dead machine. **No `unpause`** — recovering a wrongly paused machine needs `toProduction` with a fresh availability-check proof.
  6. Verify `/info` `.teeInfo.lastSigningPolicyId` climbs to `getCurrentRewardEpochId()` (or one ahead). A fresh node starts `initial_signing_policy_offset` back (`2` in scaffold, `3` if omitted) and advances one per `signing_policy_fetch_interval` (`20s` scaffold, `10m` default) — only a number that stays put is a failure.
- `cast` calls from the scaffold root need `--chain 114`: Foundry auto-loads `.env` and reads `CHAIN=coston2` as its own `--chain` (`invalid value 'coston2'`).
- Panic triage: `reading config:` → bad TOML quotes; `connecting to database:` / `c-chain indexer:` → `[db]` was changed, restore from backup.

### Common failure modes

- **`Verification.TeeNotFound`** — `NORMAL_PROXY_URL` points at the wrong chain's FTDC proxy.
- **`Verification.ChallengeExpired`** — re-run post-build; ensure `register-tee` uses `-command rRap`.
- **`InvalidGovernanceHash`** — `GOVERNANCE_SIGNERS`/`GOVERNANCE_THRESHOLD` don't match the governance hash the TEE node signed; leave unset for deployer-only defaults, or align both sides and re-run post-build.
- **`code hashes do not match`** — `SIMULATED_TEE` and the image's `MODE` disagree; both must be "real" (`SIMULATED_TEE=false`, `MODE=0`).
- **`connect: connection refused` from ext-proxy** — VPN/route to Flare's indexer DB is down.

### Deeper troubleshooting (dedicated guide: [FCC Troubleshooting](https://dev.flare.network/fcc/troubleshooting))

Most failures are a local stack drifted from the current on-chain deployment or a registered URL that no longer resolves — check these before assuming the network is at fault:

- **TEE never reaches production** (availability check `404`s indefinitely, empty machine queue, `getRandomTeeIds` returns nothing, callers revert with `TooMany()`): first check whether you're running with `SIMULATED_TEE=true` — a simulated attestation is not something the real Coston2 data providers can cosign, so the availability check never gets voted on and the machine stays at `INITIALIZED` forever, with every poll for it returning `404`. That's expected for local development, not a bug; the machine will simply never show `PRODUCTION` onchain. Beyond that, read back what you actually registered with the scaffold's `query-tee` tool (take the registry address from `config/coston2/deployed-addresses.json`, not the tool's built-in default):
  ```bash
  source .env && source config/coston2/extension.env
  REG=$(jq -r '.[]|select(.name=="FlareTeeManager").address' config/coston2/deployed-addresses.json)
  cd tools && go run ./cmd/query-tee -ext "$((EXTENSION_ID))" -reg "$REG" -rpc "$CHAIN_URL"
  ```
  `-ext` takes the **decimal** extension ID (`$((EXTENSION_ID))` converts the hex); pass a TEE machine address as a positional argument to inspect one machine. Compare the registered `url` character-by-character with what you're serving now — quick tunnels (ngrok/Cloudflare quick tunnels) mint a new hostname on every restart, so a restarted tunnel silently orphans the on-chain registration. Use `./scripts/update-tee-url.sh`, a **named** Cloudflare tunnel, or a reserved ngrok domain. If a redeploy moved only `Relay`/`FlareSystemsManager`/`VoterRegistry`, follow the [protocol-redeploy migration](#migrating-after-a-protocol-redeploy-relay--flaresystemsmanager--voterregistry) instead. An empty `teeId` from `query-tee` means you're talking to a different deployment than you think — pull latest `main`, take every address fresh from `config/coston2/deployed-addresses.json`, and re-run pre-build/post-build (a redeploy wipes existing registrations).
- **Proxy panics on startup or rejects TEE responses** (`hex string without 0x prefix`, `verifying response signature: invalid signature`, `error signing: could not sign`): version skew between `tee-node` and `tee-proxy` — their wire format changes while FCC is in development. Never bump one side alone; the Go module pin and `proxy/Dockerfile`'s `TEE_PROXY_VERSION` must move together, and building from on-disk local siblings (rather than the pinned versions) is what usually introduces the skew.
- **Instructions never reach your extension despite an instruction ID and no other errors** — you likely reused a reserved `F_`-prefixed `OPType` or one of the reserved command names above under a custom `OPType`; this passes local pair validation with **no error**, so the instruction is just silently not delivered.
- **Indexer DB auth/connection fails** (`Access denied for user 'indexer-reader'`, timeouts against a VPN-only host) — the host/port/database name are already documented (Step 4 above); only the read-only username and password are missing, since they're issued per requester and rotated periodically. Request current credentials via [technical support](https://flare.network/resources/technical-support) or [X](https://x.com/FlareDevs). Credentials shared in community chats go stale faster than the docs do, and older repository documents may point at the **Coston** (not Coston2) indexer, which uses different credentials and needs a VPN — Coston2 doesn't.
- **Proxy broken right after a restart that picked up a new reward epoch** — a new reward epoch is initialized and signed ~2 hours before it is live on chain; restarting inside that window makes the proxy load an epoch the chain hasn't reached. Set `initial_signing_policy_offset=1` in the proxy config (scaffold: `config/proxy/extension_proxy.coston2.docker.toml`) and restart the proxy.
- **Name mismatch between Solidity and the extension** — the `OPType`/`OPCommand` strings must match the contract in `go/internal/config/config.go`, `python/app/config.py`, or `typescript/src/app/config.ts`, whichever you run.
- **Weather Insurance Extension request fails against the OpenWeatherMap URL** — check your OpenWeatherMap plan before assuming the extension is broken. The [Weather Insurance Extension](#fce-weather-insurance-parametric-insurance-example) example calls an endpoint that needs a paid OpenWeatherMap plan, so a free-tier key fails there even though the same extension works correctly against other URLs.
- Include your extension ID, TEE machine address, failing instruction ID, and `query-tee` output when asking for help — those four details usually identify the cause immediately.

## When to Use a Different Skill

- Reading **FTSO** price feeds, **FDC** attestations, **FAssets** minting/redemption, or **Smart Accounts** — use those dedicated skills.
- General network facts (chain IDs, RPCs, faucets, explorers) — use `flare-general`.

Use **this** skill when the task involves confidential/TEE execution: building or deploying an extension, the InstructionSender/registry pattern, attestation and code-hash whitelisting, parametric insurance on TEE, or the `fce-extension-scaffold` / `fce-sign` / `fce-weather-insurance` repos. See also [dev.flare.network/fcc](https://dev.flare.network/fcc/overview) for the official Flare Developer Hub FCC documentation.
