"""Pretty-print agent stream-json NDJSON to the console (cursor-agent, claude, grok)."""

from __future__ import annotations

import json
import os
import pty
import re
import select
import subprocess
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import TextIO

# cursor-agent may emit cursor show/hide when stdout is a PTY
_ANSI_RE = re.compile(r"\x1b\[[0-9;?]*[A-Za-z]|\x1b\][^\x07]*\x07")


class _C:
	RESET = "\033[0m"
	BOLD = "\033[1m"
	DIM = "\033[2m"
	CYAN = "\033[36m"
	GREEN = "\033[32m"
	YELLOW = "\033[33m"
	MAGENTA = "\033[35m"
	GRAY = "\033[90m"


@dataclass
class _State:
	section: str | None = None
	needs_newline: bool = False
	tool_count: int = 0
	session_id: str | None = None
	# call_id -> short label printed on start (for completed line)
	tools: dict[str, str] = field(default_factory=dict)


@dataclass
class StreamRunResult:
	returncode: int
	session_id: str | None = None


def _capture_session_id(state: _State, data: dict) -> None:
	sid = data.get("session_id") or data.get("sessionId")
	if sid:
		state.session_id = sid


def _session_init_suffix(
	*,
	resuming: bool,
	resume_session_id: str | None,
	session_id: str | None,
) -> str:
	short = (session_id or resume_session_id or "?")[:8]
	if resuming:
		return f"resumed session {short}…"
	return f"new session {short}…"


class StreamJsonFormatter:
	"""Chat-style live view of cursor-agent stream-json events."""

	def __init__(
		self,
		output: TextIO | None = None,
		*,
		use_colors: bool | None = None,
		resuming: bool = False,
		resume_session_id: str | None = None,
	):
		self.out = output or sys.stdout
		if use_colors is None:
			use_colors = bool(getattr(self.out, "isatty", lambda: False)())
		self.use_colors = use_colors
		self.resuming = resuming
		self.resume_session_id = resume_session_id
		self.state = _State()

	def _paint(self, text: str, *codes: str) -> str:
		if not self.use_colors or not codes:
			return text
		return f"{''.join(codes)}{text}{_C.RESET}"

	def _write(self, text: str) -> None:
		self.out.write(text)
		self.out.flush()

	def _ensure_nl(self) -> None:
		if self.state.needs_newline:
			self._write("\n")
			self.state.needs_newline = False

	def _switch(self, section: str) -> None:
		if self.state.section == section:
			return
		self._ensure_nl()
		if self.state.section is not None:
			self._write("\n")
		self.state.section = section

	def process_line(self, line: str) -> None:
		line = _ANSI_RE.sub("", line).strip()
		if not line:
			return
		try:
			data = json.loads(line)
		except json.JSONDecodeError:
			self._ensure_nl()
			self._write(line + "\n")
			self.state.section = None
			return

		kind = data.get("type")
		if kind == "system":
			self._on_system(data)
		elif kind == "thinking":
			self._on_thinking(data)
		elif kind == "assistant":
			self._on_assistant(data)
		elif kind == "tool_call":
			self._on_tool_call(data)
		elif kind == "result":
			self._on_result(data)
		# skip "user" — run.py already prints the prompt

	def _on_system(self, data: dict) -> None:
		if data.get("subtype") != "init":
			return
		_capture_session_id(self.state, data)
		model = data.get("model") or "?"
		session_label = _session_init_suffix(
			resuming=self.resuming,
			resume_session_id=self.resume_session_id,
			session_id=self.state.session_id,
		)
		self._switch("system")
		self._write(
			self._paint(f"model {model}", _C.DIM, _C.CYAN)
			+ self._paint(f"  {session_label}", _C.DIM, _C.GRAY)
			+ "\n"
		)
		self.state.section = None

	def _on_thinking(self, data: dict) -> None:
		if data.get("subtype") != "delta":
			return
		text = data.get("text") or ""
		if not text:
			return
		self._switch("thinking")
		self._write(self._paint(text, _C.DIM, _C.GRAY))
		self.state.needs_newline = True

	def _on_assistant(self, data: dict) -> None:
		# With --stream-partial-output:
		#   timestamp_ms present, model_call_id absent → streaming delta
		#   model_call_id present → buffered flush before tool (duplicate)
		#   timestamp_ms absent → final flush (duplicate)
		if "timestamp_ms" not in data or "model_call_id" in data:
			return
		text = _message_text(data.get("message"))
		if not text:
			return
		self._switch("assistant")
		self._write(text)
		self.state.needs_newline = True

	def _on_tool_call(self, data: dict) -> None:
		subtype = data.get("subtype")
		call_id = data.get("call_id") or ""
		tool_call = data.get("tool_call") or {}

		if subtype == "started":
			self.state.tool_count += 1
			label = _tool_label(tool_call)
			self.state.tools[call_id] = label
			self._switch("tool")
			self._write(
				self._paint(f"▸ {label}", _C.BOLD, _C.YELLOW) + "\n"
			)
			self.state.section = None
			return

		if subtype == "completed":
			summary = _tool_result_summary(tool_call)
			label = self.state.tools.get(call_id, _tool_label(tool_call))
			self._switch("tool")
			self._write(
				self._paint(f"  ✓ {label}", _C.YELLOW)
				+ (self._paint(f" — {summary}", _C.DIM, _C.GRAY) if summary else "")
				+ "\n"
			)
			self.state.section = None

	def _on_result(self, data: dict) -> None:
		_capture_session_id(self.state, data)
		self._ensure_nl()
		ms = data.get("duration_ms") or 0
		dur = f"{ms / 1000:.1f}s" if ms >= 1000 else f"{ms}ms"
		bits = [f"done in {dur}"]
		if self.state.tool_count:
			bits.append(f"{self.state.tool_count} tools")
		if data.get("is_error"):
			bits.append("error")
		self._write("\n" + self._paint(" · ".join(bits), _C.DIM, _C.GREEN) + "\n")
		self.state.section = None

	def finalize(self) -> None:
		self._ensure_nl()

	def session_id(self) -> str | None:
		return self.state.session_id


