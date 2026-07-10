"""Wall-clock timing for agent-loop issue resolution (session start → merge)."""

from __future__ import annotations

import subprocess
import time

import const as const


def _read_started_at() -> float | None:
	if not const.ISSUE_LOOP_STARTED_AT_FILE.exists():
		return None
	try:
		return float(const.ISSUE_LOOP_STARTED_AT_FILE.read_text().strip())
	except ValueError:
		return None


def mark_started() -> None:
	const.ISSUE_LOOP_STARTED_AT_FILE.write_text(f"{time.monotonic():.6f}\n")


def clear() -> None:
	const.ISSUE_LOOP_STARTED_AT_FILE.unlink(missing_ok=True)


def elapsed_seconds() -> float | None:
	started_at = _read_started_at()
	if started_at is None:
		return None
	return max(0.0, time.monotonic() - started_at)


def format_duration(seconds: float) -> str:
	total = int(round(seconds))
	if total < 60:
		return f"{total}s"
	minutes, secs = divmod(total, 60)
	if minutes < 60:
		return f"{minutes}m {secs}s" if secs else f"{minutes}m"
	hours, minutes = divmod(minutes, 60)
	if minutes:
		return f"{hours}h {minutes}m"
	return f"{hours}h"


def post_resolution(issue: str, pr: str) -> None:
	elapsed = elapsed_seconds()
	if elapsed is None:
		print("No loop start time recorded — skipping resolution timing comment")
		return

	duration = format_duration(elapsed)
	print(f"Issue #{issue} resolved by agent loop in {duration}")

	body = (
		f"**Agent loop:** resolved in **{duration}** "
		f"(wall time from first agent session on this issue to PR #{pr} merged)."
	)
	result = subprocess.run(
		["gh", "issue", "comment", issue, "--body", body],
		capture_output=True,
		text=True,
		cwd=const.REPO_ROOT,
	)
	if result.returncode != 0:
		print(f"gh issue comment failed: {result.stderr.strip()}")
