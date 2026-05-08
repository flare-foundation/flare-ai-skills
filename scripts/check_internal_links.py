#!/usr/bin/env python3
"""Check internal (relative) markdown links across all skills.

For every ``[text](target)`` link found in markdown files under ``skills/``,
verify that ``target`` resolves to a file that exists on disk.

Skipped:
  * URLs (``http://``, ``https://``)
  * Mail/tel/etc. schemes (anything matching ``^[a-z][a-z0-9+\\-.]*:``)
  * Repo-root-absolute paths (``/foo``) — kept out of scope; external link
    checker handles those if relevant.
  * Pure anchors (``#section``) — no file to resolve.

For links with a ``#anchor`` fragment, only the file is checked, not the
anchor (anchor slugification varies by renderer; out of scope).

Exits 0 on success, 1 if any broken internal link is found.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path
from urllib.parse import unquote

REPO_ROOT = Path(__file__).resolve().parent.parent
SKILLS_DIR = REPO_ROOT / "skills"

# [text](target) — non-greedy text, target is everything up to the matching ).
# Doesn't handle nested parens in targets, which is acceptable for our content.
LINK_RE = re.compile(r"\[([^\]]*)\]\(([^)]+)\)")
SCHEME_RE = re.compile(r"^[a-z][a-z0-9+\-.]*:", re.IGNORECASE)


def is_external(target: str) -> bool:
    return bool(SCHEME_RE.match(target))


def strip_inline_title(target: str) -> str:
    """Drop optional title from ``path "title"`` link targets."""
    target = target.strip()
    # Markdown allows: (path "title") or (path 'title')
    for quote in ('"', "'"):
        idx = target.find(f" {quote}")
        if idx != -1 and target.endswith(quote):
            return target[:idx].strip()
    return target


def check_file(md_file: Path) -> list[tuple[int, str, str]]:
    """Return [(line_number, target, reason), ...] for broken links in this file."""
    broken: list[tuple[int, str, str]] = []
    text = md_file.read_text(encoding="utf-8")
    # Strip fenced code blocks so we don't lint links inside ``` blocks.
    cleaned_lines: list[str] = []
    in_fence = False
    for line in text.splitlines():
        stripped = line.lstrip()
        if stripped.startswith("```") or stripped.startswith("~~~"):
            in_fence = not in_fence
            cleaned_lines.append("")
            continue
        cleaned_lines.append("" if in_fence else line)

    for lineno, line in enumerate(cleaned_lines, start=1):
        for _, raw_target in LINK_RE.findall(line):
            target = strip_inline_title(raw_target).strip()
            if not target:
                continue
            if is_external(target):
                continue
            if target.startswith("#"):
                # Anchor-only link — file-existence check N/A.
                continue
            if target.startswith("/"):
                # Repo-root-absolute; out of scope for this checker.
                continue

            # Drop fragment + query for filesystem resolution.
            path_part = target.split("#", 1)[0].split("?", 1)[0]
            path_part = unquote(path_part)
            if not path_part:
                continue

            resolved = (md_file.parent / path_part).resolve()
            try:
                resolved.relative_to(REPO_ROOT)
            except ValueError:
                broken.append(
                    (lineno, target, f"resolves outside repo: {resolved}")
                )
                continue

            if not resolved.exists():
                broken.append((lineno, target, f"target not found: {resolved}"))
    return broken


def main() -> int:
    if not SKILLS_DIR.is_dir():
        sys.stderr.write(f"error: skills directory not found: {SKILLS_DIR}\n")
        return 2

    md_files = sorted(SKILLS_DIR.rglob("*.md"))
    print(f"Checking internal links across {len(md_files)} markdown file(s)...")

    total_broken = 0
    files_with_breaks: list[tuple[Path, list[tuple[int, str, str]]]] = []

    for md_file in md_files:
        broken = check_file(md_file)
        if broken:
            files_with_breaks.append((md_file, broken))
            total_broken += len(broken)

    print()
    if not files_with_breaks:
        print("All internal links resolve.")
        return 0

    print("── Broken internal links ──────────────────────────────")
    for md_file, broken in files_with_breaks:
        rel = md_file.relative_to(REPO_ROOT)
        for lineno, target, reason in broken:
            print(f"  [FAIL] {rel}:{lineno}  {target}  ({reason})")

    print()
    print(f"Found {total_broken} broken internal link(s).")
    return 1


if __name__ == "__main__":
    sys.exit(main())
