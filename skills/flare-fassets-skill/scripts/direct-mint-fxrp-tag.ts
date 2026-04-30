/**
 * Direct Mint FXRP with Tag (destination-tag) — Skill resource script
 *
 * Flow:
 *   1. Flare side: read AssetManagerFXRP via FlareContractsRegistry
 *   2. Flare side: read MintingTagManager via assetManager.getMintingTagManager()
 *   3. Flare side: reserve a tag via IMintingTagManager.reserve() (payable)
 *   4. Flare side: bind tag to recipient via setMintingRecipient(tagId, recipient)
 *   5. Flare side: read Core Vault XRPL address
 *   6. XRPL side: submit a Payment to the Core Vault with the destination tag
 *
 * Tags are NFTs and can be reused across many payments. Run steps 3 and 4 once
 * to set up a tag; subsequent payments only need step 6 (just specify the tag).
 *
 * Write: sends Flare tx (reserve + setMintingRecipient) and an XRPL Payment when
 *        DRY_RUN=false. Reservation requires native FLR/SGB; payment requires XRP.
 *
 * Review this script before running; execute in an isolated environment.
 *
 * Prerequisites: npm install ethers xrpl
 * For typed ABIs, prefer @flarenetwork/flare-wagmi-periphery-package (viem).
 *
 * Environment:
 *   FLARE_RPC_URL    — Flare RPC (defaults to Coston2)
 *   PRIVATE_KEY      — Flare wallet private key (required if DRY_RUN=false)
 *   XRPL_WS_URL      — XRPL WebSocket (defaults to testnet)
 *   XRPL_SEED        — XRPL wallet seed (required if DRY_RUN=false)
 *   RECIPIENT        — Flare recipient address (0x...) for minted FXRP
 *   AMOUNT_XRP       — XRP amount to send (must cover minting + executor fees)
 *   EXISTING_TAG_ID  — optional: skip reservation and reuse an existing tag
 *   DRY_RUN          — set to "false" to actually submit transactions
 *
 * Usage: npx ts-node scripts/direct-mint-fxrp-tag.ts
 *
 * See: https://dev.flare.network/fassets/developer-guides/fassets-direct-minting-tag
 */

import { Contract, JsonRpcProvider, Wallet as EthersWallet, isAddress } from "ethers";
import { Client, Wallet as XrplWallet, xrpToDrops } from "xrpl";
import type { Payment, TxResponse } from "xrpl";

// Same on all Flare networks. Verify at: https://dev.flare.network/network/guides/flare-contracts-registry
const FLARE_CONTRACTS_REGISTRY_ADDRESS = "0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019";

const REGISTRY_ABI = [
  "function getContractAddressByName(string) view returns (address)",
];

const ASSET_MANAGER_ABI = [
  "function directMintingPaymentAddress() view returns (string)",
  "function getMintingTagManager() view returns (address)",
];

const MINTING_TAG_MANAGER_ABI = [
  "function reserve() payable returns (uint256)",
  "function reservationFee() view returns (uint256)",
  "function setMintingRecipient(uint256 _mintingTag, address _recipient)",
  "function mintingRecipient(uint256 _mintingTag) view returns (address)",
  "function reservedTagsForOwner(address _owner) view returns (uint256[])",
];