def _message_text(message: object) -> str:
	if not isinstance(message, dict):
		return ""
	content = message.get("content") or []
	parts: list[str] = []
	for item in content:
		if isinstance(item, dict) and item.get("type") == "text":
			parts.append(item.get("text") or "")
		elif isinstance(item, str):
			parts.append(item)
	return "".join(parts)


def _first_tool(tool_call: dict) -> tuple[str, dict]:
	if not tool_call:
		return "unknown", {}
	name, body = next(iter(tool_call.items()))
	return name, body if isinstance(body, dict) else {}


def _tool_label(tool_call: dict) -> str:
	name, body = _first_tool(tool_call)
	args = body.get("args") or {}
	desc = body.get("description") or args.get("description")

	if name == "shellToolCall":
		cmd = (args.get("command") or "").strip().replace("\n", " ")
		if len(cmd) > 120:
			cmd = cmd[:117] + "…"
		return f"$ {cmd}" if cmd else (desc or "shell")
	if name == "readToolCall":
		return f"read {args.get('path') or '?'}"
	if name == "writeToolCall":
		return f"write {args.get('path') or '?'}"
	if name == "editToolCall":
		return f"edit {args.get('path') or '?'}"
	if name == "grepToolCall" or name == "searchToolCall":
		q = args.get("query") or args.get("pattern") or "?"
		return f"search {q!r}"
	if name == "listToolCall" or name == "lsToolCall":
		return f"ls {args.get('path') or '.'}"
	if name == "deleteToolCall":
		return f"delete {args.get('path') or '?'}"
	if "function" in tool_call:
		fn = tool_call["function"]
		if isinstance(fn, dict):
			return fn.get("name") or "function"
	pretty = name.removesuffix("ToolCall") or name
	return desc or pretty


