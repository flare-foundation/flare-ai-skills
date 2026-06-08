# Flare Smart Accounts — Reference Links

Use these when you need detailed specs, contract ABIs, or step-by-step developer guides.

## Overview and Concepts

- [Smart Accounts Overview](https://dev.flare.network/smart-accounts/overview) — System summary, proof-based and direct-minting flows, memo opcodes, account abstraction for XRPL users
- [FAsset Instructions](https://dev.flare.network/smart-accounts/fasset-instructions) — Instruction types, byte formats, encoding for FXRP/Firelight/Upshift
- [Custom Instruction](https://dev.flare.network/smart-accounts/custom-instruction) — Hash-based arbitrary contract calls via EIP-4337 `PackedUserOperation` (opcode `0xFE`, recommended)
- [Memo Field Custom Instruction](https://dev.flare.network/smart-accounts/memo-field-custom-instruction) — Inline `PackedUserOperation` in XRPL memo (opcode `0xFF`, single-actor)
- [Custom Instruction Comparison](https://dev.flare.network/smart-accounts/custom-instruction-comparison) — When to use `0xFE` vs `0xFF`

## Developer Guides — CLI

- [CLI Introduction](https://dev.flare.network/smart-accounts/guides/cli/introduction) — Installation, environment configuration, command structure
- [FAssets Cycle](https://dev.flare.network/smart-accounts/guides/cli/fassets-cycle) — Complete cycle: mint → deposit → withdraw → redeem
- [Mint and Transfer](https://dev.flare.network/smart-accounts/guides/cli/mint-and-transfer) — Mint FXRP and transfer to a Flare address

## Developer Guides — TypeScript + Viem

- [State Lookup](https://dev.flare.network/smart-accounts/guides/typescript-viem/state-lookup-ts) — Reading smart account state from Flare chain
- [Custom Instruction](https://dev.flare.network/smart-accounts/guides/typescript-viem/custom-instruction-ts) — Hash-based custom instruction (`0xFE`) using Viem
- [Memo Field Custom Instruction](https://dev.flare.network/smart-accounts/guides/typescript-viem/memo-field-custom-instruction-ts) — Inline custom instruction (`0xFF`) using Viem
- [Cross-Chain Mint](https://dev.flare.network/smart-accounts/guides/typescript-viem/cross-chain-mint-ts) — Mint FXRP from XRP and bridge to Sepolia via LayerZero in a single flow
- [Cross-Chain Redeem](https://dev.flare.network/smart-accounts/guides/typescript-viem/cross-chain-redeem-ts) — Redeem FXRP back to XRP with cross-chain flows
- [Cross-Chain Redeem to Tag](https://dev.flare.network/smart-accounts/guides/typescript-viem/cross-chain-redeem-to-tag-ts) — Redeem FXRP with a destination tag for exchange addresses

## CLI Repository

- [smart-accounts-cli (GitHub)](https://github.com/flare-foundation/smart-accounts-cli) — Python CLI for encoding and sending XRPL transactions with smart account instructions

## Related Documentation

### FAssets (for minting/redemption context)

- [FAssets Overview](https://dev.flare.network/fassets/overview) — System summary, workflow, participants
- [FXRP Overview](https://dev.flare.network/fxrp/overview) — FXRP architecture, mint/redeem paths
- [FAssets Minting](https://dev.flare.network/fassets/minting) — Minting flow, fees, payment deadlines
- [FAssets Redemption](https://dev.flare.network/fassets/redemption) — Redemption flow and agent payouts

### Supporting Protocols

- [FDC Overview](https://dev.flare.network/fdc/overview) — Flare Data Connector for payment attestation
- [FTSO Overview](https://dev.flare.network/ftso/overview) — Flare Time Series Oracle for price feeds

## Contract Interfaces

- [IMasterAccountController](https://dev.flare.network/smart-accounts/reference/IMasterAccountController) — Central contract: `getPersonalAccount`, `getNonce`, `getExecutor`, `executeInstruction`, `reserveCollateral`, `handleMintedFAssets`, `UserOperationExecuted` event
- [IPersonalAccount](https://dev.flare.network/smart-accounts/reference/IPersonalAccount) — `executeUserOp(Call[])`, `Call` struct, `CallFailed` error
- [IAssetManager](https://dev.flare.network/fassets/reference/IAssetManager) — FAssets asset manager interface; includes `executeDirectMinting` and `executeDirectMintingWithData`

## External Resources

- [XRP Faucets](https://xrpl.org/resources/dev-tools/xrp-faucets) — Get XRPL testnet credentials
- [XRPL Documentation](https://xrpl.org/docs/) — XRP Ledger developer resources

## Networks

Smart Accounts are available on:

| Network | Type | RPC URL |
|---------|------|---------|
| Coston2 | Flare testnet | `https://coston2-api.flare.network/ext/C/rpc` |
| Flare | Mainnet | `https://flare-api.flare.network/ext/C/rpc` |

XRPL testnet: `wss://s.altnet.rippletest.net:51233`
