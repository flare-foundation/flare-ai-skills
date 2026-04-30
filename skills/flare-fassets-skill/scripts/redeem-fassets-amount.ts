/**
 * Redeem FXRP by Amount — Skill resource script
 *
 * Flow: FlareContractsRegistry → AssetManagerFXRP →
 *       read minimumRedeemAmountUBA → approve FXRP → redeemAmount()
 *
 * Unlike redeem() (which redeems whole lots), redeemAmount() takes an arbitrary
 * amount in UBA. Useful when the redeemer's FXRP balance is not a clean multiple
 * of the lot size. Redemptions may be partial when ticket demand is high; multiple
 * agents may fulfill a single request — one RedemptionRequested event per agent.
 *
 * Write: sends approve and redeemAmount transactions when DRY_RUN=false; requires
 *        a funded Flare wallet with FXRP balance.
 *
 * Review this script before running; execute in an isolated environment.
 *
 * Prerequisites: npm install ethers
 * For typed ABIs in TypeScript projects, prefer:
 *   - @flarenetwork/flare-wagmi-periphery-package (recommended for viem)
 *   - @flarenetwork/flare-periphery-contracts (Solidity)
 *   - @flarenetwork/flare-periphery-contract-artifacts (artifacts)
 *
 * Environment:
 *   FLARE_RPC_URL    — Flare RPC (defaults to Coston2)
 *   PRIVATE_KEY      — wallet private key
 *   AMOUNT_UBA       — amount in UBA to redeem (must be ≥ minimumRedeemAmountUBA)
 *   UNDERLYING_ADDR  — XRPL address to receive XRP (e.g. r…)
 *   DRY_RUN          — set to "false" to broadcast transactions
 *
 * Usage: npx ts-node scripts/redeem-fassets-amount.ts
 *
 * See: https://dev.flare.network/fassets/developer-guides/fassets-redeem-amount
 */

import { Contract, JsonRpcProvider, Wallet } from "ethers";

// Same on all Flare networks. Verify at: https://dev.flare.network/network/guides/flare-contracts-registry
const FLARE_CONTRACTS_REGISTRY_ADDRESS = "0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019";

const REGISTRY_ABI = [
  "function getContractAddressByName(string) view returns (address)",
];

const ASSET_MANAGER_ABI = [
  "function fAsset() view returns (address)",
  "function minimumRedeemAmountUBA() view returns (uint256)",
  "function redeemAmount(uint256 _amountUBA, string _redeemerUnderlyingAddressString, address payable _executor) returns (uint256)",
];

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
];

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

async function main() {
  const rpcUrl = process.env.FLARE_RPC_URL ?? "https://coston2-api.flare.network/ext/bc/C/rpc";
  const privateKey = process.env.PRIVATE_KEY;
  const amountUBARaw = process.env.AMOUNT_UBA;
  const underlyingAddress = process.env.UNDERLYING_ADDR;
  const dryRun = process.env.DRY_RUN !== "false";

  if (!privateKey) throw new Error("PRIVATE_KEY environment variable is required");
  if (!amountUBARaw) throw new Error("AMOUNT_UBA environment variable is required");
  if (!underlyingAddress) throw new Error("UNDERLYING_ADDR environment variable is required");

  const amountUBA = BigInt(amountUBARaw);

  const provider = new JsonRpcProvider(rpcUrl);
  const wallet = new Wallet(privateKey, provider);

  const registry = new Contract(FLARE_CONTRACTS_REGISTRY_ADDRESS, REGISTRY_ABI, provider);
  const assetManagerAddress = await registry.getContractAddressByName("AssetManagerFXRP");
  const assetManager = new Contract(assetManagerAddress, ASSET_MANAGER_ABI, wallet);

  // Validate against minimum
  const minimumUBA: bigint = await assetManager.minimumRedeemAmountUBA();
  console.log("AssetManagerFXRP:", assetManagerAddress);
  console.log("Minimum redeem amount (UBA):", minimumUBA.toString());
  console.log("Requested amount (UBA):", amountUBA.toString());
  if (amountUBA < minimumUBA) {
    throw new Error(
      `Amount ${amountUBA} is below minimumRedeemAmountUBA ${minimumUBA}`
    );
  }

  // Check FXRP balance
  const fxrpAddress: string = await assetManager.fAsset();
  const fxrp = new Contract(fxrpAddress, ERC20_ABI, wallet);
  const balance: bigint = await fxrp.balanceOf(wallet.address);
  console.log("FXRP:", fxrpAddress);
  console.log("FXRP balance:", balance.toString());
  if (balance < amountUBA) {
    throw new Error(`Insufficient FXRP. Have: ${balance}, need: ${amountUBA}`);
  }

  if (dryRun) {
    console.log("\n[DRY RUN] Would:");
    console.log(`  1. approve(${assetManagerAddress}, ${amountUBA})`);
    console.log(`  2. redeemAmount(${amountUBA}, ${underlyingAddress}, ${ZERO_ADDRESS})`);
    console.log("\nNote: redemption may be split across multiple agents (one RedemptionRequested event per agent).");
    console.log("Watch for RedemptionAmountIncomplete if the full amount cannot be allocated.");
    console.log("Set DRY_RUN=false to broadcast.");
    return;
  }

  console.log("Approving AssetManager to spend FXRP...");
  const approveTx = await fxrp.approve(assetManagerAddress, amountUBA);
  await approveTx.wait();
  console.log("Approval confirmed");

  console.log(`Redeeming ${amountUBA} UBA to ${underlyingAddress}...`);
  const redeemTx = await assetManager.redeemAmount(amountUBA, underlyingAddress, ZERO_ADDRESS);
  const receipt = await redeemTx.wait();
  console.log("Redemption submitted. Tx:", receipt.hash);
  console.log("Inspect logs for RedemptionRequested / RedemptionAmountIncomplete events.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
