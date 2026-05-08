#!/usr/bin/env bash
# Run all GitLab CI checks locally. Mirrors .gitlab-ci.yml.
#
# Usage: ./scripts/ci-local.sh [job]
#   job: validate-skills | check-internal-links | check-links (default: all)

set -u

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

if ! command -v uv >/dev/null 2>&1; then
  echo "error: 'uv' is required but not installed. See https://docs.astral.sh/uv/" >&2
  exit 127
fi

RED=$'\033[0;31m'
GREEN=$'\033[0;32m'
YELLOW=$'\033[0;33m'
BOLD=$'\033[1m'
RESET=$'\033[0m'

declare -a FAILED=()
declare -a PASSED=()
declare -a SOFT_FAILED=()

run_job() {
  local name="$1"
  local allow_failure="$2"
  shift 2

  echo
  echo "${BOLD}==> ${name}${RESET}"
  if "$@"; then
    PASSED+=("$name")
    echo "${GREEN}✓ ${name} passed${RESET}"
  else
    local rc=$?
    if [[ "$allow_failure" == "true" ]]; then
      SOFT_FAILED+=("$name (exit $rc)")
      echo "${YELLOW}! ${name} failed (allow_failure=true, exit $rc)${RESET}"
    else
      FAILED+=("$name (exit $rc)")
      echo "${RED}✗ ${name} failed (exit $rc)${RESET}"
    fi
  fi
}

job_validate_skills() {
  uv run --with pyyaml --with jsonschema python3 scripts/validate_skills.py
}

job_check_internal_links() {
  uv run python3 scripts/check_internal_links.py
}

job_check_links() {
  ./scripts/check-links.sh
}

TARGET="${1:-all}"
case "$TARGET" in
  all)
    run_job "validate-skills"       "false" job_validate_skills
    run_job "check-internal-links"  "false" job_check_internal_links
    run_job "check-links"           "true"  job_check_links
    ;;
  validate-skills)
    run_job "validate-skills"       "false" job_validate_skills
    ;;
  check-internal-links)
    run_job "check-internal-links"  "false" job_check_internal_links
    ;;
  check-links)
    run_job "check-links"           "true"  job_check_links
    ;;
  -h|--help)
    sed -n '2,5p' "$0" | sed 's/^# \{0,1\}//'
    exit 0
    ;;
  *)
    echo "error: unknown job '$TARGET'" >&2
    echo "usage: $0 [validate-skills|check-internal-links|check-links]" >&2
    exit 2
    ;;
esac

echo
echo "${BOLD}── Summary ──${RESET}"
for j in "${PASSED[@]}";       do echo "${GREEN}✓${RESET} $j"; done
for j in "${SOFT_FAILED[@]}";  do echo "${YELLOW}!${RESET} $j"; done
for j in "${FAILED[@]}";       do echo "${RED}✗${RESET} $j"; done

if (( ${#FAILED[@]} > 0 )); then
  exit 1
fi
exit 0
