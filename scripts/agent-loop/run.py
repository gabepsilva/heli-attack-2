import argparse
import json
import shutil
import subprocess
import sys
import time
from pathlib import Path

import agent_sessions
import claude_usage
import const as const
import cursor_usage
import issue_timing
import prompt_strings as prompts
import stream_format

PAUSE = False

ISSUES_WITH_PRS_QUERY = """
query($owner: String!, $name: String!) {
  repository(owner: $owner, name: $name) {
    issues(first: 100, states: OPEN) {
      nodes {
        number
        title
        url
        labels(first: 20) {
          nodes { name }
        }
        timelineItems(itemTypes: [CROSS_REFERENCED_EVENT, CONNECTED_EVENT], first: 50) {
          nodes {
            __typename
            ... on ConnectedEvent {
              subject {
                ... on PullRequest {
                  number
                  title
                  state
                  url
                }
              }
            }
            ... on CrossReferencedEvent {
              source {
                ... on PullRequest {
                  number
                  title
                  state
                  url
                }
              }
            }
          }
        }
      }
    }
  }
}
"""


def gh(*args: str) -> subprocess.CompletedProcess:
	return subprocess.run(
		["gh", *args], capture_output=True, text=True, cwd=const.REPO_ROOT
	)


def repo_owner_name() -> tuple[str, str] | None:
	result = gh("repo", "view", "--json", "owner,name", "-q", ".owner.login + \" \" + .name")
	if result.returncode != 0:
		print(f"gh repo view failed: {result.stderr.strip()}")
		return None
	parts = result.stdout.strip().split()
	if len(parts) != 2:
		print(f"unexpected repo view output: {result.stdout.strip()!r}")
		return None
	return parts[0], parts[1]


def list_open_issues_with_prs() -> list[dict]:
	"""Open issues (excluding needs-human) with deduped linked/referenced PRs."""
	repo = repo_owner_name()
	if repo is None:
		return []
	owner, name = repo
	result = gh(
		"api",
		"graphql",
		"-f",
		f"query={ISSUES_WITH_PRS_QUERY}",
		"-F",
		f"owner={owner}",
		"-F",
		f"name={name}",
	)
	if result.returncode != 0:
		print(f"gh graphql failed: {result.stderr.strip()}")
		return []

	try:
		payload = json.loads(result.stdout)
		nodes = payload["data"]["repository"]["issues"]["nodes"]
	except (json.JSONDecodeError, KeyError, TypeError) as exc:
		print(f"failed to parse issues-with-PRs response: {exc}")
		return []

	issues: list[dict] = []
	for issue in nodes:
		labels = {label["name"] for label in issue.get("labels", {}).get("nodes", [])}
		if const.NEEDS_HUMAN_LABEL in labels:
			continue

		prs: dict[int, dict] = {}
		for event in issue.get("timelineItems", {}).get("nodes", []):
			pr = None
			if event.get("__typename") == "ConnectedEvent":
				pr = event.get("subject")
			elif event.get("__typename") == "CrossReferencedEvent":
				pr = event.get("source")
			if not pr or "number" not in pr:
				continue
			prs[pr["number"]] = {
				"number": pr["number"],
				"title": pr.get("title", ""),
				"state": pr.get("state", ""),
				"url": pr.get("url", ""),
			}

		issues.append(
			{
				"number": issue["number"],
				"title": issue["title"],
				"url": issue["url"],
				"prs": sorted(prs.values(), key=lambda p: p["number"]),
			}
		)

	issues.sort(
		key=lambda i: (
			0 if any(p["state"] == "OPEN" for p in i["prs"]) else 1,
			i["number"],
		)
	)
	return issues


def issues_with_open_prs(issues: list[dict] | None = None) -> list[dict]:
	"""Issues that have at least one OPEN linked/referenced PR."""
	if issues is None:
		issues = list_open_issues_with_prs()
	filtered: list[dict] = []
	for issue in issues:
		open_prs = [p for p in issue["prs"] if p["state"] == "OPEN"]
		if not open_prs:
			continue
		filtered.append({**issue, "prs": open_prs})
	return filtered


def format_issues_with_prs(issues: list[dict]) -> str:
	if not issues:
		return "(none)"

	lines: list[str] = []
	for issue in issues:
		lines.append(f"#{issue['number']}: {issue['title']}")
		for pr in issue["prs"]:
			lines.append(f"  PR #{pr['number']} [{pr['state']}] {pr['title']}")
	return "\n".join(lines)


