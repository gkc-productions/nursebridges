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

DEFAULT_REPO_ROOT = Path("/home/nurseapp/nursebridge")
DEFAULT_TOOL_DIR = Path("tools/twin-orchestrator")
DEFAULT_MAX_TURNS = int(os.environ.get("MAX_TURNS", "3"))
DEFAULT_MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")
DEFAULT_CODEX_CMD = "codex exec --skip-git-repo-check"
DEFAULT_OPENAI_TIMEOUT_SEC = int(os.environ.get("OPENAI_TIMEOUT_SEC", "60"))
MANUAL_PROMPT = Path("prompts/current.md")

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


def write_text(path: Path, text: str) -> None:
    path.write_text(text if text.endswith("\n") else text + "\n", encoding="utf-8")


def create_checkpoint(repo_root: Path, logs_dir: Path) -> dict[str, Any]:
    head = git_head(repo_root)
    status = run_cmd(["git", "status", "--short"], repo_root, timeout=60)
    diff_stat = run_cmd(["git", "diff", "--stat"], repo_root, timeout=60)
    checkpoint = {
        "git_head": head,
        "git_status_short": status.stdout,
        "git_diff_stat": diff_stat.stdout,
        "status_command": asdict(status),
        "diff_stat_command": asdict(diff_stat),
        "mutates_git": False,
    }
    write_json(logs_dir / "checkpoint.json", checkpoint)
    return checkpoint


def new_session(
    *,
    repo_root: Path,
    tool_dir: Path,
    logs_dir: Path,
    args: argparse.Namespace,
    manual_mode: bool,
) -> dict[str, Any]:
    return {
        "run_id": logs_dir.name,
        "repo_root": str(repo_root),
        "tool_dir": str(tool_dir),
        "logs_dir": str(logs_dir),
        "started_at": datetime.now(UTC).isoformat(),
        "finished_at": None,
        "status": "RUNNING",
        "stop_reason": None,
        "exit_code": None,
        "manual_mode": manual_mode,
        "model": None if manual_mode else args.model,
        "max_turns": args.max_turns,
        "codex_cmd": codex_command_from_env(),
        "openai_timeout_sec": DEFAULT_OPENAI_TIMEOUT_SEC,
        "task": args.task,
        "checkpoint": None,
        "turns": [],
    }


def finalize_session(
    session: dict[str, Any],
    logs_dir: Path,
    *,
    status: str,
    stop_reason: str,
    exit_code: int,
) -> int:
    session["finished_at"] = datetime.now(UTC).isoformat()
    session["status"] = status
    session["stop_reason"] = stop_reason
    session["exit_code"] = exit_code
    write_json(logs_dir / "session.json", session)
    return exit_code


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


def strip_markdown_fences(raw: str) -> str:
    stripped = raw.strip()
    if not stripped.startswith("```"):
        return stripped

    lines = stripped.splitlines()
    if lines and lines[0].lstrip().startswith("```"):
        lines = lines[1:]
    if lines and lines[-1].strip() == "```":
        lines = lines[:-1]
    return "\n".join(lines).strip()


def extract_first_json_object(raw: str) -> str | None:
    in_string = False
    escaped = False
    depth = 0
    start: int | None = None

    for index, char in enumerate(raw):
        if escaped:
            escaped = False
            continue
        if char == "\\" and in_string:
            escaped = True
            continue
        if char == '"':
            in_string = not in_string
            continue
        if in_string:
            continue
        if char == "{":
            if depth == 0:
                start = index
            depth += 1
            continue
        if char == "}" and depth:
            depth -= 1
            if depth == 0 and start is not None:
                return raw[start : index + 1]
    return None


def parse_strategy(raw: str, raw_path: Path | None = None) -> dict[str, Any]:
    candidates = [raw, strip_markdown_fences(raw)]
    extracted = extract_first_json_object(candidates[-1])
    if extracted:
        candidates.append(extracted)

    last_error: json.JSONDecodeError | None = None
    data: Any = None
    for candidate in candidates:
        try:
            data = json.loads(candidate)
            break
        except json.JSONDecodeError as exc:
            last_error = exc
    else:
        raw_hint = f"; raw response logged at {raw_path}" if raw_path else ""
        raise ValueError(f"strategist returned invalid JSON: {last_error}{raw_hint}") from last_error

    if not isinstance(data, dict):
        raw_hint = f"; raw response logged at {raw_path}" if raw_path else ""
        raise ValueError(f"strategist JSON must be an object{raw_hint}")

    raw_hint = f"; raw response logged at {raw_path}" if raw_path else ""
    status = data.get("status")
    if status not in {"CONTINUE", "DONE", "BLOCKED"}:
        raise ValueError(f"strategist status must be CONTINUE, DONE, or BLOCKED{raw_hint}")
    if not isinstance(data.get("codex_prompt"), str):
        raise ValueError(f"strategist codex_prompt must be a string{raw_hint}")
    if not isinstance(data.get("rationale"), str):
        data["rationale"] = ""
    if not isinstance(data.get("test_failed"), bool):
        data["test_failed"] = False
    return data


