# FAssets Direct Minting Guide

Direct minting enables users to create FAssets (currently FXRP) through a **single transaction on the underlying blockchain**, bypassing the standard multi-step collateral reservation process. Payments go to the **Core Vault address** rather than individual agents.

**Source:** [FAssets Direct Minting](https://dev.flare.network/fassets/direct-minting)

## How It Differs from Standard Minting

| | Standard Minting | Direct Minting |
|---|---|---|
| Steps | 4 (reserve → pay → proof → execute) | 1 (send payment) |
| Destination | Individual agent address | Core Vault address |
| Collateral reservation | Required (pays CRF) | Not required |
| Parameter encoding | Payment reference from event | Destination tag or memo field |
| Executor | Optional | Required (with fallback) |

## Core Mechanism

1. Minter sends a payment on XRPL to the **Core Vault address** (obtained via `directMintingPaymentAddress()` on AssetManager).
2. Minting parameters (recipient, preferred executor) are encoded in the **destination tag** or **memo field**.
3. An executor calls `executeDirectMinting` on Flare to finalize; the executor receives a fee.

## Fee Structure

Two fees are deducted from the underlying payment amount:

| Fee | Type | Recipient |
|-----|------|-----------|
| **Minting Fee** | Percentage-based (BIPS) with minimum floor | Governance-configured receiver |
| **Executor Fee** | Flat amount in underlying asset | Executor |

**Priority:** Minting fee takes priority. If the payment is below the minimum minting fee floor, no FAssets are minted. If funds are insufficient for both fees, the executor fee is reduced before the minting fee.

**Query fee parameters:**
```
AssetManager.getDirectMintingMinimumFeeUBA()   // minimum minting fee (floor)
AssetManager.getDirectMintingFeeBIPS()          // minting fee percentage
AssetManager.getDirectMintingExecutorFeeUBA()   // flat executor fee
AssetManager.getDirectMintingFeeReceiver()      // address receiving minting fees
```

## Parameter Encoding Methods

### Method 1: Destination Tag (Recommended for Recurring Use)

- Uses the 32-bit integer destination tag native to XRPL transactions.
- The `MintingTagManager` contract maps tag IDs to Flare-side parameters (recipient address, preferred executor).
- Best for recurring minting operations where the recipient and executor are fixed.

**Workflow:**
1. Reserve a minting tag via `IMintingTagManager.reserve()` (pays a reservation fee in FLR/SGB).
2. Optionally set a custom minting recipient: `IMintingTagManager.setMintingRecipient(tagId, recipientAddress)`.
3. Optionally set a preferred executor: call `setAllowedExecutor` (10-minute cooldown before new executor activates).
4. Send XRPL payment to the Core Vault address with the tag ID as the destination tag.

**Get the MintingTagManager address:**
```
AssetManager.getMintingTagManager()
```

### Method 2: Memo Field

Two binary formats are supported in the XRPL transaction memo field:

**32-byte format (recipient only — anyone can execute):**
```
[8 bytes prefix: 0x4642505266410018] [4 bytes zero padding: 0x00000000] [20 bytes recipient address]
```
- Prefix `0x4642505266410018` signals `DIRECT_MINTING`.
- The 4-byte zero-padding segment is required in this format.
- Anyone can call `executeDirectMinting` after `othersCanExecuteAfterSeconds`.

**48-byte format (recipient + executor):**
```
[8 bytes prefix: 0x4642505266410021] [20 bytes recipient address] [20 bytes executor address]
```
- Prefix `0x4642505266410021` signals `DIRECT_MINTING_EX`.
- Set executor address to `address(0)` (zero address) to allow anyone to execute.

## Executor Restrictions

Enforcement depends on which encoding method is used:

| Method | Executor Enforcement |
|--------|---------------------|
| Tag-based | Governed by `setAllowedExecutor` on MintingTagManager |
| Memo-based | Encoded directly in memo (zero address = anyone) |
| Smart account | AssetManager enforces restrictions |

**Fallback:** If the preferred executor does not act, anyone can execute after `othersCanExecuteAfterSeconds` elapses.

```
AssetManager.getDirectMintingOthersCanExecuteAfterSeconds()
```

## Rate Limiting Parameters

Direct minting is subject to rate limits that delay (not reject) large or high-frequency mints:

| Parameter | Purpose |
|-----------|---------|
| `getDirectMintingHourlyLimitUBA()` | Hourly cap on total minted |
| `getDirectMintingDailyLimitUBA()` | Daily cap on total minted |
| `getDirectMintingLargeMintingThresholdUBA()` | Threshold above which a mint is "large" |
| `getDirectMintingLargeMintingDelaySeconds()` | Fixed delay added to large mints |

**Throttling behavior:**
- Limits delay the execution rather than rejecting it.
- Large mints above the threshold incur a fixed delay independently.
- Delayed mints emit the `DirectMintingDelayed` event with an `executionAllowedAt` timestamp.
- Governance can unblock delayed mints via `unblockDirectMintingsUntil` after manual review.

## Operational Parameters (Testnet Coston2)

| Parameter | Value |
|-----------|-------|
| Minimum Fee | 0.1 TestXRP |
| Fee Percentage | 0.25% of amount |
| Executor Fee | 0.1 TestXRP per transaction |
| Others Can Execute After | 2 hours |
| Hourly Limit | 100k TestXRP |
| Daily Limit | 500k TestXRP |
| Large Minting Threshold | 100k TestXRP |
| Large Minting Delay | 1 hour |

## MintingTagManager — Key Facts

- Tags are NFTs (ERC-721-like); ownership can be transferred.
- Tag IDs are assigned sequentially (limited 32-bit space prevents squatting; reservation requires FLR/SGB payment).
- On transfer, minting recipient resets to the new owner and allowed executor is cleared.
- `setAllowedExecutor` has a **10-minute cooldown** before the new executor becomes active.

**Testnet Coston2 parameters:**
- Reservation fee: 100 C2FLR
- Reserved tag count: 20
- NFT collection name: "Minting Tag Manager (FTestXRP open beta)"

## IMintingTagManager API

Access via `AssetManager.getMintingTagManager()`.

### Functions

**`reserve()` → uint256**
Payable. Reserves a new minting tag NFT by paying the reservation fee. Returns the newly reserved tag ID. Caller becomes the tag owner and initial minting recipient.

**`setMintingRecipient(uint256 _mintingTag, address _recipient)`**
Sets the minting recipient address for a tag. Only callable by the tag owner. Recipient receives minted FAssets when the tag is used.

**`reservationFee()` → uint256**
View. Returns the native currency fee required to reserve a tag.

**`reservedTagsForOwner(address _owner)` → uint256[]**
View. Returns all minting tag IDs owned by an address.

**`transfer(address _to, uint256 _mintingTag)`**
Transfers a minting tag to a new owner. Resets minting recipient to the new owner and clears the allowed executor.

**`mintingRecipient(uint256 _mintingTag)` → address**
View. Returns the current minting recipient for a tag.

**`allowedExecutor(uint256 _mintingTag)` → address**
View. Returns the active allowed executor for a tag (`address(0)` if unset).

## Security Considerations

- Always verify the Core Vault address via `AssetManager.directMintingPaymentAddress()` — do not hardcode.
- Memo field binary data is untrusted external input; decode strictly per the fixed binary formats documented above.
- Delayed mints (from rate limiting) will still execute once the `executionAllowedAt` timestamp passes — monitor the `DirectMintingDelayed` event.
- Tag ownership transfers reset executor permissions; verify executor is still valid after any transfer.