def has_open_issues() -> bool:
	return bool(list_open_issues_with_prs())


def ensure_label() -> None:
	gh(
		"label",
		"create",
		const.NEEDS_HUMAN_LABEL,
		"--color",
		"D93F0B",
		"--description",
		"Agent loop gave up on this issue; needs a human",
		"--force",
	)


def mark_needs_human(issue: str, reason: str) -> None:
	print(f"Marking issue #{issue} as {const.NEEDS_HUMAN_LABEL}: {reason}")
	agent_sessions.clear_issue_sessions()
	issue_timing.clear()
	gh("issue", "edit", issue, "--add-label", const.NEEDS_HUMAN_LABEL)
	gh("issue", "comment", issue, "--body", f"Agent loop stopped working on this issue: {reason}")


def read_control(path: Path) -> str:
	return path.read_text().strip() if path.exists() else ""


def clear_control(path: Path) -> None:
	path.unlink(missing_ok=True)


def reset_loop_controls() -> None:
	if const.LOOP_CONTROLS.exists():
		shutil.rmtree(const.LOOP_CONTROLS)
	const.LOOP_CONTROLS.mkdir()


def run_agent(
	cmd: list[str],
	banner: str,
	str_prompt: str,
	*,
	prompt_via_stdin: bool = False,
	format_stream: bool = False,
	claude_stream: bool = False,
	resuming: bool = False,
	resume_session_id: str | None = None,
) -> str | None:
	if PAUSE:
		input(f"[pause] press Enter to run {banner}... ")
	print("")
	print("--------------------------------")
	print(f"{banner}  prompt:")
	print(str_prompt)
	print("--------------------------------")
	print("")
	argv = cmd if prompt_via_stdin else [*cmd, str_prompt]
	session_id: str | None = None
	try:
		if claude_stream:
			result = stream_format.run_claude_live(
				argv,
				stdin_text=str_prompt,
				cwd=const.REPO_ROOT,
				timeout=const.AGENT_TIMEOUT,
				resuming=resuming,
				resume_session_id=resume_session_id,
			)
			session_id = result.session_id
			if result.returncode != 0:
				raise subprocess.CalledProcessError(result.returncode, argv)
		elif format_stream:
			# PTY so cursor-agent line-buffers stream-json (pipes batch until done).
			result = stream_format.run_cursor_agent_live(
				argv,
				cwd=const.REPO_ROOT,
				timeout=const.AGENT_TIMEOUT,
				resuming=resuming,
				resume_session_id=resume_session_id,
			)
			session_id = result.session_id
			if result.returncode != 0:
				raise subprocess.CalledProcessError(result.returncode, argv)
		else:
			subprocess.run(
				argv,
				input=str_prompt if prompt_via_stdin else None,
				cwd=const.REPO_ROOT,
				check=True,
				timeout=const.AGENT_TIMEOUT,
				text=True,
			)
	except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as exc:
		print(f"{banner} failed: {exc}")
		print("Aborting agent loop")
		sys.exit(1)
	return session_id


def _cursor_agent_cmd(*, model: str) -> list[str]:
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


def run_dev_agent(*, full_prompt: str, resume_prompt: str | None = None) -> None:
	cmd = _cursor_agent_cmd(model="auto")
	sid = agent_sessions.dev_session_id()
	resuming = sid is not None and resume_prompt is not None
	if resuming:
		cmd.extend(agent_sessions.cursor_resume_args(sid))
		prompt = resume_prompt
		banner = "🖥️🖥️🖥️  dev agent (resume)"
	else:
		prompt = full_prompt
		banner = "🖥️🖥️🖥️  dev agent (new session)"

	session_id = run_agent(
		cmd,
		banner,
		prompt,
		format_stream=True,
		resuming=resuming,
		resume_session_id=sid if resuming else None,
	)
	if session_id:
		agent_sessions.set_dev_session(session_id)