async function main() {
  const rpcUrl = process.env.FLARE_RPC_URL ?? "https://coston2-api.flare.network/ext/bc/C/rpc";
  const xrplWsUrl = process.env.XRPL_WS_URL ?? "wss://s.altnet.rippletest.net:51233";
  const recipient = process.env.RECIPIENT;
  const amountXrp = process.env.AMOUNT_XRP ?? "10";
  const existingTagId = process.env.EXISTING_TAG_ID;
  const dryRun = process.env.DRY_RUN !== "false";

  if (!recipient || !isAddress(recipient)) {
    throw new Error("RECIPIENT environment variable is required (valid Flare 0x... address)");
  }

  const provider = new JsonRpcProvider(rpcUrl);
  const registry = new Contract(FLARE_CONTRACTS_REGISTRY_ADDRESS, REGISTRY_ABI, provider);
  const assetManagerAddress = await registry.getContractAddressByName("AssetManagerFXRP");
  const assetManager = new Contract(assetManagerAddress, ASSET_MANAGER_ABI, provider);

  const tagManagerAddress: string = await assetManager.getMintingTagManager();
  const tagManagerRO = new Contract(tagManagerAddress, MINTING_TAG_MANAGER_ABI, provider);
  const reservationFee: bigint = await tagManagerRO.reservationFee();
  const coreVaultXrplAddress: string = await assetManager.directMintingPaymentAddress();

  console.log("AssetManagerFXRP:", assetManagerAddress);
  console.log("MintingTagManager:", tagManagerAddress);
  console.log("Reservation fee (wei):", reservationFee.toString());
  console.log("Core Vault XRPL address:", coreVaultXrplAddress);

  let tagId: bigint | undefined = existingTagId ? BigInt(existingTagId) : undefined;

  if (dryRun) {
    console.log("\n[DRY RUN] Would:");
    if (!tagId) {
      console.log(`  1. Pay ${reservationFee.toString()} wei to MintingTagManager.reserve()`);
      console.log("     → returns a new tag ID (caller becomes owner and recipient)");
      console.log(`  2. Call setMintingRecipient(<newTagId>, ${recipient})`);
    } else {
      console.log(`  Reuse existing tag ID ${tagId} (skipping reserve)`);
    }
    console.log(`  3. Submit XRPL Payment of ${amountXrp} XRP to ${coreVaultXrplAddress}`);
    console.log(`     with DestinationTag = <tagId>`);
    console.log("\nFees are deducted from the XRP payment.");
    console.log("Set DRY_RUN=false to submit.");
    return;
  }

  const privateKey = process.env.PRIVATE_KEY;
  const xrplSeed = process.env.XRPL_SEED;
  if (!privateKey) {
    throw new Error("PRIVATE_KEY is required when DRY_RUN=false");
  }
  if (!xrplSeed) {
    throw new Error("XRPL_SEED is required when DRY_RUN=false");
  }

  const flareWallet = new EthersWallet(privateKey, provider);
  const tagManager = new Contract(tagManagerAddress, MINTING_TAG_MANAGER_ABI, flareWallet);

  // 1 + 2: Reserve a tag and bind recipient (skip if EXISTING_TAG_ID is set)
  if (!tagId) {
    console.log("Reserving a new minting tag...");
    const reserveTx = await tagManager.reserve({ value: reservationFee });
    const reserveReceipt = await reserveTx.wait();
    console.log("Reservation tx:", reserveReceipt.hash);

    // Identify the new tag ID. The cleanest method is to read reservedTagsForOwner
    // and pick the largest ID, since IDs are assigned sequentially.
    const owned: bigint[] = await tagManager.reservedTagsForOwner(flareWallet.address);
    if (owned.length === 0) {
      throw new Error("No reserved tags found for this owner after reserve()");
    }
    tagId = owned.reduce((a, b) => (b > a ? b : a));
    console.log("Reserved tag ID:", tagId.toString());

    console.log(`Setting minting recipient for tag ${tagId} to ${recipient}...`);
    const setTx = await tagManager.setMintingRecipient(tagId, recipient);
    await setTx.wait();
    console.log("Recipient set.");
  } else {
    const current: string = await tagManagerRO.mintingRecipient(tagId);
    console.log(`Reusing tag ${tagId} (current recipient: ${current})`);
    if (current.toLowerCase() !== recipient.toLowerCase()) {
      console.log("Updating recipient to", recipient);
      const setTx = await tagManager.setMintingRecipient(tagId, recipient);
      await setTx.wait();
    }
  }

  // 3: Submit XRPL payment with the destination tag
  // XRPL DestinationTag is a 32-bit unsigned integer, so the tag must fit.
  const tagAsU32 = Number(tagId);
  if (!Number.isInteger(tagAsU32) || tagAsU32 < 0 || tagAsU32 > 0xffffffff) {
    throw new Error(`Tag ID ${tagId.toString()} does not fit into a 32-bit XRPL destination tag`);
  }

  const client = new Client(xrplWsUrl);
  await client.connect();
  try {
    const xrplWallet = XrplWallet.fromSeed(xrplSeed);
    const tx: Payment = {
      TransactionType: "Payment",
      Account: xrplWallet.classicAddress,
      Destination: coreVaultXrplAddress,
      DestinationTag: tagAsU32,
      Amount: xrpToDrops(amountXrp),
    };
    const prepared = await client.autofill(tx);
    const signed = xrplWallet.sign(prepared);
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
