import json
import sqlite3
import subprocess
import urllib.error
import urllib.request
from pathlib import Path

CURSOR_AUTH = Path.home() / ".config" / "cursor" / "auth.json"
CURSOR_STATE_DB = (
	Path.home() / ".config" / "Cursor" / "User" / "globalStorage" / "state.vscdb"
)
CURSOR_USAGE_URL = "https://cursor.com/api/usage-summary"


def _read_access_token() -> str | None:
	try:
		return json.loads(CURSOR_AUTH.read_text())["accessToken"]
	except (OSError, KeyError, json.JSONDecodeError, TypeError):
		pass

	try:
		con = sqlite3.connect(f"file:{CURSOR_STATE_DB}?mode=ro", uri=True)
		row = con.execute(
			"SELECT value FROM ItemTable WHERE key = ?",
			("cursorAuth/accessToken",),
		).fetchone()
		con.close()
		return row[0] if row else None
	except (OSError, sqlite3.Error):
		return None


def _read_user_id() -> str | None:
	try:
		proc = subprocess.run(
			["cursor-agent", "status", "--format", "json"],
			capture_output=True,
			text=True,
			timeout=30,
		)
		if proc.returncode == 0:
			user_id = (json.loads(proc.stdout).get("userInfo") or {}).get("userId")
			if user_id is not None:
				return str(user_id)
	except (OSError, subprocess.TimeoutExpired, json.JSONDecodeError, TypeError):
		pass
	return None


def fetch_cursor_usage() -> dict | None:
	token = _read_access_token()
	if not token:
		print("Cursor usage: could not read access token")
		return None

	user_id = _read_user_id()
	if not user_id:
		print("Cursor usage: could not resolve user id")
		return None

	cookie = f"WorkosCursorSessionToken=user_{user_id}%3A%3A{token}"
	req = urllib.request.Request(
		CURSOR_USAGE_URL,
		headers={
			"Cookie": cookie,
			"Accept": "application/json",
			"Origin": "https://cursor.com",
			"User-Agent": "Mozilla/5.0",
		},
	)
	try:
		with urllib.request.urlopen(req, timeout=15) as resp:
			return json.loads(resp.read().decode())
	except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError) as exc:
		print(f"Cursor usage: request failed ({exc})")
		return None


def _pct(value: float | int | None) -> str:
	if value is None:
		return "?"
	return f"{float(value):.1f}%"


def print_cursor_usage() -> None:
	data = fetch_cursor_usage()
	if data is None:
		return

	plan = (data.get("individualUsage") or {}).get("plan") or {}
	on_demand = (data.get("individualUsage") or {}).get("onDemand") or {}
	membership = data.get("membershipType") or "?"
	cycle_end = data.get("billingCycleEnd") or "?"

	lines = [
		f"  plan: {membership}",
		f"  total: {_pct(plan.get('totalPercentUsed'))}  "
		f"(auto {_pct(plan.get('autoPercentUsed'))}, "
		f"api {_pct(plan.get('apiPercentUsed'))})",
		f"  cycle ends: {cycle_end}",
	]
	if on_demand.get("enabled"):
		used = on_demand.get("used")
		limit = on_demand.get("limit")
		lines.append(f"  on-demand: {used}/{limit}")

	print("Cursor plan usage:")
	print("\n".join(lines))
