#!/bin/zsh
set -euo pipefail

REPO_DIR="/Users/knkim/workspace/toy-project/summary"
WORKTREE_DIR="$(mktemp -d /tmp/summary-gh-pages-XXXXXX)"

cleanup() {
  if [[ -d "${WORKTREE_DIR}" ]]; then
    git -C "${REPO_DIR}" worktree remove --force "${WORKTREE_DIR}" >/dev/null 2>&1 || true
    rm -rf "${WORKTREE_DIR}" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT

cd "${REPO_DIR}"

echo "[info] monitor start: $(date)"
pnpm run monitor

if [[ ! -d "${REPO_DIR}/data/site" ]]; then
  echo "[error] data/site not found. monitor output missing."
  exit 1
fi

git fetch origin gh-pages >/dev/null 2>&1 || true
git worktree add "${WORKTREE_DIR}" gh-pages >/dev/null

rsync -av --delete --exclude '.git' "${REPO_DIR}/data/site/" "${WORKTREE_DIR}/" >/dev/null

cd "${WORKTREE_DIR}"
git add -A

if git diff --cached --quiet; then
  echo "[info] no changes to deploy."
  exit 0
fi

git commit -m "Update site data"
git push origin gh-pages
echo "[info] deploy done: $(date)"
