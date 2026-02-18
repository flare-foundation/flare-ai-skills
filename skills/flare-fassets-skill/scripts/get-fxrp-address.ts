/**
 * Get FXRP address — Skill resource script
 *
 * Flow: FlareContractsRegistry → AssetManagerFXRP → fAsset()
 * Read-only: queries chain via RPC only; no writes or external fetches.
 *
 * Run in a project with ethers (e.g. Flare Hardhat Starter Kit or any Node app with ethers).
 * Review this script before running; execute in an isolated environment.
 *
 * Prerequisites: npm install ethers
 * Usage: npx ts-node scripts/get-fxrp-address.ts
 * Or with Hardhat: yarn hardhat run scripts/get-fxrp-address.ts --network coston2
 */

import { Contract, JsonRpcProvider } from "ethers";

// Same on all Flare networks. Verify at: https://dev.flare.network/network/guides/flare-contracts-registry
const FLARE_CONTRACTS_REGISTRY_ADDRESS = "0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019";

const REGISTRY_ABI = [
  "function getContractAddressByName(string) view returns (address)",
];

const ASSET_MANAGER_ABI = [
  "function fAsset() view returns (address)",
];

async function getFXRPAddress(rpcUrl: string): Promise<string> {
  const provider = new JsonRpcProvider(rpcUrl);
  const registry = new Contract(
    FLARE_CONTRACTS_REGISTRY_ADDRESS,
    REGISTRY_ABI,
    provider
  );
  const assetManagerAddress = await registry.getContractAddressByName("AssetManagerFXRP");
  if (!assetManagerAddress || assetManagerAddress === "0x0000000000000000000000000000000000000000") {
    throw new Error("AssetManagerFXRP not found in Flare Contract Registry");
  }
  const assetManager = new Contract(
    assetManagerAddress,
    ASSET_MANAGER_ABI,
    provider
  );
  const fxrpAddress = await assetManager.fAsset();
  return fxrpAddress;
}

async function main() {
  const rpcUrl = process.env.FLARE_RPC_URL ?? "https://coston2-api.flare.network/ext/bc/C/rpc";
  const fxrpAddress = await getFXRPAddress(rpcUrl);
  console.log("FXRP address:", fxrpAddress);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
