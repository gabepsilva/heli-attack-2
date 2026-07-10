import json
import urllib.error
import urllib.request
from pathlib import Path

GROK_AUTH = Path.home() / ".grok" / "auth.json"
GROK_BILLING_URL = "https://cli-chat-proxy.grok.com/v1/billing"
GROK_USER_URL = "https://cli-chat-proxy.grok.com/v1/user?include=subscription"


def _read_access_token() -> str | None:
	try:
		auth = json.loads(GROK_AUTH.read_text())
	except (OSError, json.JSONDecodeError, TypeError):
		return None
	if not isinstance(auth, dict):
		return None
	for value in auth.values():
		if isinstance(value, dict):
			key = value.get("key")
			if isinstance(key, str) and key.strip():
				return key.strip()
	return None


def _get_json(url: str, token: str) -> dict | None:
	req = urllib.request.Request(
		url,
		headers={
			"Authorization": f"Bearer {token}",
			"Accept": "application/json",
			"User-Agent": "xai-grok-cli",
		},
	)
	try:
		with urllib.request.urlopen(req, timeout=15) as resp:
			data = json.loads(resp.read().decode())
	except (
		urllib.error.URLError,
		urllib.error.HTTPError,
		TimeoutError,
		json.JSONDecodeError,
		UnicodeDecodeError,
	):
		return None
	return data if isinstance(data, dict) else None


def fetch_grok_billing() -> dict | None:
	token = _read_access_token()
	if not token:
		print("Grok usage: could not read access token")
		return None
	data = _get_json(GROK_BILLING_URL, token)
	if data is None:
		print("Grok usage: billing request failed")
	return data


def fetch_grok_user() -> dict | None:
	token = _read_access_token()
	if not token:
		return None
	return _get_json(GROK_USER_URL, token)


def _money_val(obj: dict | None, key: str) -> float | None:
	if not isinstance(obj, dict):
		return None
	wrapped = obj.get(key)
	if isinstance(wrapped, dict) and "val" in wrapped:
		try:
			return float(wrapped["val"])
		except (TypeError, ValueError):
			return None
	return None


def _pct(used: float | None, limit: float | None) -> str:
	if used is None or limit is None or limit <= 0:
		return "?"
	return f"{100.0 * used / limit:.1f}%"


def _credits_percent_used(billing: dict) -> float | None:
	config = billing.get("config") if isinstance(billing.get("config"), dict) else {}
	used = _money_val(config, "used")
	limit = _money_val(config, "monthlyLimit")
	if used is None or limit is None or limit <= 0:
		return None
	return 100.0 * used / limit


def usage_ok(threshold: float) -> bool:
	"""True when Grok credit usage is below threshold (or unknown — stay eligible)."""
	billing = fetch_grok_billing()
	if billing is None:
		return True

	pct = _credits_percent_used(billing)
	if pct is not None and pct >= threshold:
		print(f"Grok credits at {pct:g}% (>= {threshold:g}%) — not eligible")
		return False
	return True


def print_grok_usage() -> None:
	billing = fetch_grok_billing()
	if billing is None:
		return

	config = billing.get("config") if isinstance(billing.get("config"), dict) else {}
	used = _money_val(config, "used")
	limit = _money_val(config, "monthlyLimit")
	on_demand = _money_val(config, "onDemandCap")
	period_end = config.get("billingPeriodEnd") or "?"

	user = fetch_grok_user() or {}
	tier = user.get("subscriptionTiers")
	email = user.get("email")

	lines: list[str] = []
	if email:
		lines.append(f"  account: {email}")
	if tier:
		lines.append(f"  plan: {tier}")
	lines.extend(
		[
			f"  credits: {used if used is not None else '?'} / "
			f"{limit if limit is not None else '?'}  ({_pct(used, limit)})",
			f"  cycle ends: {period_end}",
		]
	)
	if on_demand is not None and on_demand > 0:
		lines.append(f"  on-demand cap: {on_demand:g}")

	print("Grok plan usage:")
	print("\n".join(lines))
