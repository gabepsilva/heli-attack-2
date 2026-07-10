"""Per-issue agent session IDs for cursor-agent / claude / grok resume."""

from __future__ import annotations

from pathlib import Path

import const as const


def _read(path: Path) -> str | None:
	if not path.exists():
		return None
	value = path.read_text().strip()
	return value or None


def _write(path: Path, value: str) -> None:
	path.write_text(value)


def _unlink(path: Path) -> None:
	path.unlink(missing_ok=True)


def dev_session_id() -> str | None:
	return _read(const.DEV_SESSION_FILE)


def set_dev_session(session_id: str) -> None:
	_write(const.DEV_SESSION_FILE, session_id)


def lead_session_id() -> str | None:
	return _read(const.LEAD_SESSION_FILE)


def lead_profile() -> str | None:
	"""Stored as ``cli:model`` (see providers.Candidate.profile_id)."""
	return _read(const.LEAD_PROFILE_FILE)


def set_lead_session(session_id: str, profile_id: str) -> None:
	_write(const.LEAD_SESSION_FILE, session_id)
	_write(const.LEAD_PROFILE_FILE, profile_id)


def clear_lead_session() -> None:
	_unlink(const.LEAD_SESSION_FILE)
	_unlink(const.LEAD_PROFILE_FILE)
	# Legacy filename from before profile_id tracking.
	_unlink(const.LOOP_CONTROLS / "lead_backend.txt")


def clear_issue_sessions() -> None:
	for path in (
		const.DEV_SESSION_FILE,
		const.LEAD_SESSION_FILE,
		const.LEAD_PROFILE_FILE,
		const.LOOP_CONTROLS / "lead_backend.txt",
	):
		_unlink(path)


def cursor_resume_args(session_id: str) -> list[str]:
	return ["--resume", session_id]


def claude_resume_args(session_id: str) -> list[str]:
	return ["--resume", session_id]


def grok_resume_args(session_id: str) -> list[str]:
	return ["--resume", session_id]
