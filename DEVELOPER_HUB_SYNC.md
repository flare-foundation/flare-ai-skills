# Developer Hub Sync

The skills in this repo curate domain knowledge from the
[Flare Developer Hub](https://github.com/flare-foundation/developer-hub)
(`dev.flare.network`). This file records the last `developer-hub` commit whose
changes have been reviewed and integrated into the skills, so future syncs only
need to look at what landed after it.

## Last synced

- **Commit:** `9ac2cee52b4b65e0b83378e338a01f90a9959d39`
- **Date:** 2026-07-03
- **Subject:** `feat(docs): add Fast-Forward Nonce guide and update related documentation (#1438)`

## How to sync next time

From a local checkout of `developer-hub` (default `../developer-hub`):

```bash
DEV_HUB=../developer-hub
LAST=$(grep -oE '[0-9a-f]{40}' DEVELOPER_HUB_SYNC.md | head -1)

# What changed since the last sync
git -C "$DEV_HUB" fetch
git -C "$DEV_HUB" log --oneline "$LAST"..origin/main
git -C "$DEV_HUB" diff --stat "$LAST" origin/main
```

Review the diff, focusing on files under `docs/` that map to a skill:

| developer-hub docs area            | skill                       |
| ---------------------------------- | --------------------------- |
| `docs/fassets/**`, `docs/fxrp/**`  | `flare-fassets-skill`       |
| `docs/ftso/**`                     | `flare-ftso-skill`          |
| `docs/fdc/**`                      | `flare-fdc-skill`           |
| `docs/smart-accounts/**`           | `flare-smart-accounts-skill`|
| `docs/fcc/**`                      | `flare-fcc-skill`           |
| network/general docs               | `flare-general-skill`       |

Integrate only substantive knowledge changes (new APIs, corrected semantics, new
guides). Ignore docs-site-only changes (styling, copy buttons, sidebar nav).
After integrating, update the **Last synced** block above to the new
`developer-hub` HEAD and add a `CHANGELOG.md` entry.