def _tool_result_summary(tool_call: dict) -> str:
	name, body = _first_tool(tool_call)
	result = body.get("result") or {}
	if "rejected" in result:
		reason = (result["rejected"] or {}).get("reason") or "rejected"
		return f"rejected: {reason}"
	success = result.get("success")
	if not isinstance(success, dict):
		return ""

	if name == "shellToolCall":
		code = success.get("exitCode", 0)
		out = (success.get("stdout") or success.get("interleavedOutput") or "").strip()
		first = out.splitlines()[0] if out else ""
		if len(first) > 80:
			first = first[:77] + "…"
		if code != 0:
			return f"exit {code}" + (f": {first}" if first else "")
		return first
	if name == "readToolCall":
		lines = success.get("totalLines")
		return f"{lines} lines" if lines is not None else ""
	if name == "writeToolCall":
		lines = success.get("linesCreated")
		size = success.get("fileSize")
		bits = []
		if lines is not None:
			bits.append(f"{lines} lines")
		if size is not None:
			bits.append(f"{size} B")
		return ", ".join(bits)
	if name == "editToolCall":
		return "applied"
	return ""


class ClaudeStreamJsonFormatter:
	"""Chat-style live view of claude -p --output-format stream-json events."""

	def __init__(
		self,
		output: TextIO | None = None,
		*,
		use_colors: bool | None = None,
		resuming: bool = False,
		resume_session_id: str | None = None,
	):
		self.out = output or sys.stdout
		if use_colors is None:
			use_colors = bool(getattr(self.out, "isatty", lambda: False)())
		self.use_colors = use_colors
		self.resuming = resuming
		self.resume_session_id = resume_session_id
		self.state = _State()
		self._seen_tool_starts: set[str] = set()
		self._tool_labels: dict[str, str] = {}

	def _paint(self, text: str, *codes: str) -> str:
		if not self.use_colors or not codes:
			return text
		return f"{''.join(codes)}{text}{_C.RESET}"

	def _write(self, text: str) -> None:
		self.out.write(text)
		self.out.flush()

	def _ensure_nl(self) -> None:
		if self.state.needs_newline:
			self._write("\n")
			self.state.needs_newline = False

	def _switch(self, section: str) -> None:
		if self.state.section == section:
			return
		self._ensure_nl()
		if self.state.section is not None:
			self._write("\n")
		self.state.section = section

	def process_line(self, line: str) -> None:
		line = _ANSI_RE.sub("", line).strip()
		if not line:
			return
		try:
			data = json.loads(line)
		except json.JSONDecodeError:
			self._ensure_nl()
			self._write(line + "\n")
			self.state.section = None
			return

		kind = data.get("type")
		if kind == "system":
			self._on_system(data)
		elif kind == "stream_event":
			self._on_stream_event(data)
		elif kind == "assistant":
			self._on_assistant(data)
		elif kind == "user":
			self._on_user(data)
		elif kind == "result":
			self._on_result(data)

	def _on_system(self, data: dict) -> None:
		if data.get("subtype") != "init":
			return
		_capture_session_id(self.state, data)
		model = data.get("model") or "?"
		session_label = _session_init_suffix(
			resuming=self.resuming,
			resume_session_id=self.resume_session_id,
			session_id=self.state.session_id,
		)
		self._switch("system")
		self._write(
			self._paint(f"model {model}", _C.DIM, _C.CYAN)
			+ self._paint(f"  {session_label}", _C.DIM, _C.GRAY)
			+ "\n"
		)
		self.state.section = None

	def _on_stream_event(self, data: dict) -> None:
		event = data.get("event") or {}
		etype = event.get("type")
		if etype == "content_block_delta":
			delta = event.get("delta") or {}
			dkind = delta.get("type")
			if dkind == "text_delta":
				text = delta.get("text") or ""
				if not text:
					return
				self._switch("assistant")
				self._write(text)
				self.state.needs_newline = True
			elif dkind == "thinking_delta":
				text = delta.get("thinking") or ""
				if not text:
					return
				self._switch("thinking")
				self._write(self._paint(text, _C.DIM, _C.GRAY))
				self.state.needs_newline = True

	def _on_assistant(self, data: dict) -> None:
		message = data.get("message") or {}
		for block in message.get("content") or []:
			if not isinstance(block, dict) or block.get("type") != "tool_use":
				continue
			tool_id = block.get("id") or ""
			if not tool_id or tool_id in self._seen_tool_starts:
				continue
			self._seen_tool_starts.add(tool_id)
			self.state.tool_count += 1
			label = _claude_tool_label(block.get("name") or "", block.get("input") or {})
			self._tool_labels[tool_id] = label
			self._switch("tool")
			self._write(self._paint(f"▸ {label}", _C.BOLD, _C.YELLOW) + "\n")
			self.state.section = None

	def _on_user(self, data: dict) -> None:
		message = data.get("message") or {}
		for block in message.get("content") or []:
			if not isinstance(block, dict) or block.get("type") != "tool_result":
				continue
			tool_id = block.get("tool_use_id") or ""
			label = self._tool_labels.get(tool_id, "tool")
			summary = _claude_tool_result_summary(block, data.get("tool_use_result"))
			self._switch("tool")
			self._write(
				self._paint(f"  ✓ {label}", _C.YELLOW)
				+ (self._paint(f" — {summary}", _C.DIM, _C.GRAY) if summary else "")
				+ "\n"
			)
			self.state.section = None

	def _on_result(self, data: dict) -> None:
		_capture_session_id(self.state, data)
		self._ensure_nl()
		ms = data.get("duration_ms") or 0
		dur = f"{ms / 1000:.1f}s" if ms >= 1000 else f"{ms}ms"
		bits = [f"done in {dur}"]
		turns = data.get("num_turns")
		if turns:
			bits.append(f"{turns} turns")
		if self.state.tool_count:
			bits.append(f"{self.state.tool_count} tools")
		if data.get("is_error"):
			bits.append("error")
		self._write("\n" + self._paint(" · ".join(bits), _C.DIM, _C.GREEN) + "\n")
		self.state.section = None

	def finalize(self) -> None:
		self._ensure_nl()

	def session_id(self) -> str | None:
		return self.state.session_id


