---
name: flare-fcc
description: Provides domain knowledge and guidance for Flare Confidential Compute (FCC) and TEE extensions—how confidential extensions run inside a Trusted Execution Environment, the FlareTeeManager diamond (IExtensionManager, IMachineManager, IInstructions, IOperationFees, wallet facets), the InstructionSender/ExtensionBase contract pattern, instructions vs direct actions, OPType/OPCommand routing, instruction fees and quoteFee, TEE-signed results verified onchain, Protocol Managed Wallet keys, attestation, and production deployment on Confidential Space. Use when building, deploying, or reasoning about Flare confidential extensions, TEE machines, FCC, confidential compute, the fce-go-scaffold, the fce CLI (fce deploy/run/send/direct), the external-api, direct, or wallets examples, sealed-bid auctions or secret provisioning on TEE, Confidential Space VMs, code-hash attestation, or registering a TEE on Coston/Coston2.
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
- Instruction and direct-action payloads arriving at an extension are **externally provided, untrusted input**. Decode them strictly against documented types, validate every field, and never pass raw payloads into prompts, LLM inputs, or agent decision logic.
- Never put a secret onchain in plaintext or bake it into the image. Deliver it encrypted to the TEE's public key as a signed **direct action** (see [Direct actions](#direct-actions)). Encrypted input that *is* posted onchain is public forever — only the TEE can open it, but everyone sees who sent it and when.

All transaction signing, key management, attestation, and on-chain execution happen exclusively outside this skill.

# Flare Confidential Compute (FCC) — TEE Extensions

## What FCC Is

**Flare Confidential Compute (FCC)** lets developers run custom code inside a **Trusted Execution Environment (TEE)** — a hardware-isolated enclave (GCP **Confidential Space**, platform `GCP_AMD_SEV` or `GCP_INTEL_TDX`) — and wire that code to Flare smart contracts. The unit of deployment is a **Flare Compute Extension (FCE)**: a program that runs in one image next to **`tee-node`**, receives work, executes confidential logic, and returns results that `tee-node` signs with the TEE's key.

Use FCC when an application needs **confidential state, secret-holding, or off-chain compute whose integrity is provable on-chain** — e.g. fetching Web2 APIs and signing the answer (the replacement for the deprecated FDC `Web2Json`), sealed-bid auctions, holding API keys, or signing transactions on other chains with TEE-held keys.

