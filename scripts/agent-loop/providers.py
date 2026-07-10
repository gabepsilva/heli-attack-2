"""CLI/model profiles: YAML preference lists, usage gates, and command adapters."""

from __future__ import annotations

import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable

import yaml

import claude_usage
import const as const
import cursor_usage
import grok_usage

GateFn = Callable[["Candidate"], bool]

# YAML `cli` name → binary on PATH
CLI_BINARIES = {
	"claude": "claude",
	"cursor": "cursor-agent",
	"grok": "grok",
}


@dataclass(frozen=True)
class Candidate:
	cli: str
	model: str
	gate: str | None = None
	until_usage_pct: float | None = None
	until_api_usage_pct: float | None = None

	@property
	def profile_id(self) -> str:
		return f"{self.cli}:{self.model}"

	@property
	def label(self) -> str:
		return f"{self.cli} {self.model}"


@dataclass(frozen=True)
class RunSpec:
	cmd: list[str]
	prompt_via_stdin: bool
	format_stream: bool
	claude_stream: bool
	grok_stream: bool = False


class ConfigError(ValueError):
	pass


def _gate_claude_usage(candidate: Candidate) -> bool:
	if candidate.until_usage_pct is None:
		raise ConfigError(
			f"{candidate.profile_id}: gate claude_usage requires until_usage_pct"
		)
	return claude_usage.usage_ok(candidate.until_usage_pct)


def _gate_cursor_api_usage(candidate: Candidate) -> bool:
	if candidate.until_api_usage_pct is None:
		raise ConfigError(
			f"{candidate.profile_id}: gate cursor_api_usage requires until_api_usage_pct"
		)
	return cursor_usage.api_usage_ok(candidate.until_api_usage_pct)


def _gate_grok_usage(candidate: Candidate) -> bool:
	if candidate.until_usage_pct is None:
		raise ConfigError(
			f"{candidate.profile_id}: gate grok_usage requires until_usage_pct"
		)
	return grok_usage.usage_ok(candidate.until_usage_pct)


GATES: dict[str, GateFn] = {
	"claude_usage": _gate_claude_usage,
	"cursor_api_usage": _gate_cursor_api_usage,
	"grok_usage": _gate_grok_usage,
}

KNOWN_CLIS = frozenset(CLI_BINARIES)


def _as_float(value: Any, *, field: str, profile: str) -> float:
	if isinstance(value, bool) or not isinstance(value, (int, float)):
		raise ConfigError(f"{profile}: {field} must be a number")
	return float(value)


def _parse_candidate(raw: Any, *, index: int, role: str) -> Candidate:
	if not isinstance(raw, dict):
		raise ConfigError(f"{role}[{index}]: expected a mapping")

	cli = raw.get("cli")
	model = raw.get("model")
	if not isinstance(cli, str) or not cli.strip():
		raise ConfigError(f"{role}[{index}]: cli must be a non-empty string")
	if not isinstance(model, str) or not model.strip():
		raise ConfigError(f"{role}[{index}]: model must be a non-empty string")
	if cli not in KNOWN_CLIS:
		raise ConfigError(
			f"{role}[{index}]: unknown cli {cli!r} (known: {sorted(KNOWN_CLIS)})"
		)

	gate = raw.get("gate")
	if gate is not None and (not isinstance(gate, str) or not gate.strip()):
		raise ConfigError(f"{role}[{index}]: gate must be a non-empty string when set")
	if gate is not None and gate not in GATES:
		raise ConfigError(
			f"{role}[{index}]: unknown gate {gate!r} (known: {sorted(GATES)})"
		)

	until_usage = raw.get("until_usage_pct")
	until_api = raw.get("until_api_usage_pct")
	profile = f"{cli}:{model}"
	candidate = Candidate(
		cli=cli.strip(),
		model=model.strip(),
		gate=gate.strip() if isinstance(gate, str) else None,
		until_usage_pct=(
			_as_float(until_usage, field="until_usage_pct", profile=profile)
			if until_usage is not None
			else None
		),
		until_api_usage_pct=(
			_as_float(until_api, field="until_api_usage_pct", profile=profile)
			if until_api is not None
			else None
		),
	)
	if candidate.gate == "claude_usage" and candidate.until_usage_pct is None:
		raise ConfigError(f"{profile}: gate claude_usage requires until_usage_pct")
	if candidate.gate == "grok_usage" and candidate.until_usage_pct is None:
		raise ConfigError(f"{profile}: gate grok_usage requires until_usage_pct")
	if candidate.gate == "cursor_api_usage" and candidate.until_api_usage_pct is None:
		raise ConfigError(
			f"{profile}: gate cursor_api_usage requires until_api_usage_pct"
		)
	return candidate


