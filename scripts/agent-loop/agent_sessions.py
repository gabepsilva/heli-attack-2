"""Per-issue agent session IDs for cursor-agent / claude resume."""

from __future__ import annotations

from enum import Enum
from pathlib import Path

import const as const


class LeadBackend(str, Enum):
	CURSOR = "cursor"
	CLAUDE = "claude"


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


def lead_backend() -> LeadBackend | None:
	raw = _read(const.LEAD_BACKEND_FILE)
	if raw is None:
		return None
	try:
		return LeadBackend(raw)
	except ValueError:
		return None


def set_lead_session(session_id: str, backend: LeadBackend) -> None:
	_write(const.LEAD_SESSION_FILE, session_id)
	_write(const.LEAD_BACKEND_FILE, backend.value)


def clear_lead_session() -> None:
	_unlink(const.LEAD_SESSION_FILE)
	_unlink(const.LEAD_BACKEND_FILE)


def clear_issue_sessions() -> None:
	for path in (
		const.DEV_SESSION_FILE,
		const.LEAD_SESSION_FILE,
		const.LEAD_BACKEND_FILE,
	):
		_unlink(path)


def cursor_resume_args(session_id: str) -> list[str]:
	return ["--resume", session_id]


def claude_resume_args(session_id: str) -> list[str]:
	return ["--resume", session_id]
