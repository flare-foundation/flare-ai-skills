<div align="center">
  <a href="https://flare.network/" target="blank">
    <img src="https://content.flare.network/Flare-2.svg" width="300" alt="Flare Logo" />
  </a>
  <br />
 Agent Skills for Flare Development
  <br />
  <a href="#flare-ai-skills">About</a>
 ·
  <a href="CONTRIBUTING.md">Contributing</a>
 ·
  <a href="SECURITY.md">Security</a>
 ·
  <a href="CHANGELOG.md">Changelog</a>
</div>

# Flare AI Skills

A collection of Agent Skills for **Cursor**, **Claude Code**, and other [skills.sh](https://skills.sh/)-compatible agents.
Provides domain knowledge and guidance for **[Flare](https://flare.network/)** development, including FTSO, FAssets, Smart Accounts, and more.
Same `SKILL.md` format works across tools.

## Available Skills

| Skill | Description |
|-------|-------------|
| **[flare-ftso](skills/flare-ftso-skill/SKILL.md)** | FTSO—decentralized block-latency price feeds (~1.8s), Scaling anchor feeds, feed IDs, onchain and offchain consumption, fee calculation, delegation |
| **[flare-fassets](skills/flare-fassets-skill/SKILL.md)** | FAssets—wrapped tokens (FXRP, FBTC, FDOGE), minting, redemption, agents, collateral, and smart contract integration |
| **[flare-fdc](skills/flare-fdc-skill/SKILL.md)** | Flare Data Connector—attestation types (EVMTransaction, Web2Json, Payment, etc.), request flow, Merkle proofs, verifier/DA Layer, contract verification |
| **[flare-smart-accounts](skills/flare-smart-accounts-skill/SKILL.md)** | Smart Accounts—account abstraction for XRPL users to interact with Flare without owning FLR |

## What's in the skills

### flare-ftso
- **FTSO overview:** Enshrined oracle, block-latency feeds (~1.8s), ~100 data providers, stake-weighted VRF selection
- **Architecture:** Verifiably random selection, incremental delta updates, volatility incentive mechanism, Scaling anchoring
- **Feed consumption:** `FtsoV2Interface` (`getFeedById`, `getFeedsById`, wei variants), `ContractRegistry` resolution, `FeeCalculator`
- **Scaling:** Commit-reveal anchor feeds (90s), weighted median, Merkle tree finalization, incentivization
- **Offchain reads:** Web3.js/ethers scripts via RPC, `@flarenetwork/flare-periphery-contract-artifacts` for ABI

### flare-fassets
- **FAssets overview:** Trustless bridge, FTSO/FDC, collateral model
- **Participants:** Agents, users, collateral providers, liquidators, challengers
- **Workflows:** Minting (reserve → pay → FDC proof → execute) and redemption; Core Vault
- **Contracts:** Runtime contract resolution via `FlareContractsRegistry`

### flare-fdc
- **Attestation types:** AddressValidity, EVMTransaction, Web2Json, Payment, and FAssets-oriented types
- **Workflow:** Prepare request (verifier) → submit to FdcHub → round finalization → fetch proof from DA Layer → verify in contract
- **Contract pattern:** FdcVerification (ContractRegistry), verify then decode; Hardhat/Foundry starter examples (fdcExample, weatherInsurance, proofOfReserves)

### flare-smart-accounts
- **Account abstraction:** XRPL users interact with Flare without owning FLR
- **Instruction types:** FXRP, Firelight, Upshift, and custom instructions
- **CLI tool:** Python CLI for encoding and sending XRPL transactions
- **TypeScript integration:** Viem-based examples for state lookup and custom instructions

The agent uses these skills when you work with FTSO price feeds, FAssets, FXRP, minting/redemption, FDC attestations, Smart Accounts, or Flare DeFi.

## How to Use These Skills

### Option A: Using skills.sh (recommended)

Install skills with a single command:

```bash
# Install FTSO skill
npx skills add https://github.com/flare-foundation/flare-ai-skills --skill flare-ftso

# Install FAssets skill
npx skills add https://github.com/flare-foundation/flare-ai-skills --skill flare-fassets

# Install FDC skill
npx skills add https://github.com/flare-foundation/flare-ai-skills --skill flare-fdc

# Install Smart Accounts skill
npx skills add https://github.com/flare-foundation/flare-ai-skills --skill flare-smart-accounts
```

For more information, visit the [skills.sh platform page](https://skills.sh/flare-foundation/flare-ai-skills).

Then use the skills in your AI agent, for example:

> Use the flare-ftso skill and show how to consume FTSO price feeds in a Solidity contract.

> Use the flare-fassets skill and explain how to mint FXRP step by step.

> Use the flare-fdc skill and show how to request an EVMTransaction attestation and verify it in a contract.

> Use the flare-smart-accounts skill and show how to send a custom instruction from XRPL to Flare.

### Option B: Claude Code Plugin

**Personal Usage**

To install skills for your personal use in Claude Code:

1. Add the marketplace:
   ```
   /plugin marketplace add flare-foundation/flare-ai-skills
   ```
2. Install the skills:
   ```
   /plugin install flare-ftso@flare-ai-skills
   /plugin install flare-fassets@flare-ai-skills
   /plugin install flare-fdc@flare-ai-skills
   /plugin install flare-smart-accounts@flare-ai-skills
   ```
3. Manage plugins: Run `/plugin` to open the interactive plugin manager

**Project Configuration**

To automatically provide these skills to everyone working in a repository, configure the repository's `.claude/settings.json`:

```json
{
  "enabledPlugins": {
    "flare-ftso@flare-ai-skills": true,
    "flare-fassets@flare-ai-skills": true,
    "flare-fdc@flare-ai-skills": true,
    "flare-smart-accounts@flare-ai-skills": true
  },
  "extraKnownMarketplaces": {
    "flare-ai-skills": {
      "source": {
        "source": "github",
        "repo": "flare-foundation/flare-ai-skills"
      }
    }
  }
}
```

When team members open the project, Claude Code will prompt them to install the skills.

**Plugin Architecture**

This repository serves as both a skill collection and a Claude Code marketplace. The structure:

```
flare-ai-skills/
├── .claude-plugin/
│   └── marketplace.json    # Marketplace catalog listing all plugins
└── skills/
    ├── flare-ftso-skill/
    │   └── SKILL.md
    ├── flare-fassets-skill/
    │   └── SKILL.md
    ├── flare-fdc-skill/
    │   └── SKILL.md
    └── flare-smart-accounts-skill/
        └── SKILL.md
```

The `marketplace.json` defines the marketplace name (`flare-ai-skills`) and lists each plugin with its source path. Users reference plugins as `plugin-name@marketplace-name`.

### Option C: Manual install

1. Clone this repository.
2. Install or symlink the desired skill folder(s) following your tool's official skills installation docs (see links below):
   - **`skills/flare-ftso-skill/`** for FTSO
   - **`skills/flare-fassets-skill/`** for FAssets
   - **`skills/flare-fdc-skill/`** for FDC
   - **`skills/flare-smart-accounts-skill/`** for Smart Accounts
3. Use your AI tool as usual and ask it to use the appropriate skill.

**Where to Save Skills**

Follow your tool's official documentation; here are a few popular ones:

- **Codex:** [Agent Skills](https://developers.openai.com/codex/skills)
- **Claude Code:** [Extend Claude with Skills](https://docs.anthropic.com/en/docs/claude-code/skills)
- **Cursor:** [Enabling Skills](https://docs.cursor.com/context/rules-for-ai#skills) (or `.cursor/skills/` in your project / `~/.cursor/skills/` for all projects)

**How to verify**

Your agent should reference the workflow and concepts from the skill's `SKILL.md` and use `reference.md` for Flare Developer Hub links when you ask about FTSO price feeds, FAssets, FXRP, minting, redemption, FDC attestations, Smart Accounts, or related topics.

## Repository layout

```
flare-ai-skills/
├── README.md                        # This file
├── LICENSE                          # MIT
├── .gitignore
└── skills/
 ├── flare-ftso-skill/            # FTSO skill
 │   ├── SKILL.md                 # Main skill instructions
 │   ├── reference.md             # Flare Developer Hub links
 │   └── scripts/                 # Example scripts
 │       ├── consume-feeds.sol
 │       ├── verify-anchor-feed.sol
 │       ├── read-feeds-offchain.ts
 │       └── make-volatility-incentive.ts
 ├── flare-fassets-skill/         # FAssets skill
 │   ├── SKILL.md                 # Main skill instructions
 │   ├── reference.md             # Flare Developer Hub links
 │   └── scripts/
 │       └── get-fxrp-address.ts  # Utility: get FXRP address at runtime
 ├── flare-fdc-skill/             # FDC skill
 │   ├── SKILL.md                 # Main skill instructions
 │   └── reference.md             # Flare Developer Hub links
 └── flare-smart-accounts-skill/  # Smart Accounts skill
     ├── SKILL.md                 # Main skill instructions
     └── reference.md             # Flare Developer Hub links
```

Each skill folder (with `SKILL.md` and `reference.md`) can be installed independently into the tool's skills path.

## Requirements

- **Cursor:** [Cursor](https://cursor.com) with Agent/Skills support  
- **Claude Code:** Node.js 18+, `npm install -g @anthropic-ai/claude-code`, then run `claude` in your project  
- Skill content is markdown only. Optional helper script `scripts/get-fxrp-address.ts` requires Node.js tooling (`ethers`, and either `ts-node` or Hardhat).  

## Links

- [Install via skills.sh](https://skills.sh/flare-foundation/flare-ai-skills) — one-command install for Cursor, Claude Code, Codex, and more
- [Flare FTSO Overview](https://dev.flare.network/ftso/overview)
- [Flare FAssets Overview](https://dev.flare.network/fassets/overview/)
- [Flare FDC Overview](https://dev.flare.network/fdc/overview)
- [Flare Smart Accounts Overview](https://dev.flare.network/smart-accounts/overview)
- [Flare Developer Hub](https://dev.flare.network/)
- [Flare Network](https://flare.network/)  

## License

MIT — see [LICENSE](LICENSE).