def _claude_tool_label(name: str, inp: dict) -> str:
	if name == "Bash":
		cmd = (inp.get("command") or "").strip().replace("\n", " ")
		if len(cmd) > 120:
			cmd = cmd[:117] + "…"
		return f"$ {cmd}" if cmd else (inp.get("description") or "bash")
	if name == "Read":
		return f"read {inp.get('file_path') or inp.get('path') or '?'}"
	if name == "Write":
		return f"write {inp.get('file_path') or inp.get('path') or '?'}"
	if name == "Edit":
		return f"edit {inp.get('file_path') or inp.get('path') or '?'}"
	if name in {"Grep", "Glob"}:
		pattern = inp.get("pattern") or inp.get("query") or "?"
		return f"{name.lower()} {pattern!r}"
	if name == "Task":
		desc = inp.get("description") or inp.get("prompt") or "task"
		if len(desc) > 80:
			desc = desc[:77] + "…"
		return f"task {desc}"
	if name == "WebFetch":
		return f"fetch {inp.get('url') or '?'}"
	if name == "WebSearch":
		return f"search {inp.get('query') or '?'!r}"
	return inp.get("description") or name or "tool"


def _claude_tool_result_summary(block: dict, tool_use_result: object) -> str:
	if block.get("is_error"):
		content = block.get("content")
		if isinstance(content, str) and content.strip():
			first = content.strip().splitlines()[0]
			return first[:80] + ("…" if len(first) > 80 else "")
		return "error"

	result = tool_use_result if isinstance(tool_use_result, dict) else {}
	stdout = (result.get("stdout") or "").strip()
	if stdout:
		first = stdout.splitlines()[0]
		return first[:80] + ("…" if len(first) > 80 else "")

	content = block.get("content")
	if isinstance(content, str) and content.strip():
		first = content.strip().splitlines()[0]
		return first[:80] + ("…" if len(first) > 80 else "")
	return ""