def call_strategist(
    client: Any,
    model: str,
    task: str,
    history: list[dict[str, Any]],
    raw_path: Path,
) -> dict[str, Any]:
    request = {
        "model": model,
        "messages": [
            {
                "role": "system",
                "content": "You plan safe local Codex CLI turns and respond with JSON only.",
            },
            {"role": "user", "content": build_strategy_prompt(task, history)},
        ],
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
    }
    try:
        response = client.chat.completions.create(**request)
    except Exception as exc:
        if "response_format" not in str(exc):
            raise
        request.pop("response_format")
        response = client.chat.completions.create(**request)
    content = response.choices[0].message.content or ""
    raw_path.write_text(content, encoding="utf-8")
    return parse_strategy(content, raw_path)


def run_codex(repo_root: Path, prompt: str) -> CommandResult:
    cmd = codex_command_from_env()
    return run_cmd(cmd, repo_root, stdin=prompt, timeout=int(os.environ.get("CODEX_TIMEOUT_SECONDS", "1800")))


def run_codex_turn(repo_root: Path, turn_dir: Path, prompt: str) -> CommandResult:
    write_text(turn_dir / "codex_prompt.txt", prompt)
    codex_result = run_codex(repo_root, prompt)
    write_text(turn_dir / "codex_stdout.txt", codex_result.stdout)
    write_text(turn_dir / "codex_stderr.txt", codex_result.stderr)
    write_json(turn_dir / "codex_result.json", asdict(codex_result))
    return codex_result


