from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent.parent
LOOP_CONTROLS = SCRIPT_DIR / "loop_controls"
SOLVE_ISSUE_FILE = LOOP_CONTROLS / "solve_issue.txt"
PR_FILE = LOOP_CONTROLS / "pr.txt"
VERDICT_FILE = LOOP_CONTROLS / "verdict.txt"
DEV_SESSION_FILE = LOOP_CONTROLS / "dev_session.txt"
LEAD_SESSION_FILE = LOOP_CONTROLS / "lead_session.txt"
LEAD_BACKEND_FILE = LOOP_CONTROLS / "lead_backend.txt"
NEEDS_HUMAN_LABEL = "needs-human"
MAX_REVIEW_ROUNDS = 5
IDLE_INTERVAL = 30
AGENT_TIMEOUT = 3600
CLAUDE_USAGE_FALLBACK_PCT = 90
CURSOR_LEAD_MODEL = "claude-opus-4-8-thinking-high"
