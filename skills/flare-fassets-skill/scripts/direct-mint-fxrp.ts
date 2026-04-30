/**
 * Direct Mint FXRP (memo-based) — Skill resource script
 *
 * Flow:
 *   1. Flare side: read AssetManagerFXRP via FlareContractsRegistry
 *   2. Flare side: read Core Vault XRPL address and direct-minting fee parameters
 *   3. Build a 32-byte memo: prefix(8) + zeros(4) + recipient(20)
 *   4. XRPL side: submit a Payment to the Core Vault with the memo
 *   5. An executor calls executeDirectMinting on Flare to finalize
 *
 * Write: sends a real XRPL Payment if DRY_RUN=false; requires a funded XRPL wallet.
 *        No Flare-side write is needed from the user (the executor finalizes).
 *
 * Review this script before running; execute in an isolated environment.
 *
 * Prerequisites: npm install ethers xrpl
 * For typed ABIs in TypeScript projects, prefer:
 *   - @flarenetwork/flare-wagmi-periphery-package (recommended for viem)
 *   - @flarenetwork/flare-periphery-contracts (Solidity)
 *   - @flarenetwork/flare-periphery-contract-artifacts (artifacts)
 *
 * Environment:
 *   FLARE_RPC_URL    — Flare RPC (defaults to Coston2)
 *   XRPL_WS_URL      — XRPL WebSocket (defaults to testnet)
 *   XRPL_SEED        — XRPL wallet seed (required if DRY_RUN=false)
 *   RECIPIENT        — Flare recipient address (0x...) for the minted FXRP
 *   AMOUNT_XRP       — XRP amount to send (must cover minting + executor fees)
 *   DRY_RUN          — set to "false" to actually submit the XRPL payment
 *
 * Usage: npx ts-node scripts/direct-mint-fxrp.ts
 *
 * See: https://dev.flare.network/fassets/developer-guides/fassets-direct-minting
 */

import { Contract, JsonRpcProvider, isAddress } from "ethers";
import { Client, Wallet, xrpToDrops } from "xrpl";
import type { Payment, TxResponse } from "xrpl";

// Same on all Flare networks. Verify at: https://dev.flare.network/network/guides/flare-contracts-registry
const FLARE_CONTRACTS_REGISTRY_ADDRESS = "0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019";

// Direct-minting memo prefix (signals DIRECT_MINTING; 32-byte format = recipient only).
// 8 bytes prefix + 4 zero bytes + 20 bytes recipient = 32 bytes total.
const DIRECT_MINTING_PREFIX = "4642505266410018";

const REGISTRY_ABI = [
  "function getContractAddressByName(string) view returns (address)",
];

const ASSET_MANAGER_ABI = [
  "function directMintingPaymentAddress() view returns (string)",
  "function getDirectMintingMinimumFeeUBA() view returns (uint256)",
  "function getDirectMintingFeeBIPS() view returns (uint256)",
  "function getDirectMintingExecutorFeeUBA() view returns (uint256)",
  "function getDirectMintingOthersCanExecuteAfterSeconds() view returns (uint256)",
];

function buildDirectMintingMemo(recipient: string): string {
  if (!isAddress(recipient)) {
    throw new Error(`Invalid recipient address: ${recipient}`);
  }
  // XRPL MemoData is hex-encoded with no "0x" prefix; lowercase by convention.
  return DIRECT_MINTING_PREFIX + "00000000" + recipient.slice(2).toLowerCase();
}

async function main() {
  const rpcUrl = process.env.FLARE_RPC_URL ?? "https://coston2-api.flare.network/ext/bc/C/rpc";
  const xrplWsUrl = process.env.XRPL_WS_URL ?? "wss://s.altnet.rippletest.net:51233";
  const recipient = process.env.RECIPIENT;
  const amountXrp = process.env.AMOUNT_XRP ?? "10";
  const dryRun = process.env.DRY_RUN !== "false";

  if (!recipient) {
    throw new Error("RECIPIENT environment variable is required (Flare 0x... address)");
  }

  // 1. Resolve AssetManagerFXRP via the registry
  const provider = new JsonRpcProvider(rpcUrl);
  const registry = new Contract(FLARE_CONTRACTS_REGISTRY_ADDRESS, REGISTRY_ABI, provider);
  const assetManagerAddress = await registry.getContractAddressByName("AssetManagerFXRP");
  const assetManager = new Contract(assetManagerAddress, ASSET_MANAGER_ABI, provider);

  // 2. Read Core Vault address and direct-minting parameters
  const coreVaultXrplAddress: string = await assetManager.directMintingPaymentAddress();
  const minimumFeeUBA: bigint = await assetManager.getDirectMintingMinimumFeeUBA();
  const feeBIPS: bigint = await assetManager.getDirectMintingFeeBIPS();
  const executorFeeUBA: bigint = await assetManager.getDirectMintingExecutorFeeUBA();
  const othersCanExecuteAfter: bigint =
    await assetManager.getDirectMintingOthersCanExecuteAfterSeconds();

  console.log("AssetManagerFXRP:", assetManagerAddress);
  console.log("Core Vault XRPL address:", coreVaultXrplAddress);
  console.log("Minimum minting fee (UBA):", minimumFeeUBA.toString());
  console.log("Minting fee BIPS:", feeBIPS.toString());
  console.log("Executor fee (UBA):", executorFeeUBA.toString());
  console.log("Others can execute after (s):", othersCanExecuteAfter.toString());

  // 3. Build the 32-byte memo
  const memoData = buildDirectMintingMemo(recipient);
  console.log("Memo (hex, no 0x):", memoData, "(length:", memoData.length / 2, "bytes)");

  // 4. Submit the XRPL payment to the Core Vault
  if (dryRun) {
    console.log("\n[DRY RUN] Would submit XRPL Payment:");
    console.log("  Destination:", coreVaultXrplAddress);
    console.log("  Amount:", amountXrp, "XRP");
    console.log("  MemoData:", memoData);
    console.log("\nFees are deducted from the payment. Ensure AMOUNT_XRP covers minting + executor fees.");
    console.log("Set DRY_RUN=false to submit.");
    return;
  }

  const xrplSeed = process.env.XRPL_SEED;
  if (!xrplSeed) {
    throw new Error("XRPL_SEED environment variable is required when DRY_RUN=false");
  }

  const client = new Client(xrplWsUrl);
  await client.connect();
  try {
    const wallet = Wallet.fromSeed(xrplSeed);
    const tx: Payment = {
      TransactionType: "Payment",
      Account: wallet.classicAddress,
      Destination: coreVaultXrplAddress,
      Amount: xrpToDrops(amountXrp),
      Memos: [{ Memo: { MemoData: memoData } }],
    };
    const prepared = await client.autofill(tx);
    const signed = wallet.sign(prepared);
    const result: TxResponse = await client.submitAndWait(signed.tx_blob);
    console.log("XRPL tx hash:", signed.hash);
    console.log("Result:", result.result.meta);
    console.log("\nAn executor will call executeDirectMinting after detection.");
    console.log("Watch for the DirectMintingExecuted event on AssetManagerFXRP.");
  } finally {
    await client.disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