def run_manual_mode(repo_root: Path, tool_dir: Path, logs_dir: Path, session: dict[str, Any]) -> int:
    turn_dir = logs_dir / "turn-01"
    turn_dir.mkdir(parents=True, exist_ok=True)
    prompt_path = tool_dir / MANUAL_PROMPT

    write_text(turn_dir / "strategist_raw.txt", f"MANUAL_MODE=1 prompt_path={prompt_path}")
    if not prompt_path.exists():
        error = f"manual prompt file not found: {prompt_path}"
        write_json(turn_dir / "strategist-error.json", {"error": error, "prompt_path": str(prompt_path)})
        print(error, file=sys.stderr)
        session["turns"].append({"turn": 1, "mode": "manual", "status": "ERROR", "error": error})
        return finalize_session(session, logs_dir, status="ERROR", stop_reason="manual prompt missing", exit_code=8)

    prompt = prompt_path.read_text(encoding="utf-8")
    decision = {
        "status": "CONTINUE",
        "codex_prompt": prompt,
        "rationale": "MANUAL_MODE=1 skips OpenAI and runs the current prompt once.",
        "test_failed": False,
    }
    write_json(turn_dir / "strategist_decision.json", decision)

    codex_result = run_codex_turn(repo_root, turn_dir, prompt)
    turn_record = {
        "turn": 1,
        "mode": "manual",
        "status": "DONE" if codex_result.returncode == 0 else "BLOCKED",
        "codex_returncode": codex_result.returncode,
        "turn_dir": str(turn_dir),
    }
    session["turns"].append(turn_record)

    if codex_result.returncode != 0:
        return finalize_session(session, logs_dir, status="BLOCKED", stop_reason="codex failed", exit_code=8)
    print("DONE")
    return finalize_session(session, logs_dir, status="DONE", stop_reason="manual mode completed", exit_code=0)


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

    manual_mode = os.environ.get("MANUAL_MODE") == "1"
    logs_root = tool_dir / "logs"
    logs_root.mkdir(parents=True, exist_ok=True)
    run_id = datetime.now(UTC).strftime("%Y%m%d-%H%M%S")
    logs_dir = logs_root / run_id
    logs_dir.mkdir(parents=True, exist_ok=True)
    session = new_session(repo_root=repo_root, tool_dir=tool_dir, logs_dir=logs_dir, args=args, manual_mode=manual_mode)
    session["checkpoint"] = create_checkpoint(repo_root, logs_dir)

    if not manual_mode and not os.environ.get("OPENAI_API_KEY"):
        print("OPENAI_API_KEY is not set; refusing to start orchestrator.", file=sys.stderr)
        return finalize_session(session, logs_dir, status="ERROR", stop_reason="OPENAI_API_KEY missing", exit_code=2)

    blocked_terms = require_guardrail_approval(args.task, args.approve_guardrails)
    if blocked_terms:
        write_json(logs_dir / "guardrail-block.json", {"matched_terms": blocked_terms, "task": args.task})
        print(
            "Task requires manual approval before running. Matched guardrails: "
            + ", ".join(blocked_terms),
            file=sys.stderr,
        )
        session["guardrail_matches"] = blocked_terms
        return finalize_session(session, logs_dir, status="BLOCKED", stop_reason="forbidden task not approved", exit_code=3)

    base_head = git_head(repo_root)
    if manual_mode:
        return run_manual_mode(repo_root, tool_dir, logs_dir, session)

    from openai import APITimeoutError, OpenAI

    client = OpenAI(timeout=DEFAULT_OPENAI_TIMEOUT_SEC)
    history: list[dict[str, Any]] = []
    consecutive_test_failures = 0

    for turn in range(1, args.max_turns + 1):
        turn_dir = logs_dir / f"turn-{turn:02d}"
        turn_dir.mkdir(parents=True, exist_ok=True)
        strategist_raw_path = turn_dir / "strategist_raw.txt"

        try:
            strategy = call_strategist(client, args.model, args.task, history, strategist_raw_path)
        except APITimeoutError as exc:
            error = f"strategist timed out after {DEFAULT_OPENAI_TIMEOUT_SEC} seconds"
            write_json(
                turn_dir / "strategist-error.json",
                {"error": error, "detail": str(exc), "raw_response_path": str(strategist_raw_path)},
            )
            print(f"Strategist error: {error}", file=sys.stderr)
            session["turns"].append({"turn": turn, "status": "ERROR", "error": error, "turn_dir": str(turn_dir)})
            return finalize_session(session, logs_dir, status="ERROR", stop_reason="strategist timeout", exit_code=4)
        except Exception as exc:
            write_json(
                turn_dir / "strategist-error.json",
                {"error": str(exc), "raw_response_path": str(strategist_raw_path)},
            )
            print(f"Strategist error: {exc}", file=sys.stderr)
            session["turns"].append({"turn": turn, "status": "ERROR", "error": str(exc), "turn_dir": str(turn_dir)})
            return finalize_session(session, logs_dir, status="ERROR", stop_reason="strategist error", exit_code=4)

        write_json(turn_dir / "strategist_decision.json", strategy)

        if strategy["status"] == "DONE":
            print("DONE")
            session["turns"].append({"turn": turn, "status": "DONE", "turn_dir": str(turn_dir)})
            return finalize_session(session, logs_dir, status="DONE", stop_reason="strategist returned DONE", exit_code=0)
        if strategy["status"] == "BLOCKED":
            print("BLOCKED")
            session["turns"].append({"turn": turn, "status": "BLOCKED", "turn_dir": str(turn_dir)})
            return finalize_session(session, logs_dir, status="BLOCKED", stop_reason="strategist returned BLOCKED", exit_code=5)

        codex_result = run_codex_turn(repo_root, turn_dir, strategy["codex_prompt"])

        test_failed = bool(strategy["test_failed"]) or codex_result.returncode != 0
        consecutive_test_failures = consecutive_test_failures + 1 if test_failed else 0
        turn_record = {
            "turn": turn,
            "strategy": strategy,
            "codex_returncode": codex_result.returncode,
            "codex_stdout_tail": codex_result.stdout[-4000:],
            "codex_stderr_tail": codex_result.stderr[-4000:],
            "git_diff_stat": git_diff_since(repo_root, base_head),
            "turn_dir": str(turn_dir),
        }
        history.append(turn_record)
        session["turns"].append(turn_record)
        write_json(logs_dir / "state.json", {"history": history})
        write_json(logs_dir / "session.json", session)

        if consecutive_test_failures >= 2:
            print("Stopping after two consecutive test failures.", file=sys.stderr)
            return finalize_session(session, logs_dir, status="BLOCKED", stop_reason="two consecutive test failures", exit_code=6)

    print("Max turns reached.", file=sys.stderr)
    return finalize_session(session, logs_dir, status="MAX_TURNS", stop_reason="max turns reached", exit_code=7)


if __name__ == "__main__":
    raise SystemExit(main())
