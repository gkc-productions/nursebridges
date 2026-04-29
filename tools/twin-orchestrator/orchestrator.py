#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import shlex
import subprocess
import sys
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from openai import OpenAI


DEFAULT_REPO_ROOT = Path("/home/nurseapp/nursebridge")
DEFAULT_TOOL_DIR = Path("tools/twin-orchestrator")
DEFAULT_MAX_TURNS = 3
DEFAULT_MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")
DEFAULT_CODEX_CMD = "codex exec --skip-git-repo-check"

SEED_TASK = (
    "Diagnose why the NurseBridge Android app installs successfully but does not "
    "open / crashes on launch. Inspect Expo / React Native config, recent native "
    "module changes, AndroidManifest.xml, MainApplication / MainActivity, gradle "
    "logs if available, and any postinstall hooks. Produce a written diagnosis "
    "with a concrete next-step fix recommendation. Do NOT modify production code "
    "this turn -- read-only investigation."
)

FORBIDDEN_TERMS = (
    "payments",
    "Stripe",
    "payouts",
    "banking",
    "billing integration",
    "legal claim",
    "compliance claim",
    "HIPAA",
    "Cloudflare",
    "DNS",
    "systemd",
    ".env",
    "env file",
    "secrets",
    "Supabase password",
    "secret rotation",
    "drop table",
    "database reset",
    "truncate",
    "major UI redesign",
    "full UI redesign",
    "hospital partnership",
    "government partnership",
)


@dataclass
class CommandResult:
    cmd: list[str]
    cwd: str
    returncode: int
    stdout: str
    stderr: str
    timed_out: bool = False


def decode_output(value: bytes | str | None) -> str:
    if value is None:
        return ""
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="replace")
    return value


def run_cmd(
    cmd: list[str],
    cwd: Path,
    *,
    stdin: str | None = None,
    timeout: int = 900,
) -> CommandResult:
    try:
        completed = subprocess.run(
            cmd,
            cwd=str(cwd),
            input=stdin,
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False,
        )
        return CommandResult(
            cmd=cmd,
            cwd=str(cwd),
            returncode=completed.returncode,
            stdout=decode_output(completed.stdout),
            stderr=decode_output(completed.stderr),
            timed_out=False,
        )
    except subprocess.TimeoutExpired as exc:
        return CommandResult(
            cmd=cmd,
            cwd=str(cwd),
            returncode=124,
            stdout=decode_output(exc.stdout),
            stderr=decode_output(exc.stderr),
            timed_out=True,
        )


def git_head(repo_root: Path) -> str:
    result = run_cmd(["git", "rev-parse", "HEAD"], repo_root, timeout=30)
    if result.returncode != 0:
        return ""
    return result.stdout.strip()


def git_diff_since(repo_root: Path, base_ref: str) -> str:
    if not base_ref:
        return ""
    result = run_cmd(["git", "diff", "--stat", base_ref, "HEAD"], repo_root, timeout=60)
    if result.returncode != 0:
        return result.stderr.strip()
    return result.stdout.strip()