def load_config(path: Path | None = None) -> dict[str, list[Candidate]]:
	config_path = path or const.CONFIG_FILE
	try:
		raw = yaml.safe_load(config_path.read_text())
	except OSError as exc:
		raise ConfigError(f"could not read {config_path}: {exc}") from exc
	except yaml.YAMLError as exc:
		raise ConfigError(f"invalid YAML in {config_path}: {exc}") from exc

	if not isinstance(raw, dict):
		raise ConfigError(f"{config_path}: root must be a mapping")

	roles: dict[str, list[Candidate]] = {}
	for role in ("lead", "dev"):
		entries = raw.get(role)
		if entries is None:
			continue
		if not isinstance(entries, list) or not entries:
			raise ConfigError(f"{role}: must be a non-empty list")
		roles[role] = [
			_parse_candidate(entry, index=i, role=role) for i, entry in enumerate(entries)
		]

	if "lead" not in roles:
		raise ConfigError("lead: missing preference list")
	if "dev" not in roles:
		raise ConfigError("dev: missing preference list")
	return roles


_CONFIG: dict[str, list[Candidate]] | None = None


def get_config(*, reload: bool = False) -> dict[str, list[Candidate]]:
	global _CONFIG
	if _CONFIG is None or reload:
		_CONFIG = load_config()
	return _CONFIG


def _cli_available(cli: str) -> bool:
	binary = CLI_BINARIES.get(cli)
	return bool(binary and shutil.which(binary))


def select_candidate(role: str) -> Candidate:
	candidates = get_config().get(role)
	if not candidates:
		raise ConfigError(f"{role}: no candidates configured")

	for candidate in candidates:
		if not _cli_available(candidate.cli):
			print(f"{role}: skipping {candidate.label} (cli not found)")
			continue
		if candidate.gate is None:
			print(f"{role}: selected {candidate.label} (no gate)")
			return candidate
		gate_fn = GATES[candidate.gate]
		if gate_fn(candidate):
			print(f"{role}: selected {candidate.label} (gate {candidate.gate} passed)")
			return candidate
		print(f"{role}: skipping {candidate.label} (gate {candidate.gate} failed)")

	raise ConfigError(f"{role}: no eligible candidate")


def cursor_agent_cmd(*, model: str) -> list[str]:
	return [
		"cursor-agent",
		"-p",
		"--yolo",
		"--output-format",
		"stream-json",
		"--stream-partial-output",
		"--workspace",
		str(const.REPO_ROOT),
		"--model",
		model,
	]


def claude_agent_cmd(*, model: str) -> list[str]:
	return [
		"claude",
		"-p",
		"--dangerously-skip-permissions",
		"--model",
		model,
		"--output-format",
		"stream-json",
		"--include-partial-messages",
		"--verbose",
	]


def grok_agent_cmd(*, model: str) -> list[str]:
	return [
		"grok",
		"-p",
		"--yolo",
		"--output-format",
		"streaming-json",
		"--cwd",
		str(const.REPO_ROOT),
		"--model",
		model,
	]


def build_run_spec(candidate: Candidate) -> RunSpec:
	if candidate.cli == "cursor":
		return RunSpec(
			cmd=cursor_agent_cmd(model=candidate.model),
			prompt_via_stdin=False,
			format_stream=True,
			claude_stream=False,
			grok_stream=False,
		)
	if candidate.cli == "claude":
		return RunSpec(
			cmd=claude_agent_cmd(model=candidate.model),
			prompt_via_stdin=True,
			format_stream=False,
			claude_stream=True,
			grok_stream=False,
		)
	if candidate.cli == "grok":
		return RunSpec(
			cmd=grok_agent_cmd(model=candidate.model),
			prompt_via_stdin=False,
			format_stream=False,
			claude_stream=False,
			grok_stream=True,
		)
	raise ConfigError(f"no adapter for cli {candidate.cli!r}")