def run_lead_agent(*, full_prompt: str, resume_prompt: str | None = None) -> None:
	use_cursor = claude_usage.should_fallback_to_cursor(const.CLAUDE_USAGE_FALLBACK_PCT)
	backend = (
		agent_sessions.LeadBackend.CURSOR
		if use_cursor
		else agent_sessions.LeadBackend.CLAUDE
	)

	sid = agent_sessions.lead_session_id()
	if sid and agent_sessions.lead_backend() != backend:
		agent_sessions.clear_lead_session()
		sid = None

	resuming = sid is not None and resume_prompt is not None
	prompt = resume_prompt if resuming else full_prompt

	if use_cursor:
		cmd = _cursor_agent_cmd(model=const.CURSOR_LEAD_MODEL)
		if resuming:
			cmd.extend(agent_sessions.cursor_resume_args(sid))
		banner = (
			"👨‍⚖️👨‍⚖️👨‍⚖️  lead agent (cursor opus, resume)"
			if resuming
			else "👨‍⚖️👨‍⚖️👨‍⚖️  lead agent (cursor opus, new session)"
		)
		session_id = run_agent(
			cmd,
			banner,
			prompt,
			format_stream=True,
			resuming=resuming,
			resume_session_id=sid if resuming else None,
		)
	else:
		cmd = [
			"claude",
			"-p",
			"--dangerously-skip-permissions",
			"--model",
			"opus",
			"--output-format",
			"stream-json",
			"--include-partial-messages",
			"--verbose",
		]
		if resuming:
			cmd.extend(agent_sessions.claude_resume_args(sid))
		banner = (
			"👨‍⚖️👨‍⚖️👨‍⚖️  lead agent (resume)"
			if resuming
			else "👨‍⚖️👨‍⚖️👨‍⚖️  lead agent (new session)"
		)
		session_id = run_agent(
			cmd,
			banner,
			prompt,
			prompt_via_stdin=True,
			claude_stream=True,
			resuming=resuming,
			resume_session_id=sid if resuming else None,
		)

	if session_id:
		agent_sessions.set_lead_session(session_id, backend)


def merge_approved_pr(issue: str, pr: str) -> None:
	print("Lead approved — merging PR")
	run_dev_agent(
		full_prompt=prompts.MERGE_PR_PROMPT.format(pr_number=pr, issue_number=issue),
		resume_prompt=prompts.DEV_MERGE_PR_FOLLOWUP.format(
			pr_number=pr, issue_number=issue
		),
	)
	issue_timing.post_resolution(issue, pr)


def fix_pr_after_changes(pr: str) -> None:
	print("Lead requested changes")
	run_dev_agent(
		full_prompt=prompts.FIX_PR_PROMPT.format(pr_number=pr),
		resume_prompt=prompts.DEV_FIX_PR_FOLLOWUP.format(pr_number=pr),
	)


def review_until_merged(
	issue: str, pr: str, *, initial_verdict: str | None = None
) -> None:
	"""Lead review ↔ Dev fix loop. Optional initial_verdict counts as round 1."""
	start_round = 1
	if initial_verdict is not None:
		print(f"Lead review round 1/{const.MAX_REVIEW_ROUNDS} (already completed)")
		if initial_verdict == "APPROVED":
			merge_approved_pr(issue, pr)
			return
		if initial_verdict == "CHANGES":
			fix_pr_after_changes(pr)
			start_round = 2
		else:
			mark_needs_human(
				issue,
				f"lead produced no usable verdict (got '{initial_verdict}') on PR #{pr}",
			)
			return

	for round_num in range(start_round, const.MAX_REVIEW_ROUNDS + 1):
		print(f"Lead review round {round_num}/{const.MAX_REVIEW_ROUNDS}")
		clear_control(const.VERDICT_FILE)
		run_lead_agent(
			full_prompt=prompts.LEAD_REVIEW_PR_PROMPT.format(
				pr_number=pr, issue_number=issue
			),
			resume_prompt=prompts.LEAD_REREVIEW_PR_FOLLOWUP.format(
				pr_number=pr, issue_number=issue
			),
		)
		verdict = read_control(const.VERDICT_FILE)

		if verdict == "APPROVED":
			merge_approved_pr(issue, pr)
			return
		if verdict == "CHANGES":
			fix_pr_after_changes(pr)
			continue

		mark_needs_human(
			issue, f"lead produced no usable verdict (got '{verdict}') on PR #{pr}"
		)
		return

	mark_needs_human(
		issue, f"no approval after {const.MAX_REVIEW_ROUNDS} review rounds on PR #{pr}"
	)