def write_json(path: Path, data: Any) -> None:
    path.write_text(json.dumps(data, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def append_text(path: Path, text: str) -> None:
    with path.open("a", encoding="utf-8") as handle:
        handle.write(text)
        if not text.endswith("\n"):
            handle.write("\n")


def create_checkpoint(repo_root: Path, logs_dir: Path) -> None:
    status = run_cmd(["git", "status", "--short"], repo_root, timeout=60)
    write_json(logs_dir / "checkpoint-status.json", asdict(status))

    add_result = run_cmd(["git", "add", "."], repo_root, timeout=300)
    write_json(logs_dir / "checkpoint-add.json", asdict(add_result))

    commit_result = run_cmd(
        ["git", "commit", "-m", "checkpoint before autonomous orchestrator session"],
        repo_root,
        timeout=300,
    )
    write_json(logs_dir / "checkpoint-commit.json", asdict(commit_result))


def matching_guardrails(task: str) -> list[str]:
    lowered = task.lower()
    return [term for term in FORBIDDEN_TERMS if term.lower() in lowered]


def require_guardrail_approval(task: str, approved: bool) -> list[str]:
    matches = matching_guardrails(task)
    if matches and not approved:
        return matches
    return []


def codex_command_from_env() -> list[str]:
    return shlex.split(os.environ.get("CODEX_CMD", DEFAULT_CODEX_CMD))


def build_strategy_prompt(task: str, history: list[dict[str, Any]]) -> str:
    history_excerpt = json.dumps(history[-4:], indent=2)
    return f"""
You are the strategist for a local autonomous build orchestrator.

Repository: /home/nurseapp/nursebridge
Current task:
{task}

Recent turn history:
{history_excerpt}

Return compact JSON only with these keys:
- status: one of CONTINUE, DONE, BLOCKED
- codex_prompt: the exact prompt to send to Codex CLI next
- rationale: short reason for the next action
- test_failed: boolean, true only if the previous turn's verification failed

Respect this constraint: if the task says read-only, the codex_prompt must explicitly forbid file changes.
""".strip()


def parse_strategy(raw: str) -> dict[str, Any]:
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValueError(f"strategist returned invalid JSON: {exc}") from exc

    status = data.get("status")
    if status not in {"CONTINUE", "DONE", "BLOCKED"}:
        raise ValueError("strategist status must be CONTINUE, DONE, or BLOCKED")
    if not isinstance(data.get("codex_prompt"), str):
        raise ValueError("strategist codex_prompt must be a string")
    if not isinstance(data.get("rationale"), str):
        data["rationale"] = ""
    if not isinstance(data.get("test_failed"), bool):
        data["test_failed"] = False
    return data


def call_strategist(client: OpenAI, model: str, task: str, history: list[dict[str, Any]]) -> dict[str, Any]:
    response = client.chat.completions.create(
        model=model,
        messages=[
            {
                "role": "system",
                "content": "You plan safe local Codex CLI turns and respond with JSON only.",
            },
            {"role": "user", "content": build_strategy_prompt(task, history)},
        ],
        temperature=0.2,
    )
    content = response.choices[0].message.content or ""
    return parse_strategy(content)


def run_codex(repo_root: Path, prompt: str) -> CommandResult:
    cmd = codex_command_from_env()
    return run_cmd(cmd, repo_root, stdin=prompt, timeout=int(os.environ.get("CODEX_TIMEOUT_SECONDS", "1800")))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Local NurseBridge Twin Orchestrator")
    parser.add_argument("--repo-root", default=str(DEFAULT_REPO_ROOT))
    parser.add_argument("--tool-dir", default=str(DEFAULT_TOOL_DIR))
    parser.add_argument("--max-turns", type=int, default=DEFAULT_MAX_TURNS)
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--task", default=SEED_TASK)
    parser.add_argument(
        "--approve-guardrails",
        action="store_true",
        help="Manually approve a task that matches guarded terms.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    repo_root = Path(args.repo_root).expanduser().resolve()
    tool_dir = Path(args.tool_dir)
    if not tool_dir.is_absolute():
        tool_dir = repo_root / tool_dir

    logs_root = tool_dir / "logs"
    logs_root.mkdir(parents=True, exist_ok=True)
    run_id = datetime.now(UTC).strftime("%Y%m%d-%H%M%S")
    logs_dir = logs_root / run_id
    logs_dir.mkdir(parents=True, exist_ok=True)

    if not os.environ.get("OPENAI_API_KEY"):
        print("OPENAI_API_KEY is not set; refusing to start orchestrator.", file=sys.stderr)
        return 2

    blocked_terms = require_guardrail_approval(args.task, args.approve_guardrails)
    if blocked_terms:
        write_json(logs_dir / "guardrail-block.json", {"matched_terms": blocked_terms, "task": args.task})
        print(
            "Task requires manual approval before running. Matched guardrails: "
            + ", ".join(blocked_terms),
            file=sys.stderr,
        )
        return 3

    create_checkpoint(repo_root, logs_dir)
    base_head = git_head(repo_root)
    client = OpenAI()
    history: list[dict[str, Any]] = []
    consecutive_test_failures = 0

    for turn in range(1, args.max_turns + 1):
        turn_dir = logs_dir / f"turn-{turn:02d}"
        turn_dir.mkdir(parents=True, exist_ok=True)

        try:
            strategy = call_strategist(client, args.model, args.task, history)
        except Exception as exc:
            write_json(turn_dir / "strategist-error.json", {"error": str(exc)})
            print(f"Strategist error: {exc}", file=sys.stderr)
            return 4

        write_json(turn_dir / "strategy.json", strategy)
        append_text(turn_dir / "codex-prompt.txt", strategy["codex_prompt"])

        if strategy["status"] == "DONE":
            print("DONE")
            return 0
        if strategy["status"] == "BLOCKED":
            print("BLOCKED")
            return 5

        codex_result = run_codex(repo_root, strategy["codex_prompt"])
        write_json(turn_dir / "codex-result.json", asdict(codex_result))

        test_failed = bool(strategy["test_failed"]) or codex_result.returncode != 0
        consecutive_test_failures = consecutive_test_failures + 1 if test_failed else 0
        history.append(
            {
                "turn": turn,
                "strategy": strategy,
                "codex_returncode": codex_result.returncode,
                "codex_stdout_tail": codex_result.stdout[-4000:],
                "codex_stderr_tail": codex_result.stderr[-4000:],
                "git_diff_stat": git_diff_since(repo_root, base_head),
            }
        )
        write_json(logs_dir / "state.json", {"history": history})

        if consecutive_test_failures >= 2:
            print("Stopping after two consecutive test failures.", file=sys.stderr)
            return 6

    print("Max turns reached.", file=sys.stderr)
    return 7


if __name__ == "__main__":
    raise SystemExit(main())