class GrokStreamJsonFormatter:
	"""Chat-style live view of grok -p --output-format streaming-json events."""

	def __init__(
		self,
		output: TextIO | None = None,
		*,
		use_colors: bool | None = None,
		resuming: bool = False,
		resume_session_id: str | None = None,
	):
		self.out = output or sys.stdout
		if use_colors is None:
			use_colors = bool(getattr(self.out, "isatty", lambda: False)())
		self.use_colors = use_colors
		self.resuming = resuming
		self.resume_session_id = resume_session_id
		self.state = _State()
		self._announced_session = False

	def _paint(self, text: str, *codes: str) -> str:
		if not self.use_colors or not codes:
			return text
		return f"{''.join(codes)}{text}{_C.RESET}"

	def _write(self, text: str) -> None:
		self.out.write(text)
		self.out.flush()

	def _ensure_nl(self) -> None:
		if self.state.needs_newline:
			self._write("\n")
			self.state.needs_newline = False

	def _switch(self, section: str) -> None:
		if self.state.section == section:
			return
		self._ensure_nl()
		if self.state.section is not None:
			self._write("\n")
		self.state.section = section

	def _announce_session(self) -> None:
		if self._announced_session:
			return
		self._announced_session = True
		session_label = _session_init_suffix(
			resuming=self.resuming,
			resume_session_id=self.resume_session_id,
			session_id=self.state.session_id if self.resuming else None,
		)
		# Avoid "new session ?…" — id arrives only on the final end event.
		if not self.resuming and not self.state.session_id:
			session_label = "new session…"
		self._switch("system")
		self._write(
			self._paint("model grok-4.5", _C.DIM, _C.CYAN)
			+ self._paint(f"  {session_label}", _C.DIM, _C.GRAY)
			+ "\n"
		)
		self.state.section = None

	def process_line(self, line: str) -> None:
		line = _ANSI_RE.sub("", line).strip()
		if not line:
			return
		try:
			data = json.loads(line)
		except json.JSONDecodeError:
			self._ensure_nl()
			self._write(line + "\n")
			self.state.section = None
			return

		kind = data.get("type")
		if kind == "thought":
			text = data.get("data") or ""
			if not text:
				return
			self._announce_session()
			self._switch("thinking")
			self._write(self._paint(text, _C.DIM, _C.GRAY))
			self.state.needs_newline = True
		elif kind == "text":
			text = data.get("data") or ""
			if not text:
				return
			self._announce_session()
			self._switch("assistant")
			self._write(text)
			self.state.needs_newline = True
		elif kind == "end":
			_capture_session_id(self.state, data)
			self._announce_session()
			self._ensure_nl()
			reason = data.get("stopReason") or "done"
			self._write("\n" + self._paint(f"done ({reason})", _C.DIM, _C.GREEN) + "\n")
			self.state.section = None
		elif kind == "error":
			msg = data.get("message") or json.dumps(data)
			self._ensure_nl()
			self._write(self._paint(f"error: {msg}", _C.BOLD, _C.YELLOW) + "\n")
			self.state.section = None

	def finalize(self) -> None:
		self._ensure_nl()

	def session_id(self) -> str | None:
		return self.state.session_id


def pipe_cursor_stream(proc_stdout: TextIO) -> None:
	"""Consume NDJSON lines from cursor-agent stdout and print live."""
	fmt = StreamJsonFormatter()
	for line in proc_stdout:
		fmt.process_line(line)
	fmt.finalize()