def process_issue(issue: str) -> None:
	agent_sessions.clear_issue_sessions()
	issue_timing.clear()
	clear_control(const.PR_FILE)
	issue_timing.mark_started()
	run_dev_agent(
		full_prompt=prompts.DEV_WORK_ON_ISSUE_PROMPT.format(issue_number=issue)
	)
	pr = read_control(const.PR_FILE)
	if not pr.isdigit():
		mark_needs_human(issue, "dev did not record a PR number")
		return
	review_until_merged(issue, pr)
	agent_sessions.clear_issue_sessions()
	issue_timing.clear()


def process_lead_open_pr_review() -> bool:
	"""Lead picks an open PR and reviews it.

	Returns True if a PR was reviewed (or merge/fix attempted).
	Returns False if the catalog is empty, or Lead recorded no pick.
	"""
	catalog_issues = issues_with_open_prs()
	if not catalog_issues:
		return False

	catalog = format_issues_with_prs(catalog_issues)
	agent_sessions.clear_issue_sessions()
	issue_timing.clear()
	clear_control(const.SOLVE_ISSUE_FILE)
	clear_control(const.PR_FILE)
	clear_control(const.VERDICT_FILE)
	issue_timing.mark_started()
	run_lead_agent(
		full_prompt=prompts.LEAD_CHOOSE_AND_REVIEW_PROMPT.format(
			issues_catalog=catalog
		)
	)

	issue = read_control(const.SOLVE_ISSUE_FILE)
	pr = read_control(const.PR_FILE)
	verdict = read_control(const.VERDICT_FILE)

	if not issue.isdigit() or not pr.isdigit():
		print("Lead did not pick a PR to review")
		issue_timing.clear()
		return False

	print(f"Lead reviewing issue #{issue} / PR #{pr}")
	review_until_merged(issue, pr, initial_verdict=verdict)
	agent_sessions.clear_issue_sessions()
	issue_timing.clear()
	return True


def main() -> None:
	global PAUSE
	parser = argparse.ArgumentParser()
	parser.add_argument("--solve-issue", type=int, metavar="NUMBER", default=None)
	parser.add_argument(
		"--review-open-prs",
		action="store_true",
		help="start with Lead reviewing open PRs that need review",
	)
	parser.add_argument(
		"--once", action="store_true", help="process a single issue, then exit"
	)
	parser.add_argument(
		"--pause", action="store_true", help="wait for Enter before each agent run"
	)
	args = parser.parse_args()
	PAUSE = args.pause

	if args.solve_issue is not None and args.solve_issue <= 0:
		print("Issue number must be a positive integer")
		exit(1)

	claude_usage.print_claude_usage()
	cursor_usage.print_cursor_usage()
	reset_loop_controls()
	ensure_label()
	if args.solve_issue is not None:
		const.SOLVE_ISSUE_FILE.write_text(str(args.solve_issue))

	while True:
		issue = read_control(const.SOLVE_ISSUE_FILE)
		if not issue:
			if args.review_open_prs and issues_with_open_prs():
				print("Lead choosing open PR to review")
				reviewed = process_lead_open_pr_review()
				clear_control(const.SOLVE_ISSUE_FILE)
				clear_control(const.PR_FILE)
				clear_control(const.VERDICT_FILE)
				if reviewed:
					if args.once:
						return
					continue
				if args.once:
					print("Lead found no PR needing review — exiting (--once)")
					return
				print("Lead found no PR needing review — falling back to issue selection")

			if not has_open_issues():
				if args.once:
					print("No open issues — exiting (--once)")
					return
				print(f"No open issues — sleeping {const.IDLE_INTERVAL}s")
				time.sleep(const.IDLE_INTERVAL)
				continue
			print("Choosing issue")
			catalog = format_issues_with_prs(issues_with_open_prs())
			print(catalog)
			run_dev_agent(
				full_prompt=prompts.DEV_CHOOSES_ISSUE_PROMPT.format(
					issues_catalog=catalog
				)
			)
			issue = read_control(const.SOLVE_ISSUE_FILE)
			if not issue:
				print("Dev did not pick an issue — sleeping")
				time.sleep(const.IDLE_INTERVAL)
				continue

		if not issue.isdigit():
			print(f"Ignoring invalid issue number '{issue}'")
			clear_control(const.SOLVE_ISSUE_FILE)
			continue

		print(f"Working on issue {issue}")
		process_issue(issue)
		clear_control(const.SOLVE_ISSUE_FILE)

		if args.once:
			return


if __name__ == "__main__":
	main()
