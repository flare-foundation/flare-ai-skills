---
name: flare-fce
description: Provides domain knowledge and guidance for Flare Confidential Compute (FCC) and TEE extensions—how confidential extensions run inside a Trusted Execution Environment, the on-chain TeeExtensionRegistry and TeeMachineRegistry, the InstructionSender contract pattern, the OPType/OPCommand routing model, the instruction lifecycle, the extension action handler, the types server, attestation, and reproducible builds. Use when building, deploying, or reasoning about Flare confidential extensions, TEE machines, FCC, confidential compute, the fce-extension-scaffold, the fce-sign signing example, Confidential Space VMs, code-hash attestation, or registering a TEE on Coston/Coston2.
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

**Two reference repos:**
- **`flare-foundation/fce-extension-scaffold`** — a runnable "Hello World" extension (Go) with contracts, deploy/registration tooling, a types server, and Claude Code skills (`/create-extension`, `/rename-scaffold`, `/test-extension`, `/verify-deploy`). This is the starting point for building your own extension.
- **`flare-foundation/fce-sign`** — an example extension that stores a private key and signs messages with it, shipped in Go, Python, and TypeScript. Demonstrates the TEE signing port and reproducible builds. Explicitly demo-only for the on-chain-secret part.

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
  - `extensionsCounter()` and `getTeeExtensionInstructionsSender(uint256 extensionId)` — used to discover an extension's ID.
  - **Access control:** when you register an extension you bind it to one **InstructionSender address**. The registry rejects any `sendInstructions` call whose `msg.sender` isn't that address — no EOA, no other contract.
- **`TeeMachineRegistry`** — maps extensions to the TEE machines serving them. `getRandomTeeIds(uint256 _extensionId, uint256 _count)` picks machine addresses to route an instruction to (use `_count > 1` to fan one instruction out to multiple TEEs).

### The InstructionSender contract

This is **your** contract and the only address allowed to submit instructions for your extension. Minimum requirements:

1. **Know its extension ID** — to look up serving TEE machines. The scaffold's `setExtensionId()` scans the registry after registration and caches the ID (set-once).
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

**Files a developer modifies** (the scaffold marks them ★, and `/rename-scaffold` automates renaming the Hello World placeholders):

1. `internal/config/config.go` — `OPType`/`OPCommand` string constants and version
2. `pkg/types/types.go` — request/response/state structs
3. `internal/extension/extension.go` — routing cases + handlers (the main customization point)
4. `pkg/types/register.go` — decoder registrations for the types server
5. `contracts/InstructionSender.sol` — matching `bytes32` constants + send functions
6. `tools/cmd/run-test/main.go` — E2E test payloads and assertions

After editing the contract, run `./scripts/generate-bindings.sh` to regenerate Go bindings.

### TEE signing port

Extensions that need to sign, attest, or encrypt with TEE-managed keys call the TEE's **sign port** (e.g. `localhost:7701`/`SIGN_PORT`, or `9090` in some docs — read the scaffold's config) from inside the extension. This is how `fce-sign` signs messages without the key ever leaving the enclave.

### Types server

A lightweight HTTP sidecar (`POST /decode`, `GET /registry`, `GET /health`, default port `8100`) that turns raw hex instruction data into human-readable JSON for frontends and debugging. You register a decoder per `(OPType, OPCommand, Kind)` in `pkg/types/register.go` using `NewJSONDecoder` or `NewABIDecoder` (the ABI decoder takes the ABI argument); `Kind` is `message` (request) or `result` (response). `Lookup` matches `(OPType, OPCommand, Kind)` exactly, then falls back to `(OPType, "", Kind)`.

## Attestation and Reproducible Builds

The TEE's trust comes from **remote attestation**: the Confidential Space VM measures the running image and reports a **code hash**. Flare's data providers (FTDC) only accept results from a TEE whose code hash has been **whitelisted on-chain** for that extension. This makes builds security-critical:

- **`MODE=0`** is the production attestation backend; **`MODE=1`** produces *simulated* attestation that FTDC rejects. For testnet/mainnet the image must bake `MODE=0` and `.env` must set `LOCAL_MODE=false` / `SIMULATED_TEE=false`.
- **Reproducibility:** set `SOURCE_DATE_EPOCH` (e.g. the last commit time) so the same source yields the same code hash. The **Go** path is bit-for-bit reproducible across machines (single static binary). **Python/TypeScript** reach same-machine determinism but cross-machine bit-for-bit is best-effort (pip wheels / `node_modules` embed host paths) — a rebuild on a different machine may change the code hash and force re-registration. `fce-sign` picks the language via `LANGUAGE=go|python|typescript` in `.env`.

## Deployment Lifecycle (Coston / Coston2)

The scaffold scripts chain four phases (`./scripts/full-setup.sh --test` runs all of them; each can run individually):

1. **pre-build** (`pre-build.sh`) — compile + deploy the `InstructionSender`, register the extension on `TeeExtensionRegistry`, write `EXTENSION_ID` + `INSTRUCTION_SENDER` to `config/extension.env`.
2. **start services** (`docker compose up -d --build`) — run `redis`, the `ext-proxy`, and the `extension-tee` (your code) as containers. Locally `LOCAL_MODE=true` skips attestation.
3. **post-build** (`post-build.sh`) — `allow-tee-version` whitelists the code hash, then `register-tee` registers the TEE machine on-chain. Use `register-tee -command rRap` so re-runs issue a fresh attestation challenge (capital `R`) and avoid `Verification.ChallengeExpired`.
4. **test** (`test.sh`) — send instructions through the deployed TEE and verify the round-trip.

**Real testnet** adds: a funded deployer key (Coston2 faucet), a publicly reachable proxy URL (e.g. ngrok tunnel to port `6674`), indexer-DB credentials for the proxy, and a GCP Confidential Space VM to run the image. Verify the deploy by curling the proxy `/info` and confirming `machineData`: `platform` starts with `0x4743505f414d445f534556…` (GCP_AMD_SEV), `codeHash` is a real measured hash (not the simulated `0x194844cf…`), and `extensionId`/`initialOwner` match `config/extension.env`. If the `FlareTeeManager` diamond is redeployed, all registrations are wiped — re-run pre-build for a fresh `EXTENSION_ID`, have the VM operator restart with the new ID, then re-run post-build and test.

### Common failure modes

- **`Verification.TeeNotFound`** — `NORMAL_PROXY_URL` points at the wrong chain's FTDC proxy.
- **`Verification.ChallengeExpired`** — re-run post-build; ensure `register-tee` uses `-command rRap`.
- **`code hashes do not match`** — `SIMULATED_TEE` and the image's `MODE` disagree; both must be "real" (`SIMULATED_TEE=false`, `MODE=0`).
- **`connect: connection refused` from ext-proxy** — VPN/route to Flare's indexer DB is down.

## When to Use a Different Skill

- Reading **FTSO** price feeds, **FDC** attestations, **FAssets** minting/redemption, or **Smart Accounts** — use those dedicated skills.
- General network facts (chain IDs, RPCs, faucets, explorers) — use `flare-general`.

Use **this** skill when the task involves confidential/TEE execution: building or deploying an extension, the InstructionSender/registry pattern, attestation and code-hash whitelisting, the types server, or the `fce-extension-scaffold` / `fce-sign` repos.
