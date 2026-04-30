/**
 * Redeem FXRP with Tag — Skill resource script
 *
 * Flow: FlareContractsRegistry → AssetManagerFXRP →
 *       read minimumRedeemAmountUBA → approve FXRP → redeemWithTag()
 *
 * redeemWithTag is the XRP-specific redemption variant that lets the redeemer
 * specify an XRPL destination tag for the agent's payout. Use this when the
 * recipient is an exchange address that requires a destination tag.
 *
 * Function signature: redeemWithTag(amountUBA, underlyingAddress, executor, destinationTag)
 *   - amount is in UBA (not whole lots)
 *   - destination tag is a 32-bit unsigned integer (and is the LAST argument)
 *
 * Gated by the redeemWithTagSupported flag on AssetManager settings (XRP only).
 *
 * Write: sends approve and redeemWithTag transactions when DRY_RUN=false; requires
 *        a funded Flare wallet with FXRP balance.
 *
 * Review this script before running; execute in an isolated environment.
 *
 * Prerequisites: npm install ethers
 * For typed ABIs in TypeScript projects, prefer:
 *   - @flarenetwork/flare-wagmi-periphery-package (recommended for viem)
 *   - @flarenetwork/flare-periphery-contracts (Solidity)
 *
 * Environment:
 *   FLARE_RPC_URL    — Flare RPC (defaults to Coston2)
 *   PRIVATE_KEY      — wallet private key
 *   AMOUNT_UBA       — amount in UBA to redeem (must be ≥ minimumRedeemAmountUBA)
 *   UNDERLYING_ADDR  — XRPL destination address (e.g. exchange deposit address)
 *   DESTINATION_TAG  — XRPL destination tag (uint32)
 *   DRY_RUN          — set to "false" to broadcast transactions
 *
 * Usage: npx ts-node scripts/redeem-fassets-with-tag.ts
 *
 * See: https://dev.flare.network/fassets/developer-guides/fassets-redeem-with-tag
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
  "function redeemWithTag(uint256 _amountUBA, string _redeemerUnderlyingAddressString, address payable _executor, uint256 _destinationTag) returns (uint256)",
];

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
];

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const MAX_UINT32 = 0xffffffffn;

async function main() {
  const rpcUrl = process.env.FLARE_RPC_URL ?? "https://coston2-api.flare.network/ext/bc/C/rpc";
  const privateKey = process.env.PRIVATE_KEY;
  const amountUBARaw = process.env.AMOUNT_UBA;
  const underlyingAddress = process.env.UNDERLYING_ADDR;
  const destinationTagRaw = process.env.DESTINATION_TAG;
  const dryRun = process.env.DRY_RUN !== "false";

  if (!privateKey) throw new Error("PRIVATE_KEY environment variable is required");
  if (!amountUBARaw) throw new Error("AMOUNT_UBA environment variable is required");
  if (!underlyingAddress) throw new Error("UNDERLYING_ADDR environment variable is required");
  if (!destinationTagRaw) throw new Error("DESTINATION_TAG environment variable is required");

  const amountUBA = BigInt(amountUBARaw);
  const destinationTag = BigInt(destinationTagRaw);
  if (destinationTag < 0n || destinationTag > MAX_UINT32) {
    throw new Error("DESTINATION_TAG must fit in a 32-bit unsigned integer");
  }

  const provider = new JsonRpcProvider(rpcUrl);
  const wallet = new Wallet(privateKey, provider);

  const registry = new Contract(FLARE_CONTRACTS_REGISTRY_ADDRESS, REGISTRY_ABI, provider);
  const assetManagerAddress = await registry.getContractAddressByName("AssetManagerFXRP");
  const assetManager = new Contract(assetManagerAddress, ASSET_MANAGER_ABI, wallet);

  const minimumUBA: bigint = await assetManager.minimumRedeemAmountUBA();
  console.log("AssetManagerFXRP:", assetManagerAddress);
  console.log("Minimum redeem amount (UBA):", minimumUBA.toString());
  console.log("Requested amount (UBA):", amountUBA.toString());
  console.log("Destination address:", underlyingAddress);
  console.log("Destination tag:", destinationTag.toString());
  if (amountUBA < minimumUBA) {
    throw new Error(
      `Amount ${amountUBA} is below minimumRedeemAmountUBA ${minimumUBA}`
    );
  }

  const fxrpAddress: string = await assetManager.fAsset();
  const fxrp = new Contract(fxrpAddress, ERC20_ABI, wallet);
  const balance: bigint = await fxrp.balanceOf(wallet.address);
  console.log("FXRP balance:", balance.toString());
  if (balance < amountUBA) {
    throw new Error(`Insufficient FXRP. Have: ${balance}, need: ${amountUBA}`);
  }

  if (dryRun) {
    console.log("\n[DRY RUN] Would:");
    console.log(`  1. approve(${assetManagerAddress}, ${amountUBA})`);
    console.log(
      `  2. redeemWithTag(${amountUBA}, ${underlyingAddress}, ${ZERO_ADDRESS}, ${destinationTag})`
    );
    console.log("\nNote: redeemWithTag is gated by the redeemWithTagSupported flag on AssetManager settings.");
    console.log("Watch for RedemptionWithTagRequested / RedemptionAmountIncomplete events.");
    console.log("Set DRY_RUN=false to broadcast.");
    return;
  }

  console.log("Approving AssetManager to spend FXRP...");
  const approveTx = await fxrp.approve(assetManagerAddress, amountUBA);
  await approveTx.wait();
  console.log("Approval confirmed");

  console.log(
    `Redeeming ${amountUBA} UBA to ${underlyingAddress} with destination tag ${destinationTag}...`
  );
  const redeemTx = await assetManager.redeemWithTag(
    amountUBA,
    underlyingAddress,
    ZERO_ADDRESS,
    destinationTag,
  );
  const receipt = await redeemTx.wait();
  console.log("Redemption submitted. Tx:", receipt.hash);
  console.log("Inspect logs for RedemptionWithTagRequested / RedemptionAmountIncomplete events.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
