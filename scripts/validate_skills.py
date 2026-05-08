#!/usr/bin/env python3
"""Validate Flare AI skills.

Checks:
  1. Each ``skills/*-skill/SKILL.md`` has well-formed YAML frontmatter that
     conforms to the SKILL schema (name, description).
  2. Each skill directory contains ``reference.md``.
  3. ``.claude-plugin/marketplace.json`` conforms to the marketplace schema
     (owner, metadata, plugin entries with semver versions, lowercase-hyphen
     names/tags, source paths under ``./skills/``).
  4. Plugin name in marketplace.json matches the SKILL.md frontmatter name
     and the skill directory name.
  5. Bidirectional sync: every skill directory has a marketplace entry, and
     every marketplace entry points to a real skill directory.

Exits 0 on success, 1 on any failure. All checks run before exit so a single
run surfaces every issue.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Any

try:
    import yaml
except ImportError:
    sys.stderr.write(
        "error: PyYAML is required. Install with `pip install pyyaml`.\n"
    )
    sys.exit(2)

try:
    from jsonschema import Draft7Validator
except ImportError:
    sys.stderr.write(
        "error: jsonschema is required. Install with `pip install jsonschema`.\n"
    )
    sys.exit(2)


REPO_ROOT = Path(__file__).resolve().parent.parent
SKILLS_DIR = REPO_ROOT / "skills"
MARKETPLACE_PATH = REPO_ROOT / ".claude-plugin" / "marketplace.json"

# Anthropic Claude Skills frontmatter limits.
# https://docs.claude.com/en/docs/agents/skills/skill-files
DESCRIPTION_MAX_CHARS = 1024
NAME_MAX_CHARS = 64

NAME_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
SEMVER_RE = re.compile(
    r"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)"
    r"(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?"
    r"(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$"
)
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

SKILL_FRONTMATTER_SCHEMA: dict[str, Any] = {
    "type": "object",
    "required": ["name", "description"],
    "properties": {
        "name": {
            "type": "string",
            "minLength": 1,
            "maxLength": NAME_MAX_CHARS,
            "pattern": NAME_RE.pattern,
        },
        "description": {
            "type": "string",
            "minLength": 40,
            "maxLength": DESCRIPTION_MAX_CHARS,
        },
    },
    "additionalProperties": True,
}

MARKETPLACE_SCHEMA: dict[str, Any] = {
    "type": "object",
    "required": ["name", "owner", "metadata", "plugins"],
    "properties": {
        "name": {"type": "string", "minLength": 1},
        "owner": {
            "type": "object",
            "required": ["name", "email"],
            "properties": {
                "name": {"type": "string", "minLength": 1},
                "email": {"type": "string", "pattern": EMAIL_RE.pattern},
            },
        },
        "metadata": {
            "type": "object",
            "required": ["description", "version"],
            "properties": {
                "description": {"type": "string", "minLength": 1},
                "version": {"type": "string", "pattern": SEMVER_RE.pattern},
            },
        },
        "plugins": {
            "type": "array",
            "minItems": 1,
            "items": {
                "type": "object",
                "required": [
                    "name",
                    "description",
                    "version",
                    "category",
                    "tags",
                    "source",
                ],
                "properties": {
                    "name": {
                        "type": "string",
                        "maxLength": NAME_MAX_CHARS,
                        "pattern": NAME_RE.pattern,
                    },
                    "description": {
                        "type": "string",
                        "minLength": 40,
                        "maxLength": DESCRIPTION_MAX_CHARS,
                    },
                    "version": {"type": "string", "pattern": SEMVER_RE.pattern},
                    "category": {"type": "string", "minLength": 1},
                    "tags": {
                        "type": "array",
                        "minItems": 1,
                        "items": {
                            "type": "string",
                            "pattern": NAME_RE.pattern,
                        },
                    },
                    "source": {
                        "type": "string",
                        "pattern": r"^\./skills/[a-z0-9][a-z0-9-]*$",
                    },
                    "strict": {"type": "boolean"},
                },
                "additionalProperties": True,
            },
        },
    },
    "additionalProperties": True,
}


class Reporter:
    """Aggregates pass/fail results so a run surfaces every issue at once."""

    def __init__(self) -> None:
        self.failed = False

    def section(self, title: str) -> None:
        print(f"\n── {title} ──────────────────────────────────")

    def context(self, label: str) -> None:
        print(f"\n  {label}")

    def ok(self, msg: str) -> None:
        print(f"    [OK]   {msg}")

    def fail(self, msg: str) -> None:
        print(f"    [FAIL] {msg}")
        self.failed = True

    def skip(self, msg: str) -> None:
        print(f"    [SKIP] {msg}")


def parse_frontmatter(text: str) -> tuple[dict[str, Any] | None, str | None]:
    """Return (frontmatter_dict, error). Either dict or error is None."""
    if not text.startswith("---"):
        return None, "file does not start with '---'"
    rest = text[3:]
    # First newline after opening ---
    if not rest.startswith("\n"):
        return None, "expected newline after opening '---'"
    rest = rest[1:]
    end = rest.find("\n---")
    if end == -1:
        return None, "frontmatter not closed with '---'"
    fm_text = rest[:end]
    try:
        loaded = yaml.safe_load(fm_text)
    except yaml.YAMLError as e:
        return None, f"YAML parse error: {e}"
    if loaded is None:
        return {}, None
    if not isinstance(loaded, dict):
        return None, f"frontmatter is not a mapping (got {type(loaded).__name__})"
    return loaded, None


def validate_against_schema(
    instance: Any, schema: dict[str, Any], reporter: Reporter
) -> bool:
    """Run schema validation, reporting each error. Returns True if valid."""
    validator = Draft7Validator(schema)
    errors = sorted(validator.iter_errors(instance), key=lambda e: list(e.path))
    if not errors:
        return True
    for err in errors:
        loc = ".".join(str(p) for p in err.absolute_path) or "<root>"
        reporter.fail(f"schema: {loc}: {err.message}")
    return False


def validate_skill_dir(skill_dir: Path, reporter: Reporter) -> dict[str, Any] | None:
    """Validate a single skill directory. Returns the frontmatter dict if valid."""
    dir_name = skill_dir.name
    if not dir_name.endswith("-skill"):
        reporter.fail(f"directory name must end with '-skill' (got '{dir_name}')")
        return None
    expected_name = dir_name[: -len("-skill")]

    skill_md = skill_dir / "SKILL.md"
    if not skill_md.is_file():
        reporter.fail("SKILL.md is missing")
        return None
    reporter.ok("SKILL.md exists")

    text = skill_md.read_text(encoding="utf-8")
    if not text.strip():
        reporter.fail("SKILL.md is empty")
        return None

    fm, err = parse_frontmatter(text)
    if fm is None:
        reporter.fail(f"frontmatter: {err}")
        return None
    reporter.ok("frontmatter parsed as valid YAML")

    schema_ok = validate_against_schema(fm, SKILL_FRONTMATTER_SCHEMA, reporter)
    if not schema_ok:
        return None
    reporter.ok("frontmatter satisfies schema")

    fm_name = fm.get("name")
    if fm_name != expected_name:
        reporter.fail(
            f"frontmatter name '{fm_name}' does not match directory "
            f"(expected '{expected_name}' from '{dir_name}')"
        )
        return None
    reporter.ok(f"frontmatter name matches directory ('{expected_name}')")

    desc = fm.get("description", "")
    reporter.ok(f"description length: {len(desc)} chars (limit {DESCRIPTION_MAX_CHARS})")

    if not (skill_dir / "reference.md").is_file():
        reporter.fail("reference.md is missing")
        return None
    reporter.ok("reference.md exists")

    return fm


def validate_marketplace(reporter: Reporter) -> dict[str, Any] | None:
    if not MARKETPLACE_PATH.is_file():
        reporter.fail(f"{MARKETPLACE_PATH.relative_to(REPO_ROOT)} not found")
        return None
    try:
        data = json.loads(MARKETPLACE_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        reporter.fail(f"marketplace.json is not valid JSON: {e}")
        return None
    reporter.ok("marketplace.json is valid JSON")

    if not validate_against_schema(data, MARKETPLACE_SCHEMA, reporter):
        return None
    reporter.ok("marketplace.json satisfies schema")
    return data


def cross_check(
    skill_frontmatter: dict[str, dict[str, Any]],
    marketplace: dict[str, Any],
    reporter: Reporter,
) -> None:
    plugins_by_name = {p["name"]: p for p in marketplace.get("plugins", [])}

    # marketplace -> skills
    for name, plugin in plugins_by_name.items():
        reporter.context(f"plugin: {name}")
        source = plugin.get("source", "")
        # Source pattern guarantees ./skills/<dirname>
        rel = source[len("./") :] if source.startswith("./") else source
        skill_dir = REPO_ROOT / rel
        if not skill_dir.is_dir():
            reporter.fail(f"source '{source}' is not a directory")
            continue
        reporter.ok(f"source directory exists ({source})")

        dir_name = skill_dir.name
        expected_dir = f"{name}-skill"
        if dir_name != expected_dir:
            reporter.fail(
                f"source directory '{dir_name}' does not match plugin name "
                f"(expected '{expected_dir}')"
            )
            continue
        reporter.ok(f"source directory name matches plugin ('{expected_dir}')")

        fm = skill_frontmatter.get(dir_name)
        if fm is None:
            reporter.fail(f"SKILL.md for '{dir_name}' did not validate")
            continue
        if fm.get("name") != name:
            reporter.fail(
                f"SKILL.md name '{fm.get('name')}' does not match marketplace "
                f"plugin name '{name}'"
            )
            continue
        reporter.ok(f"SKILL.md name matches marketplace ('{name}')")

    # skills -> marketplace
    reporter.section("skills → marketplace.json")
    for skill_dir_name, fm in skill_frontmatter.items():
        plugin_name = fm.get("name")
        reporter.context(f"skill: {skill_dir_name}")
        if plugin_name not in plugins_by_name:
            reporter.fail(
                f"no entry in marketplace.json for plugin '{plugin_name}'"
            )
        else:
            reporter.ok(f"entry found in marketplace.json ('{plugin_name}')")


def main() -> int:
    reporter = Reporter()
    print(f"Validating skills in {REPO_ROOT}")

    if not SKILLS_DIR.is_dir():
        sys.stderr.write(f"error: skills directory not found: {SKILLS_DIR}\n")
        return 2

    reporter.section("Skill structure & frontmatter")
    skill_dirs = sorted(p for p in SKILLS_DIR.iterdir() if p.is_dir())
    skill_frontmatter: dict[str, dict[str, Any]] = {}
    for skill_dir in skill_dirs:
        if not skill_dir.name.endswith("-skill"):
            continue
        reporter.context(f"skill: {skill_dir.name}")
        fm = validate_skill_dir(skill_dir, reporter)
        if fm is not None:
            skill_frontmatter[skill_dir.name] = fm

    reporter.section("marketplace.json")
    marketplace = validate_marketplace(reporter)

    if marketplace is not None:
        reporter.section("marketplace.json → skills")
        cross_check(skill_frontmatter, marketplace, reporter)

    print()
    if reporter.failed:
        print("Validation failed.")
        return 1
    print("All skills validated successfully.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