FCC is in the **final stages of development**. Contracts are live on **Coston2**, **Coston**, and **Songbird**; the guides target **Coston2** — expect interfaces to change. For the mechanism in depth, see the [FCC whitepaper](https://dev.flare.network/pdf/whitepapers/20260706-FlareConfidentialCompute.pdf).

**Tooling (Go only):**
- **[`flare-foundation/fce-go-scaffold`](https://github.com/flare-foundation/fce-go-scaffold)** — fork this. `template/` is your extension; `examples/external-api`, `examples/direct`, `examples/wallets` are worked examples. The shared Go library (`pkg/extension`, `pkg/payload`) and the Solidity `ExtensionBase` (`sol/`) handle HTTP wiring to `tee-node`, strict decoding, TEE-key calls, fees, and TEE-signature checks.
- **[`flare-foundation/fce-tooling`](https://github.com/flare-foundation/fce-tooling)** — the **`fce` CLI** (`go install ./cmd/fce`): `conformance`, `image-check`, `deploy`, `add-version`, `disable-version`, `governance`, `status`, `run`, `stop`, `send`, `direct`, `encrypt`.
- The `tee-node` ↔ extension wire protocol is language-agnostic ([extension contract](https://github.com/flare-foundation/fce-go-scaffold/blob/main/docs/extension-contract.md)); `fce conformance [flags] -- command [args...]` checks any binary against it.

> **Legacy:** the multi-language `fce-extension-scaffold`, `fce-sign`, and `fce-weather-insurance` repos (shell scripts `use-chain.sh`/`pre-build.sh`/`post-build.sh`/`test.sh`, `SIMULATED_TEE=true`, `TeeExtensionRegistry`/`TeeMachineRegistry` addresses from `deployed-addresses.json`, mandatory indexer DB for `ext-proxy`) are **replaced**. Port handlers into a fork of `fce-go-scaffold` rather than patching the old one. See [Migrating from the legacy scaffold](#migrating-from-the-legacy-scaffold).

## Two Channels: Instructions and Direct Actions

Every operation (`opType`/`opCommand` pair) belongs to **exactly one** channel.

```
Instruction:   Caller → InstructionSender.myCommand(...) + fee
               → FlareTeeManager.sendInstructions → TeeInstructionsSent event
               → data providers sign (>50% signing-policy weight) → tee-proxy
Direct action: Client → POST /direct on one TEE's tee-proxy (X-Api-Key header)

Then (both):   tee-node fetches from proxy → POST /action to extension → result
               → tee-node signs → proxy → caller polls GET /action/result/<id>
```

| | Instruction | Direct action |
| --- | --- | --- |
| Reaches | The TEEs the contract chooses | Only the TEE behind the proxy it was posted to |
| Cost | Protocol fee + optional project fee | No fee, no transaction |
| Proves who sent it | The contract decides, onchain | **Nothing** — the proxy API key only opens `/direct`, is shared, and is never passed to the extension. The payload must carry its own authorization |
| Replayable by | The operator, while its signing policy is the active one or the one before | Anyone who saw it, at any later time |
| Result at | `GET /action/result/<id>` | `GET /action/result/<id>?submissionTag=submit` (kept 30 min by default) |
| Result signing | Signed | **Unsigned** — the proxy assigns the id, so a signed direct result could pass as an instruction result |

`tee-node` rejects reserved `F_` op types on the direct channel and accepts a direct action only if the extension registered that op with `RegisterDirectHandler`. An op registered as an instruction cannot be reached via `/direct`.

## On-Chain Building Blocks: `FlareTeeManager`

All FCC contracts live behind **one [EIP-2535](https://eips.ethereum.org/EIPS/eip-2535) diamond, `FlareTeeManager`** — resolve it from the [`FlareContractRegistry`](https://dev.flare.network/network/guides/flare-contracts-registry) (`getContractAddressByName("FlareTeeManager")`); the scaffold's `Deploy.s.sol` and `fce` do this, so no address is hardcoded. `IFlareTeeManager` is the aggregate ABI; facets are compile-time views of the same address.

| Facet | Purpose |
| --- | --- |
| `IExtensionManager` | Register/configure extensions (`register` returns the **extension ID**; public IDs start at `0x10000`), allowed versions, governance, state verifier |
| `IMachineManager` | TEE machine `register`, `toProduction`, `pause` (no unpause), `getRandomTeeIds(extensionId, count)` |
| `IVerification` | Attestation, `requestAvailabilityCheckAttestation`, `confirmAvailability`, `getAvailabilityCheckValidity` |
| `IInstructions` | `sendInstructions(address[] teeIds, TeeInstructionParams)` — **the only public path** to send work; emits `TeeInstructionsSent` |
| `IOperationFees` | `getOperationFee(opType, opCommand)`, `calculateFeeByTeeIds` (read-only; governance sets the schedule) |
| `IOwnerAllowlist` | Allowlists (each with an allow-all flag) for extension owners (governance), machine owners and wallet-project owners (extension owner) |
| `IWalletProjectManager` / `IWalletManager` / `IWalletKeyManager` | Protocol Managed Wallet projects, wallet lifecycle, TEE-held keys (see [Wallet keys](#wallet-keys-tee-generated-signing-keys)) |
| `ITeeCommonErrors` | Shared errors (`TooMany`, `ChallengeExpired`, `InvalidGovernanceHash`, `InvalidWalletStatus`, …) |

`TeeInstructionParams` = `{ bytes32 opType; bytes32 opCommand; bytes message; address[] cosigners; uint64 cosignersThreshold; address claimBackAddress; }`. `sendInstructions` rules: `msg.sender` must be the extension's registered instructions sender (else `OnlyInstructionsSender` — EOAs rejected); non-empty `opType`/`opCommand`/`message`; no `F_` op type (`SystemOpTypeNotAllowed`); all `teeIds` in the same extension and `PRODUCTION` (`TeeMachineNotAvailable`); `cosignersThreshold ≤ cosigners.length`; `msg.value ≥ calculateFeeByTeeIds` (`FeeTooLow`); reverts `EmergencyPauseActive` if the extension is emergency-paused. Full ABIs: [FCC Reference](https://dev.flare.network/fcc/reference).

### `InstructionSender` and `ExtensionBase`

Your `InstructionSender` is the **only** address allowed to submit instructions for your extension. It inherits the scaffold's `ExtensionBase` (`sol/src/ExtensionBase.sol`), which:

- binds the extension ID (`setExtensionId`, set-once, owner-only — `fce deploy` calls it via `PostRegister.s.sol`);
- charges fees: every send function is `payable` with the **`chargesFees`** modifier, and calls `_send(opType, opCommand, message)` (one random production TEE) or `_send(teeIds, …)` / `_send(teeIds, TeeInstructionParams)`;
- exposes `quoteFee`, `setProjectFee`, `withdraw` (owner);
- provides `_teeSigner(digest, signature)` — recovers the signer and checks it is a **production TEE of this extension** (and the extension isn't emergency-paused).

```solidity
contract InstructionSender is ExtensionBase {
    bytes32 public constant OP_TYPE_MY_EXTENSION = bytes32("MY_EXTENSION");
    bytes32 public constant OP_COMMAND_MY_COMMAND = bytes32("MY_COMMAND");

    constructor(address _flareTeeManager) ExtensionBase(_flareTeeManager) { }

    function myCommand(bytes calldata _message) external payable chargesFees returns (bytes32) {
        // tee-node does not pass the caller to the extension — encode msg.sender yourself
        return _send(OP_TYPE_MY_EXTENSION, OP_COMMAND_MY_COMMAND, abi.encode(msg.sender, _message));
    }
}
```

One payable `chargesFees` function per **instruction** command. **Direct** commands have no contract function — clients post them to the proxy.

`ExtensionBase` errors: `ExtensionIdNotSet`, `ExtensionIdAlreadySet`, `InsufficientFee(price, available)`, `DuplicateTee`, `NotCharging` (`_send` outside a `chargesFees` function), `NestedCharge` (one `chargesFees` function called another), `SignerNotExtensionTee`, `SignerNotInProduction`, `ExtensionEmergencyPaused`, `WithdrawFailed`.

## Instruction Fees

An instruction pays two fees from `msg.value` ([Instruction Fees](https://dev.flare.network/fcc/instruction-fees)):

- **Protocol fee** — governance sets it per `(opType, opCommand)` on `FlareTeeManager` (`getOperationFee` returns the override or the global `defaultFee`); charged **per TEE**: `calculateFeeByTeeIds = perOperationFee × teeIds.length`. `ExtensionBase` forwards it to `sendInstructions`.
- **Project fee** — the contract owner's `setProjectFee`; charged **once per instruction**. `ExtensionBase` keeps it plus any overpayment; the owner calls `withdraw`. `0` = protocol fee only.

**`quoteFee(bytes32 opType, bytes32 opCommand) view returns (uint256)`** on your `InstructionSender` = one-TEE protocol fee + `projectFee` — the minimum `msg.value` for a one-TEE send. It reverts `ExtensionIdNotSet` before `setExtensionId`, and `TooMany` when the extension has **no production TEE** (it picks one via `getRandomTeeIds`). For multi-TEE sends, quote protocol fee for the list + `projectFee` once (the examples expose `quoteSignTransaction`, `quoteSetAdmin`). `fce send` finds the fee by simulating the call. Direct actions carry no fees.

## The OPType / OPCommand Routing Model

Two-level identifier that **must match exactly** between Solidity and Go: `bytes32("MY_EXTENSION")` in Solidity equals `op.Type("MY_EXTENSION").Hash()` in Go. Names ≤ 31 bytes for `bytes32` (Go registration panics over 32).

```go
// template/internal/app/app.go
const (
    OPTypeMyExtension        op.Type    = "MY_EXTENSION"
    OPCommandMyCommand       op.Command = "MY_COMMAND"
    OPCommandMyDirectCommand op.Command = "MY_DIRECT_COMMAND"
)

func Register(s *extension.Server) {
    s.RegisterInstructionHandler(OPTypeMyExtension, OPCommandMyCommand, myCommand)
    s.RegisterDirectHandler(OPTypeMyExtension, OPCommandMyDirectCommand, myDirectCommand)
}
```

Registration **panics** on a pair registered twice, an `F_`-prefixed op type, or a name > 32 bytes.

**Reserved names:** the `F_` prefix is reserved for system op types (`F_REG`, `F_WALLET`, `F_GET`, `F_POLICY`, `F_GOVERNANCE`, `F_XRP`, `F_BTC`, `F_FDC2`). Their command names are reserved too (`TEE_ATTESTATION`, `TEE_INFO`, `TEE_BACKUP`, `KEY_GENERATE`, `KEY_INFO`, `KEY_PROOF`, `KEY_DELETE`, `KEY_DIRECT_BACKUP`, `KEY_DIRECT_RESTORE`, `KEY_DATA_PROVIDER_RESTORE`, `INITIALIZE_POLICY`, `UPDATE_POLICY`, `SET_MACHINE_PATH_LIST`, `PAY`, `REISSUE`, `VRF`, `PROVE`). Reusing a reserved **command** name under your own non-`F_` op type passes local validation but the instruction is **silently never delivered** (onchain instruction ID, `404` on the result, no error). Use domain-specific names.

## The Extension (Go) — Handlers

```go
// Instruction handler: payload is instruction.DataFixed (OriginalMessage, InstructionID, …)
func myCommand(_ context.Context, i *instruction.DataFixed) ([]byte, extension.Run, error) {
    var p myCommandPayload
    if err := payload.DecodeABI(myCommandArgs, i.OriginalMessage, &p); err != nil {
        return nil, nil, extension.PublicError("invalid payload", err)
    }
    // validate everything before the first write …
    out, err := myCommandArgs.Pack(p.Sender, p.Message)
    if err != nil {
        return nil, nil, extension.PublicError("encoding the result", err)
    }
    return out, nil, nil
}

// Direct handler: payload is types.DirectInstruction (Message)
func myDirectCommand(_ context.Context, d *types.DirectInstruction) ([]byte, extension.Run, error) {
    var m myDirectCommandMessage
    if err := payload.DecodeJSON(d.Message, &m); err != nil { … }
    …
}
```

- **Decoding:** `payload.DecodeABI` accepts only the **canonical** ABI encoding; `payload.DecodeJSON` rejects unknown fields and trailing data.
- **Return values → status:** error → `status 0` with public log `error: <text>`; data → `status 1`; data + a `Run` → `status 2` (pending) at once, the `Run` continues in the background.
- **Deadline:** a handler has **1.5 s** to answer; `tee-node` waits 2 s total (and posts status `3` if `POST /action` exceeds 2 s). Slower work must return a `Run` (long-running mode).
- **Errors:** results and logs are **public**. Wrap any error that could carry a secret in `extension.PublicError("...", err)` — only the first argument reaches the log.
- **Concurrency:** the library does **not** serialize calls; an instruction, a direct action, and `GET /state` can run at once. Synchronize shared state yourself.
- **Replays:** `tee-node` does not remember instructions — an operator can deliver one again, or after a newer one. Make each handler idempotent or reject replays; when order matters, number instructions in the contract (nonce) and apply only higher numbers.
- **Caller identity:** `tee-node` doesn't pass `msg.sender`; the contract must encode it into the payload.
- **Entrypoint (`cmd/extension/main.go`):** `extension.ReadEnv()` → `extension.New(extension.WithSignPort(env.SignPort))` → `app.Register(srv)` → `srv.ListenAndServe(ctx, env.ExtensionPort)`. Your own env vars must be listed in the Dockerfile's launch-policy label (`tee.launch_policy.allow_env_override`) and the launcher's `--env`.

**Files you own** in your fork: `template/` (`cmd/extension/main.go`, `internal/app/` handlers + tests, `conformance/` golden fixtures, `contracts/` with `src/InstructionSender.sol`, `script/Deploy.s.sol`, `script/PostRegister.s.sol`, forge tests, `Dockerfile`) and `examples/` if building on one. **Leave alone** (merge from upstream instead): `pkg/`, `sol/`, `conformance/`, `internal/`, `launcher/`, `docs/`, `fce-version`, the `Makefile`, lint/agent files. Scaffold docs: [extension guide](https://github.com/flare-foundation/fce-go-scaffold/blob/main/docs/extension-guide.md), [rules](https://github.com/flare-foundation/fce-go-scaffold/blob/main/docs/rules.md), [contracts](https://github.com/flare-foundation/fce-go-scaffold/blob/main/docs/contracts.md), [forking](https://github.com/flare-foundation/fce-go-scaffold/blob/main/docs/fork.md).

### Long-running results and statuses

Status is `0`–`255` with a public log. `0` (`error: …`) and `1` (`ok`) are **final** and replace whatever is stored; `≥ 2` is replaced only by a higher status or a final one. `2` = pending, `3` = set by the node on a > 2 s `POST /action`, `4`–`255` = partial results (`prog.Post` inside the `Run` publishes the next partial). Long-running mode posts through the sign port, so `main.go` must pass `extension.WithSignPort`. The library bounds neither job duration nor concurrency — bound them yourself. **If the TEE restarts mid-job, the result stays at the last status forever** — consumers must time out non-final results.

## TEE Keys and the Signing Model

Each TEE machine generates an **identity key pair** at boot (secp256k1); the private half never leaves the enclave. **Every `tee-node` start generates a new key → a new TEE address → a new machine registration.** All extension state lives in memory and is lost on restart.

- **ECDSA** proves origin (sign/verify); **ECIES** hides content (encrypt to the public key, decrypt only inside the enclave). Don't confuse them.
- The extension never holds the identity key; it calls `tee-node`'s **sign port** (localhost-only) — e.g. `SignTEE`, decrypt, `tee.KeyInfo`, `tee.SignWallet`.
- Public key: `curl -s <proxy>/info | jq .teeInfo.publicKey`. Encrypt client-side with `fce encrypt -pubkey "$key" -tee "$TEE_ID"` (reads stdin; `-tee` refuses a key not belonging to that TEE).

**Data providers and cosigners:** an instruction runs only after [Flare Systems Protocol](https://dev.flare.network/network/fsp) data providers sign it with **> 50% of the current signing-policy weight**. **Cosigners** (`TeeInstructionParams.cosigners`/`cosignersThreshold`) add a second, independent gate for sensitive operations. See [TEE keys](https://dev.flare.network/fcc/tee-keys) and [Data providers and cosigners](https://dev.flare.network/fcc/data-providers).

### Putting a TEE result onchain

Pattern from the External API example: the TEE signs **its own domain-tagged message** via `SignTEE` (EIP-191 over the message's keccak256); anyone relays the result; the contract verifies with `ExtensionBase._teeSigner`.

```text
signed = abi.encode(bytes32 "PRICES_PRICE_V1", bytes32 instructionId, keccak256(abi.encode(pair, price, decimals, sources)))
```

- A **tag of your own** keeps the signature from meaning anything else — `SignTEE` signs in the same domain as `tee-node`'s own signatures. **Never sign bytes a user chooses**; build the message yourself with `abi.encode` (never concatenate variable-length fields).
- **`instructionId`** binds it to one request on one chain at one contract (it arrives signed by data providers) — no chain ID needed; the contract accepts each ID once and records which TEE it sent to.
- **`V` fix-up:** the sign port returns `V` as `0`/`1`; `ecrecover` needs `27`/`28` — add 27 before packing.
- The contract should check: it requested that instruction, not yet answered, within a freshness bound (`MAX_PRICE_DELAY` = 10 min by block time), fields match the request, and `_teeSigner` recovers the TEE the request went to. `_teeSigner` accepts any production TEE even if its availability check lapsed — also check `getAvailabilityCheckValidity` if that matters.
- Single-TEE results can be withheld by the operator; stronger designs send to several TEEs and require a quorum. For production price data use **FTSO**, not a TEE oracle.

## Direct Actions

Use for anything that must not go onchain — chiefly **secret provisioning**. Since nothing authenticates the sender, the **payload** carries the authorization ([Direct Actions guide](https://dev.flare.network/fcc/guides/direct-actions-extension), `examples/direct`):

1. The contract owner sets an **admin** onchain via an instruction (`SECRETS`/`SET_ADMIN`, `abi.encode(uint64 nonce, address admin)`; nonce starts at 1; the TEE applies only higher nonces).
2. The admin encrypts the secret to **this TEE's** public key and signs (EIP-191, as `cast wallet sign`) `keccak256(abi.encode(bytes32 opType, bytes32 opCommand, address teeId, string name, bytes ciphertext))` (`ROTATE` adds `uint256 counter` after `teeId`). The TEE address scopes the signature to one machine; the op pair to one command; the ciphertext prevents swapping secrets.
3. Post JSON `{"teeId","name","ciphertext","signature"}` to `POST /direct` (`fce direct -chain coston2 <dir> SECRETS PROVISION 0x<hex-json>`).
4. The TEE checks the signature, decrypts inside the enclave, keeps the secret in memory; the result names the secret but **never contains it**.

**Replay rules** — every direct action must be either **idempotent** (`PROVISION` stores once; same secret again succeeds, a different one fails; compare decrypted plaintexts since ECIES is randomized) or **numbered** (`ROTATE` carries a `counter` > the last accepted from that admin). Counters can live in memory: after a restart the TEE has a new address that no old payload names.

Raw `POST /direct` body (header `X-Api-Key`): `{"opType":"0x<bytes32>","opCommand":"0x<bytes32>","message":"0x<hex>"}`.

### State and the state verifier

`GET /state` on the extension reports state that `tee-node` includes in its **signed TEE info** (`/info` → `.teeInfo.state`, with a `stateVersion` tag such as `SECRETS_STATE_V1` right-padded to 32 bytes). The registry accepts non-empty state only from an extension with a registered **state verifier** contract; at each availability check it calls `verifyTeeState`. In `examples/direct` the `InstructionSender` is both sender and verifier (`Deploy.s.sol` writes it under both names, `fce deploy` registers both); it accepts only a `(nonce, admin)` it actually sent to that TEE (or `(0, 0)`), and only while every newer `setAdmin` to that TEE is ≤ `MAX_STATE_LAG` (2 h) old — so withholding an update fails availability within 2 h. **A state verifier must never revert** (it would block every availability check). Report only what the chain can check (not direct-action secrets).

### Sealed-bid auction pattern

Same example: `startRound(period)` picks a random production TEE for the round; bidders call `bid(round, ciphertext)` with JSON `{"tag":"AUCTION_BID_V1","round","bidder","amount"}` encrypted to the round TEE (amount **zero-padded to 78 digits** so ciphertext length doesn't leak size; naming bidder + round stops copy-paste bids); `endRound` makes the TEE open all bids — it answers only after seeing the start and every counted bid (`error: bid N missing` instead of silently dropping one); anyone calls `submitResult` with the signed winner/amount. Losing bids are never revealed. `resendStart`/`resendBid` recover lost instructions; `cancelRound` aborts a stalled round.

## Wallet Keys (TEE-generated signing keys)

`tee-node` can **generate keys inside the TEE** so you never import one ([Wallets guide](https://dev.flare.network/fcc/guides/wallets-extension), `examples/wallets`). Wallets belong to **wallet projects** (owner, key type e.g. `EVM`/`XRP`, signing algorithm); one key = one address (same on every EVM chain).

**Onchain setup on `FlareTeeManager`** (manual — `fce` doesn't support wallets yet):

1. Extension owner, once: `addAllowedTeeWalletProjectOwners(extensionId, owners)`, `addSupportedKeyTypes(extensionId, ["EVM"])`.
2. Allowed owner: `createProject(extensionId, "EVM", "keccak256-secp256k1-ecdsa")`, then `createWallet(projectId)`.
3. `setAdmins(walletId, publicKeys, threshold)` + `confirmAdmin(walletId)` from each admin; optional `setCosigners` + `confirmCosigner`; then `closeWalletInitialization(walletId)`.
4. `setMultisigThreshold(walletId, 1)`, `addKey(teeId, walletId, claimBack)` (pays a fee; `tee-node` generates the key).
5. Read the TEE-signed key existence proof from the proxy and call `confirmKey(proof, signature)`.
6. `enableWallet(walletId)` → production; **no more keys can be added**.

Wallet status: `NONE → CREATED → INITIALIZED → PRODUCTION ⇄ PAUSED` (each transition explicit). `setMultisigThreshold`/`addKey`/first `confirmKey` require `INITIALIZED` (`InvalidWalletStatus`). Reads: `getWalletKeyPublicKey`, `getWalletKeyTeeIds`, `getReceivingTeeIds`, `getWalletStatus`, `getWalletCosignersAndThreshold`.

**`SIGN_TRANSACTION` example:** project owner `setSigner(walletId, signer)` (zero address stops it); signer calls `signTransaction(walletId, tx)` paying ≥ `quoteSignTransaction(walletId)`. The contract requires: caller is the signer, `chainId ≠ 0`, project belongs to this extension with an `EVM` / `keccak256-secp256k1-ecdsa` key, wallet in production, **exactly one key** held by a production TEE; then sends to **every** production TEE holding the key with the wallet's cosigners (fee scales per holder). The TEE re-checks key type and cosigners (`tee-node` itself signs with any key it holds), builds the EIP-1559 tx (contract-assigned nonce, empty access list, no contract creation), signs via `tee.SignWallet`, verifies recovery, and returns EIP-2718 bytes ready for `eth_sendRawTransaction`/`cast publish`. Signing is deterministic → redelivery is harmless. Nonces per wallet per chain (`nextNonce(walletId, chainId)`); `replaceTransaction(walletId, nonce, tx)` re-signs a stuck nonce. Fund the wallet address on the target chain.

**Restarts:** a restarted TEE loses its wallet keys. `tee-proxy` backs keys up in shares encrypted to the wallet admins and data providers; restore onto another TEE (from shares or directly from a holder), then the project owner/backup manager `confirmKey`s the new holder. With no production holder, `signTransaction` reverts `ThresholdNotMet`. An unrecoverable key is lost — the only way out is a new wallet (new address). The example is **not production custody**: no limits, no simulation, only the chain ID is checked.

**Protocol Managed Wallets (PMW)** — the built-in FCC system app for k-of-n multisig on XRPL/BTC — are **still in development** and separate from this example.

## Build, Deploy, and Run on Coston2 (`fce`)

Prerequisites: Go ≥ 1.27.4 (+ `gcc` for cgo tests), Foundry ≥ 1.7.1, Docker with buildx + Compose (stack is `linux/amd64`; emulated on Apple Silicon — slow but fine), a Coston2 account funded from the [faucet](https://faucet.flare.network/coston2) (gas + registration + availability-check fees). **Use a test-only key**; install only from the `flare-foundation` org.

```bash
# 1. Install fce
git clone https://github.com/flare-foundation/fce-tooling.git && cd fce-tooling
go install ./cmd/fce && fce version

# 2. Fork + clone fce-go-scaffold; 3. import the deployer into a Foundry keystore (key never on the command line)
cast wallet import coston2-deployer --interactive

# 4. Test locally
go test ./template/...
fce conformance ./template        # builds the binary, runs fixtures against a fake sign port
fce image-check ./template        # builds the image, checks Dockerfile/config/binaries, smoke run
make test                         # also runs forge tests (they read the same conformance fixtures)

# 5. Deploy + register: deploys InstructionSender, ExtensionManager.register → extension ID,
#    allows the deployer as machine owner, runs PostRegister.s.sol (setExtensionId).
#    Idempotent; writes template/deployments/coston2.json — commit it.
fce deploy -chain coston2 -account coston2-deployer ./template

# 6. Allow the test code hash and set governance (deployer as sole signer for tests)
fce add-version -chain coston2 -account coston2-deployer -test ./template
fce governance -chain coston2 -account coston2-deployer \
  -signers "$(cast wallet address --account coston2-deployer)" -threshold 1 ./template
fce status -chain coston2 ./template   # compares the deployment record with the chain

# 7. Run a test machine: make image → tee-node + tee-proxy + Redis via Compose → Cloudflare quick
#    tunnel (or -url) → register (attest to chain challenge) → availability check → toProduction.
#    Prints "machine 0x… of extension <id> is in production at <public tunnel URL>"
fce run -chain coston2 -account coston2-deployer ./template   # -detach to return; fce stop later

# 8. Send work
fce send -chain coston2 -account coston2-deployer ./template 'myCommand(bytes)' 0x68656c6c6f
fce direct -chain coston2 ./template MY_EXTENSION MY_DIRECT_COMMAND 0x7b226d657373616765223a2268656c6c6f227d
```

- `fce send` takes a function signature + plain args, or raw calldata (build arrays/tuples with `cast calldata`); it simulates for the fee, sends, polls each target TEE's proxy, and verifies both TEE and proxy signatures. `fce direct` uses the proxy API key `fce run` generated.
- `tee-proxy` reads signing policies/voters through Coston2's **public RPC by default** (it then trusts the RPC); pass `fce run -indexer-db <toml>` (`host`, `port`, `database`, `username`, `password`) to use a C-chain indexer DB instead. No indexer credentials needed for the guides. `-rpc` cannot be a loopback URL (the proxy container uses it).
- **Stop with Ctrl-C / `fce stop`:** `fce` pauses the machine onchain **first** (a stopped machine stays in production and sends keep routing to it), then removes the stack. `fce run` refuses to start until the previous machine is paused.
- **Ownership:** the deployer owns both the contract (project fee, withdrawals) and the extension registration (which decides allowed code hashes). Secure it or move both to a multisig before production.

**Make it your own:** rename op type/command (no `F_`, no reserved command names) in `app.go` and `InstructionSender.sol` together → write handlers (decode strictly, validate before the first write, synchronize state) → add a `chargesFees` send function per instruction command → regenerate fixtures (`go test ./template/internal/app -update`, then `make test`, `fce conformance`) → set `org.opencontainers.image.title`/`.version` labels in `template/Dockerfile` (the version label is part of the image hash) → each `fce run` rebuilds the image.

### Example extensions

| Example | Ops | Shows |
| --- | --- | --- |
| `examples/external-api` ([guide](https://dev.flare.network/fcc/guides/external-api-extension)) | `PRICES`/`GET_PRICE` (instruction, `abi.encode(string pair)`), `PRICES`/`GET_PRICE_DIRECT` (direct, JSON, unsigned) | TLS calls to Coinbase/Kraken/Bitstamp (sources hard-coded → part of the attested image; https only, CA bundle in image, no redirects, 64 KiB cap, 5 s timeout each, median needs 2 of 3), long-running `Run` with partials `4`,`5`,`6`, `SignTEE` + `submitPrice(instructionId, data)` within 10 min, `latestPrice(pair)`. Pairs `BTC/USD`, `ETH/USD`, `FLR/USD`, 8 decimals. Refuses an already-answered instruction ID |
| `examples/direct` ([guide](https://dev.flare.network/fcc/guides/direct-actions-extension)) | `SECRETS`/`SET_ADMIN` (instr.), `SECRETS`/`PROVISION`,`ROTATE` (direct), `AUCTION`/`START`,`BID`,`END` (instr.) | Admin key set onchain, signed + ECIES-encrypted secret provisioning, replay rules, sealed-bid auction, state verifier |
| `examples/wallets` ([guide](https://dev.flare.network/fcc/guides/wallets-extension)) | `WALLETS`/`SIGN_TRANSACTION` | TEE-generated EVM wallet key, contract-numbered nonces, cosigner checks. Local test: fake sign port holds wallet `keccak256("fakenode wallet")` key 0 = Anvil's 2nd account — `cast publish` the fixture to a local `anvil` |

All run with the same `go test` → `fce conformance` → `fce deploy` → `add-version -test` → `governance` → `run` sequence pointed at `./examples/<name>`.

## Attestation and Going to Production

- **Test machines** (`fce run`) run `tee-node` in test mode (`MODE=1`) and attest `tee-node`'s **fixed test code hash** (`0x194844cf…`) on `TEST_PLATFORM` — it says nothing about the code. Contracts, data providers, and instruction flow are real. **Contracts still accept a test machine's signatures although its operator holds its key** — never leave the test version allowed on an extension real users use; `fce disable-version -test` (**permanent**) before they arrive.
- **Production** runs the attested image on a Confidential Space VM with `MODE=0`:
  ```bash
  fce add-version -chain coston2 -account coston2-deployer -platform GCP_AMD_SEV,GCP_INTEL_TDX ./template
  ```
  This builds the image **reproducibly** and allows its config digest under the image's version label. Commit first (others must be able to rebuild the hash; `fce` warns on uncommitted changes). **List every platform now** — a platform can't be added to a hash later (requires bumping the version label). A new image = new `codeHash`: `add-version`, replace the machine, register it, then `fce disable-version -hash <old>` (pauses machines still on it).
- **Governance:** the machine attests to the governance hash, so onchain signers/threshold must match what the machine was given, else `InvalidGovernanceHash`.

### Deploy a TEE on Google Cloud

[Deploy a TEE on Google Cloud](https://dev.flare.network/fcc/guides/deploy-on-gcp) uses [`fcc-node-suite-deployment`](https://github.com/flare-foundation/fcc-node-suite-deployment) Terraform: a Confidential Space **tee-machine** (no public IP; default `c3d-standard-4` → `GCP_AMD_SEV`), a public **tee-proxy** (process port `6662`, published as **80**; register `http://<static-ip>`; tee-machine reaches it on **6661** inside the VPC), a C-chain **tee-indexer** on Cloud SQL (or Flare's shared Coston2 indexer at `34.38.42.208:3306/indexer`, credentials via [support](https://flare.network/resources/technical-support)), Redis + Cloud Storage, VPC + Cloud NAT.

Key points:
- Push the image (`docker tag fce/template …; docker push`) and **pin by digest** in `terraform.tfvars` (a tag can move → silent code-hash change). GHCR packages must be made **public** (permanent).
- Service account needs `roles/confidentialcomputing.workloadUser` (else launcher exits, code 4) plus log/metric writer; use `--condition=None` on projects with conditional IAM.
- `tee_proxy_private_key` from `scripts/generate-key.sh` — its address is the **proxy id**; leave it unfunded. `initial_owner` = deployer; `extension_id` = `cast to-uint256 <extensionId>`; governance from `deployments/coston2.json`; `flare_systems_manager`/`voter_registry`/`relay`/`machine_path_manager` (= `FlareTeeManager`) resolved from the contract registry (`0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019`, same on all networks). `tfstate`/`tfvars` hold secrets in plaintext — keep out of git.
- First boot uses `tee_machine_debug_mode = true` (debug image, serial-console logs, IAP SSH) — verifiers refuse it; set `false` and run `scripts/redeploy-proxy.sh` (replaces proxy + machine together; new key) before registration.
- `/info` health: `platform` starts `0x4743505f414d445f534556` (`GCP_AMD_SEV`), `codeHash` = the hash `fce add-version` recorded (not `0x194844cf…`), `extensionId`, `initialOwner`, `teeInfo.chainId` = `114`; signing-policy hashes non-zero once the indexer has read the `Relay`. `curl localhost:6661/ready` on the proxy VM names the failing check.
- **Registration is manual** (`fce` only registers machines it started): wait for `teeInfo.lastSigningPolicyId` ≥ `getCurrentRewardEpochId()`, then (1) `IMachineManager.register` with `/info` machine data + `dataSignature` (**add 27 to the last byte**), proxy id, and the external URL, paying the `F_REG`/`TEE_ATTESTATION` fee — the receipt's `TeeInstructionsSent` is the challenge; (2) wait for `GET /action/result/<id>?submissionTag=threshold` status `1`; (3) `requestAvailabilityCheckAttestation` naming an extension-`0` production machine, paying its fee; (4) `toProduction` with the proof before the challenge expires.
- An availability check lasts **one reward epoch**; renew with `confirmAvailability`. A lapsed machine stays in production until paused. **Pause (`pause(teeId)`) before stopping a VM**; a stopped machine returns as a new one.
- Changing proxy config/image/`tee-env-*`/indexer creds → `redeploy-proxy.sh`; indexer start block/wipe → `redeploy-indexer.sh`; backed-up queue (proxy enqueues TEE-info actions while the machine is down) → `flush-redis.sh`.

## Troubleshooting

Start with **`fce status -chain coston2 <dir>`** — contracts, extension ID, allowed versions, governance, production machines and URLs; warns while the test hash is allowed. Full guide: [FCC Troubleshooting](https://dev.flare.network/fcc/troubleshooting).

**`fce` refuses:** fork's `fce-version` (e.g. `v0.1`) doesn't match the installed `fce` → install a matching release or merge upstream `main` (dev builds only warn). A `(recommended)` check failing → deviate deliberately with a `fce-i-know-what-im-doing` file (reason as text) or `-i-know-what-im-doing`. Previous run not paused → `fce stop` with the same chain/account/dir. Another machine of the extension is in production → pause it (`fce stop`, or its owner calls `MachineManager.pause`) or sends may route to a dead machine.

**Machine never reaches production:** proxy `lastSigningPolicyId` behind the current reward epoch (`curl -s <proxy>/info | jq .teeInfo.lastSigningPolicyId`; a few minutes after an epoch change); challenge expired (`fce run` re-requests — let it continue); missing test version or governance, or governance mismatch; account not an allowed machine owner; insufficient funds; "extension 0 has no machine in production" (network can't run availability checks — retry later/contact support); slow emulated host (`-host-platform`).

**After a protocol redeploy** (`Relay`/`FlareSystemsManager`/`VoterRegistry`): stop and `fce run` a new machine — `tee-proxy` reads those addresses from the contract registry at each start, so no config to edit. If registrations were also cleared, `fce status` shows it; re-run `fce deploy`.

**Sends revert:** `TooMany()` (no production machine; also from `quoteFee`) → `fce run`; `ExtensionIdNotSet()` → re-run `fce deploy`; `InsufficientFee(price, available)` → pay ≥ `quoteFee` per TEE; `TeeMachineNotAvailable` (named TEE not in production); `TeeNotFound` (not a TEE); `DuplicateTee`; `EmergencyPauseActive`; `NotCharging`/`NestedCharge`; `FeeTooLow` from `FlareTeeManager` if the forwarded value is below `calculateFeeByTeeIds`.

**Results show an error:** `error: invalid payload` (non-canonical ABI / unknown JSON field — align contract `abi.encode` with Go `abi.Arguments`, regenerate fixtures); `error: no handler for this op` (wrong names or wrong channel — `RegisterInstructionHandler` vs `RegisterDirectHandler`); `error: deadline exceeded` (> 1.5 s — return a `Run`); stuck at `status 2` (TEE restarted mid-job — time out).

**Instructions never arrive** (instruction ID onchain, result `404`, other ops fine) → reserved command name reused; rename.

When asking for help ([support](https://flare.network/resources/technical-support) / [X](https://x.com/FlareDevs)) include extension ID, TEE machine address, failing instruction ID, and `fce status` output.

## Migrating from the Legacy Scaffold

| Legacy (`fce-extension-scaffold`, `fce-sign`, `fce-weather-insurance`) | Now (`fce-go-scaffold` + `fce`) |
| --- | --- |
| `TeeExtensionRegistry`/`TeeMachineRegistry` addresses from `deployed-addresses.json` | `FlareTeeManager`, resolved from the Flare contract registry |
| `pre-build.sh`, `post-build.sh`, `test.sh`, `full-setup.sh` | `fce deploy`, `fce add-version`, `fce governance`, `fce run`, `fce send`, `fce direct` |
| Indexer DB required for `ext-proxy` | `tee-proxy` uses RPC by default; `-indexer-db` optional |
| `SIMULATED_TEE=true` | Test mode via `fce add-version -test` + `fce run` |
| Go, Python, TypeScript implementations | Go library + language-agnostic wire protocol checked by `fce conformance` |
| Hand-written `sendInstructions` + extension ID scan | `ExtensionBase` (`chargesFees`, `_send`, `quoteFee`, `_teeSigner`) |
| Secret stored onchain encrypted (`fce-sign` demo) | Signed, encrypted **direct action** to one TEE |
| Weather-insurance Web2 fetch | External API example (and the FDC `Web2Json` replacement) |

## When to Use a Different Skill

- Reading **FTSO** price feeds, **FDC** attestations, **FAssets** minting/redemption, or **Smart Accounts** — use those dedicated skills.
- General network facts (chain IDs, RPCs, faucets, explorers) — use `flare-general`.

Use **this** skill when the task involves confidential/TEE execution: building or deploying an extension, `InstructionSender`/`ExtensionBase`, instructions vs direct actions, instruction fees, TEE-signed results, wallet keys in a TEE, attestation and code-hash allowlisting, or the `fce-go-scaffold` / `fce` CLI. See [dev.flare.network/fcc](https://dev.flare.network/fcc/overview) for the official FCC documentation and the [guides index](https://dev.flare.network/fcc/guides).
