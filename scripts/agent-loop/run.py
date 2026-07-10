import argparse
import shutil
import subprocess
import time
from pathlib import Path

import const as const
import prompt_strings as prompts

PAUSE = False


def gh(*args: str) -> subprocess.CompletedProcess:
	return subprocess.run(
		["gh", *args], capture_output=True, text=True, cwd=const.REPO_ROOT
	)


def has_open_issues() -> bool:
	result = gh(
		"issue",
		"list",
		"--search",
		f"is:open -label:{const.NEEDS_HUMAN_LABEL}",
		"--limit",
		"1",
		"--json",
		"number",
		"-q",
		"length",
	)
	if result.returncode != 0:
		print(f"gh issue list failed: {result.stderr.strip()}")
		return False
	return result.stdout.strip() != "0"


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
	cmd: list[str], banner: str, str_prompt: str, *, prompt_via_stdin: bool = False
) -> bool:
	if PAUSE:
		input(f"[pause] press Enter to run {banner}... ")
	print("")
	print("--------------------------------")
	print(f"{banner}  prompt:")
	print(str_prompt)
	print("--------------------------------")
	print("")
	try:
		subprocess.run(
			cmd if prompt_via_stdin else [*cmd, str_prompt],
			input=str_prompt if prompt_via_stdin else None,
			cwd=const.REPO_ROOT,
			check=True,
			timeout=const.AGENT_TIMEOUT,
			text=True,
		)
		return True
	except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as exc:
		print(f"{banner} failed: {exc}")
		return False


def run_dev_agent(str_prompt: str) -> bool:
	cmd = [
		"cursor-agent",
		"-p",
		"--yolo",
		"--workspace",
		str(const.REPO_ROOT),
		"--model",
		"auto",
	]
	return run_agent(cmd, "🖥️🖥️🖥️  dev agent", str_prompt)


def run_lead_agent(str_prompt: str) -> bool:
	cmd = [
		"claude",
		"-p",
		"--dangerously-skip-permissions",
		"--model",
		"opus"
	]
	return run_agent(
		cmd, "👨‍⚖️👨‍⚖️👨‍⚖️  lead agent", str_prompt, prompt_via_stdin=True
	)


def process_issue(issue: str) -> None:
	clear_control(const.PR_FILE)
	ok = run_dev_agent(prompts.DEV_WORK_ON_ISSUE_PROMPT.format(issue_number=issue))
	pr = read_control(const.PR_FILE)
	if not ok or not pr.isdigit():
		mark_needs_human(issue, "dev run failed or did not record a PR number")
		return

	for round_num in range(1, const.MAX_REVIEW_ROUNDS + 1):
		print(f"Lead review round {round_num}/{const.MAX_REVIEW_ROUNDS}")
		clear_control(const.VERDICT_FILE)
		run_lead_agent(
			prompts.LEAD_REVIEW_PR_PROMPT.format(pr_number=pr, issue_number=issue)
		)
		verdict = read_control(const.VERDICT_FILE)

		if verdict == "APPROVED":
			print("Lead approved — merging PR")
			run_dev_agent(
				prompts.MERGE_PR_PROMPT.format(pr_number=pr, issue_number=issue)
			)
			return
		if verdict == "CHANGES":
			print("Lead requested changes")
			run_dev_agent(prompts.FIX_PR_PROMPT.format(pr_number=pr))
			continue

		mark_needs_human(issue, f"lead produced no usable verdict (got '{verdict}') on PR #{pr}")
		return

	mark_needs_human(
		issue, f"no approval after {const.MAX_REVIEW_ROUNDS} review rounds on PR #{pr}"
	)


def main() -> None:
	global PAUSE
	parser = argparse.ArgumentParser()
	parser.add_argument("--solve-issue", type=int, metavar="NUMBER", default=None)
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

	reset_loop_controls()
	ensure_label()
	if args.solve_issue is not None:
		const.SOLVE_ISSUE_FILE.write_text(str(args.solve_issue))

	while True:
		issue = read_control(const.SOLVE_ISSUE_FILE)
		if not issue:
			if not has_open_issues():
				if args.once:
					print("No open issues — exiting (--once)")
					return
				print(f"No open issues — sleeping {const.IDLE_INTERVAL}s")
				time.sleep(const.IDLE_INTERVAL)
				continue
			print("Choosing issue")
			run_dev_agent(prompts.DEV_CHOOSES_ISSUE_PROMPT)
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