def run_cursor_agent_live(
	argv: list[str],
	*,
	cwd: str | Path,
	timeout: float,
	resuming: bool = False,
	resume_session_id: str | None = None,
) -> StreamRunResult:
	"""Run cursor-agent on a PTY so stream-json flushes live (no pipe buffering)."""
	master, slave = pty.openpty()
	try:
		proc = subprocess.Popen(
			argv,
			stdin=subprocess.DEVNULL,
			stdout=slave,
			stderr=None,  # inherit — keep errors visible, out of the NDJSON stream
			cwd=cwd,
			close_fds=True,
		)
	finally:
		os.close(slave)

	fmt = StreamJsonFormatter(
		resuming=resuming,
		resume_session_id=resume_session_id,
	)
	buf = b""
	deadline = time.monotonic() + timeout

	def _feed(data: bytes) -> None:
		nonlocal buf
		buf += data
		while b"\n" in buf:
			line, buf = buf.split(b"\n", 1)
			fmt.process_line(line.decode("utf-8", errors="replace"))

	try:
		while True:
			remaining = deadline - time.monotonic()
			if remaining <= 0:
				proc.kill()
				proc.wait()
				raise subprocess.TimeoutExpired(argv, timeout)

			readable, _, _ = select.select([master], [], [], min(0.5, remaining))
			if master in readable:
				try:
					chunk = os.read(master, 4096)
				except OSError:
					chunk = b""
				if not chunk:
					break
				_feed(chunk)

			if proc.poll() is not None:
				while True:
					readable, _, _ = select.select([master], [], [], 0.05)
					if master not in readable:
						break
					try:
						chunk = os.read(master, 4096)
					except OSError:
						chunk = b""
					if not chunk:
						break
					_feed(chunk)
				break

		if buf.strip():
			fmt.process_line(buf.decode("utf-8", errors="replace"))
		fmt.finalize()
		return StreamRunResult(proc.wait(), fmt.session_id())
	finally:
		os.close(master)
		if proc.poll() is None:
			proc.kill()
			proc.wait()


def run_claude_live(
	argv: list[str],
	*,
	stdin_text: str,
	cwd: str | Path,
	timeout: float,
	resuming: bool = False,
	resume_session_id: str | None = None,
) -> StreamRunResult:
	"""Run claude -p with stream-json on a pipe and print live."""
	proc = subprocess.Popen(
		argv,
		stdin=subprocess.PIPE,
		stdout=subprocess.PIPE,
		stderr=None,
		cwd=cwd,
		text=True,
		bufsize=1,
	)
	assert proc.stdin is not None
	proc.stdin.write(stdin_text)
	proc.stdin.close()

	fmt = ClaudeStreamJsonFormatter(
		resuming=resuming,
		resume_session_id=resume_session_id,
	)
	deadline = time.monotonic() + timeout
	assert proc.stdout is not None

	while True:
		remaining = deadline - time.monotonic()
		if remaining <= 0:
			proc.kill()
			proc.wait()
			raise subprocess.TimeoutExpired(argv, timeout)

		if proc.poll() is not None:
			for line in proc.stdout:
				fmt.process_line(line)
			break

		readable, _, _ = select.select([proc.stdout], [], [], min(0.5, remaining))
		if proc.stdout in readable:
			line = proc.stdout.readline()
			if line:
				fmt.process_line(line)

	fmt.finalize()
	return StreamRunResult(proc.wait(), fmt.session_id())


def run_grok_live(
	argv: list[str],
	*,
	cwd: str | Path,
	timeout: float,
	resuming: bool = False,
	resume_session_id: str | None = None,
) -> StreamRunResult:
	"""Run grok -p with streaming-json on a pipe and print live."""
	proc = subprocess.Popen(
		argv,
		stdin=subprocess.DEVNULL,
		stdout=subprocess.PIPE,
		stderr=None,
		cwd=cwd,
		text=True,
		bufsize=1,
	)

	fmt = GrokStreamJsonFormatter(
		resuming=resuming,
		resume_session_id=resume_session_id,
	)
	deadline = time.monotonic() + timeout
	assert proc.stdout is not None

	while True:
		remaining = deadline - time.monotonic()
		if remaining <= 0:
			proc.kill()
			proc.wait()
			raise subprocess.TimeoutExpired(argv, timeout)

		if proc.poll() is not None:
			for line in proc.stdout:
				fmt.process_line(line)
			break

		readable, _, _ = select.select([proc.stdout], [], [], min(0.5, remaining))
		if proc.stdout in readable:
			line = proc.stdout.readline()
			if line:
				fmt.process_line(line)

	fmt.finalize()
	return StreamRunResult(proc.wait(), fmt.session_id())
