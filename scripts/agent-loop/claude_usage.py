import json
import urllib.error
import urllib.request
from pathlib import Path

CLAUDE_CREDENTIALS = Path.home() / ".claude" / ".credentials.json"
CLAUDE_USAGE_URL = "https://api.anthropic.com/api/oauth/usage"


def fetch_claude_usage() -> dict | None:
	try:
		token = json.loads(CLAUDE_CREDENTIALS.read_text())["claudeAiOauth"]["accessToken"]
	except (OSError, KeyError, json.JSONDecodeError, TypeError) as exc:
		print(f"Claude usage: could not read credentials ({exc})")
		return None

	req = urllib.request.Request(
		CLAUDE_USAGE_URL,
		headers={
			"Authorization": f"Bearer {token}",
			"Accept": "application/json",
			"Content-Type": "application/json",
			"anthropic-beta": "oauth-2025-04-20",
			"anthropic-version": "2023-06-01",
		},
	)
	try:
		with urllib.request.urlopen(req, timeout=15) as resp:
			return json.loads(resp.read().decode())
	except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError) as exc:
		print(f"Claude usage: request failed ({exc})")
		return None


def _format_window(label: str, window: dict | None) -> str | None:
	if not window:
		return None
	pct = window.get("utilization")
	resets = window.get("resets_at") or "?"
	if pct is None:
		return None
	return f"  {label}: {pct:g}%  (resets {resets})"


def _window_utilization(data: dict, key: str) -> float | None:
	window = data.get(key)
	if not window:
		return None
	pct = window.get("utilization")
	if pct is None:
		return None
	return float(pct)


def should_fallback_to_cursor(threshold: float) -> bool:
	"""True when 5h session or 7d weekly utilization is at/above threshold."""
	data = fetch_claude_usage()
	if data is None:
		return False

	for key, label in (("five_hour", "5h session"), ("seven_day", "7d weekly")):
		pct = _window_utilization(data, key)
		if pct is not None and pct >= threshold:
			print(f"Claude {label} at {pct:g}% (>= {threshold:g}%) — falling back to cursor-agent")
			return True
	return False


def print_claude_usage() -> None:
	data = fetch_claude_usage()
	if data is None:
		return

	lines: list[str] = []
	for label, key in (
		("5h session", "five_hour"),
		("7d weekly", "seven_day"),
		("7d Design", "seven_day_omelette"),
	):
		line = _format_window(label, data.get(key))
		if line:
			lines.append(line)

	for limit in data.get("limits") or []:
		scope = (limit.get("scope") or {}).get("model") or {}
		name = scope.get("display_name")
		if not name:
			continue
		pct = limit.get("percent")
		resets = limit.get("resets_at") or "?"
		if pct is None:
			continue
		lines.append(f"  7d {name}: {pct:g}%  (resets {resets})")

	print("Claude plan usage:")
	if lines:
		print("\n".join(lines))
	else:
		print("  (no usage windows returned)")
