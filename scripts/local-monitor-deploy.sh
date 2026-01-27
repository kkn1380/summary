#!/bin/zsh
set -euo pipefail

REPO_DIR="/Users/knkim/workspace/toy-project/summary"
WORKTREE_DIR="$(mktemp -d /tmp/summary-gh-pages-XXXXXX)"
LAST_RUN_FILE="${REPO_DIR}/data/last-run.txt"
DEFAULT_YTDLP_PATH="/Users/knkim/Library/Python/3.9/bin/yt-dlp"

cleanup() {
  if [[ -d "${WORKTREE_DIR}" ]]; then
    git -C "${REPO_DIR}" worktree remove --force "${WORKTREE_DIR}" >/dev/null 2>&1 || true
    rm -rf "${WORKTREE_DIR}" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT

cd "${REPO_DIR}"

if [[ -z "${YTDLP_PATH:-}" && -x "${DEFAULT_YTDLP_PATH}" ]]; then
  export YTDLP_PATH="${DEFAULT_YTDLP_PATH}"
fi
if [[ -z "${YTDLP_COOKIES_FROM_BROWSER:-}" ]]; then
  export YTDLP_COOKIES_FROM_BROWSER="chrome"
fi

mkdir -p "${REPO_DIR}/data"

now_epoch=$(python3 - <<'PY'
import time
print(int(time.time()))
PY
)
today=$(python3 - <<'PY'
from datetime import date
print(date.today().strftime("%Y-%m-%d"))
PY
)
yesterday=$(python3 - <<'PY'
from datetime import date, timedelta
print((date.today() - timedelta(days=1)).strftime("%Y-%m-%d"))
PY
)

epoch_at() {
  local date_str="$1"
  local time_str="$2"
  python3 - <<PY
from datetime import datetime
print(int(datetime.strptime("${date_str} ${time_str}", "%Y-%m-%d %H:%M:%S").timestamp()))
PY
}

today_9=$(epoch_at "${today}" "09:00:00")
today_15=$(epoch_at "${today}" "15:00:00")
today_21=$(epoch_at "${today}" "21:00:00")
yesterday_21=$(epoch_at "${yesterday}" "21:00:00")

if [[ "${now_epoch}" -ge "${today_21}" ]]; then
  latest_schedule="${today_21}"
elif [[ "${now_epoch}" -ge "${today_15}" ]]; then
  latest_schedule="${today_15}"
elif [[ "${now_epoch}" -ge "${today_9}" ]]; then
  latest_schedule="${today_9}"
else
  latest_schedule="${yesterday_21}"
fi

last_run_epoch=0
if [[ -f "${LAST_RUN_FILE}" ]]; then
  last_run_epoch=$(cat "${LAST_RUN_FILE}" 2>/dev/null || echo 0)
fi

if [[ "${last_run_epoch}" -ge "${latest_schedule}" ]]; then
  echo "[info] skip: last run is newer than latest schedule."
  exit 0
fi

echo "[info] monitor start: $(date)"
pnpm run monitor

if [[ ! -d "${REPO_DIR}/data/site" ]]; then
  echo "[error] data/site not found. monitor output missing."
  exit 1
fi

git fetch origin gh-pages >/dev/null 2>&1 || true
git worktree add "${WORKTREE_DIR}" gh-pages >/dev/null

rsync -av --delete --exclude '.git' "${REPO_DIR}/data/site/" "${WORKTREE_DIR}/" >/dev/null
touch "${WORKTREE_DIR}/.nojekyll"

cd "${WORKTREE_DIR}"
git add -A

if git diff --cached --quiet; then
  echo "[info] no changes to deploy."
  exit 0
fi

git commit -m "Update site data"
git push origin gh-pages
echo "${now_epoch}" > "${LAST_RUN_FILE}"
echo "[info] deploy done: $(date)"
