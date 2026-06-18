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
DEFAULT_MAX_TURNS = int(os.environ.get("MAX_TURNS", "1"))
DEFAULT_MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")
DEFAULT_CODEX_CMD = "codex exec --skip-git-repo-check"
DEFAULT_OPENAI_TIMEOUT_SEC = int(os.environ.get("OPENAI_TIMEOUT_SEC", "60"))
DEFAULT_CODEX_TIMEOUT_SEC = int(
    os.environ.get("MAX_CODEX_TIMEOUT_SEC", os.environ.get("CODEX_TIMEOUT_SECONDS", "900"))
)
DEFAULT_MAX_CODEX_OUTPUT_CHARS = int(os.environ.get("MAX_CODEX_OUTPUT_CHARS", "20000"))
MANUAL_PROMPT = Path("prompts/current.md")
PROJECT_STATE = Path("project-state.md")
VALID_WORK_BLOCK_MODES = {"inspect", "patch", "verify", "build-request"}
PAUSE_ENV_VAR = "NURSEBRIDGE_TWIN_EXPERIMENT_ENABLED"

SEED_TASK = (
    "Diagnose why the NurseBridge Android app installs successfully but does not "
    "open / crashes on launch. Inspect Expo / React Native config, recent native "
    "module changes, AndroidManifest.xml, MainApplication / MainActivity, gradle "
    "logs if available, and any postinstall hooks. Produce a written diagnosis "
    "with a concrete next-step fix recommendation. Do NOT modify production code "
    "this turn -- read-only investigation."
)

FORBIDDEN_TERMS = (
    "payment",
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

FORBIDDEN_COMMANDS = (
    "eas build",
    "eas-cli build",
    "npx eas-cli build",
    "expo prebuild",
    "rm -rf",
    "git reset --hard",
    "drop table",
    "truncate",
    "supabase db reset",
    "cloudflare",
    "systemctl",
    "/etc/systemd",
    "/etc/cloudflared",
    ".env",
    "service_role",
    "supabase_db_password",
    "openai_api_key",
    "stripe",
    "payment",
    "payout",
)

APPROVAL_REQUIRED_TERMS = (
    "eas build",
    "environment change",
    "env change",
    "infra change",
    "infrastructure change",
    "cloudflare",
    "systemd",
    "payment",
    "payments",
    "legal",
    "partnership",
    "ui redesign",
    "redesign",
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


def truncate_output(value: str, limit: int = DEFAULT_MAX_CODEX_OUTPUT_CHARS) -> str:
    if len(value) <= limit:
        return value
    omitted = len(value) - limit
    return f"[truncated {omitted} chars; see full stdout/stderr files]\n{value[-limit:]}"


def work_block_mode_from_env() -> str:
    mode = os.environ.get("WORK_BLOCK_MODE", "inspect").strip().lower()
    if mode not in VALID_WORK_BLOCK_MODES:
        raise ValueError(
            "WORK_BLOCK_MODE must be one of "
            + ", ".join(sorted(VALID_WORK_BLOCK_MODES))
            + f"; got {mode!r}"
        )
    return mode


def is_safety_prohibition(line: str) -> bool:
    lowered = line.lower()
    return any(
        phrase in lowered
        for phrase in (
            "do not",
            "don't",
            "must not",
            "never",
            "without manual approval",
            "not run",
            "no eas build",
        )
    )


def matching_forbidden_commands(text: str) -> list[str]:
    matches: list[str] = []
    for line in text.splitlines() or [text]:
        if is_safety_prohibition(line):
            continue
        lowered = line.lower()
        for term in FORBIDDEN_COMMANDS:
            if term in lowered and term not in matches:
                matches.append(term)
    return matches


def matching_approval_required(text: str) -> list[str]:
    matches: list[str] = []
    for line in text.splitlines() or [text]:
        if is_safety_prohibition(line):
            continue
        lowered = line.lower()
        for term in APPROVAL_REQUIRED_TERMS:
            if term in lowered and term not in matches:
                matches.append(term)
    return matches


def mode_instruction(mode: str) -> str:
    if mode == "inspect":
        return (
            "WORK_BLOCK_MODE=inspect. This is read-only. Do not modify files, do not run write commands, "
            "do not run EAS build, and report findings only."
        )
    if mode == "patch":
        return (
            "WORK_BLOCK_MODE=patch. You may modify files only inside the requested scope. "
            "Do not run EAS build, do not touch Cloudflare/systemd/env/secrets, and avoid unrelated changes."
        )
    if mode == "verify":
        return (
            "WORK_BLOCK_MODE=verify. Run checks only. Do not modify files. Do not run EAS build or write commands."
        )
    return (
        "WORK_BLOCK_MODE=build-request. Do not build. Produce a clear recommendation for a human EAS build decision only."
    )


def load_project_state(tool_dir: Path) -> str:
    path = tool_dir / PROJECT_STATE
    if not path.exists():
        return ""
    return path.read_text(encoding="utf-8")


def compose_codex_prompt(prompt: str, *, mode: str, project_state: str) -> str:
    sections = [
        mode_instruction(mode),
        "Project state:",
        project_state.strip() or "(project-state.md not found)",
        "Task:",
        prompt.strip(),
    ]
    return "\n\n".join(sections).strip()


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
        "work_block_mode": work_block_mode_from_env(),
        "codex_cmd": codex_command_from_env(),
        "openai_timeout_sec": DEFAULT_OPENAI_TIMEOUT_SEC,
        "max_codex_timeout_sec": DEFAULT_CODEX_TIMEOUT_SEC,
        "max_codex_output_chars": DEFAULT_MAX_CODEX_OUTPUT_CHARS,
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


def build_strategy_prompt(task: str, history: list[dict[str, Any]], *, mode: str, project_state: str) -> str:
    history_excerpt = json.dumps(history[-4:], indent=2)
    return f"""
You are the strategist for a local autonomous build orchestrator.

Repository: /home/nurseapp/nursebridge
Work block mode: {mode}

Mode rules:
- inspect: choose exactly one read-only inspection action; Codex must not modify files.
- patch: choose exactly one small scoped patch action; Codex must not run EAS build or touch forbidden areas.
- verify: choose exactly one verification action; Codex must not modify files.
- build-request: do not build; only recommend whether a human should run an EAS build.

Project state:
{project_state}

Current task:
{task}

Recent turn history:
{history_excerpt}

Return compact JSON only with these keys:
- status: one of CONTINUE, DONE, BLOCKED
- codex_prompt: the exact prompt to send to Codex CLI next
- rationale: short reason for the next action
- test_failed: boolean, true only if the previous turn's verification failed

Rules:
- Choose only one small next action.
- Obey the current WORK_BLOCK_MODE.
- Never jump from question/context to product direction.
- Treat random user strategy questions as context, not automatic build direction.
- If the next action would require EAS build, env change, infra change, payment/legal/partnership work, or UI redesign, return BLOCKED and explain approval required.
- Respect this constraint: if the task says read-only, the codex_prompt must explicitly forbid file changes.
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
    *,
    mode: str,
    project_state: str,
) -> dict[str, Any]:
    request = {
        "model": model,
        "messages": [
            {
                "role": "system",
                "content": "You plan safe local Codex CLI turns and respond with JSON only.",
            },
            {"role": "user", "content": build_strategy_prompt(task, history, mode=mode, project_state=project_state)},
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
    return run_cmd(cmd, repo_root, stdin=prompt, timeout=DEFAULT_CODEX_TIMEOUT_SEC)


def run_codex_turn(repo_root: Path, turn_dir: Path, prompt: str, *, mode: str, project_state: str) -> CommandResult:
    final_prompt = compose_codex_prompt(prompt, mode=mode, project_state=project_state)
    write_text(turn_dir / "codex_prompt.txt", final_prompt)
    codex_result = run_codex(repo_root, final_prompt)
    write_text(turn_dir / "codex_stdout.txt", codex_result.stdout)
    write_text(turn_dir / "codex_stderr.txt", codex_result.stderr)
    result_json = asdict(codex_result)
    result_json["stdout"] = truncate_output(codex_result.stdout)
    result_json["stderr"] = truncate_output(codex_result.stderr)
    result_json["stdout_truncated"] = len(codex_result.stdout) > DEFAULT_MAX_CODEX_OUTPUT_CHARS
    result_json["stderr_truncated"] = len(codex_result.stderr) > DEFAULT_MAX_CODEX_OUTPUT_CHARS
    write_json(turn_dir / "codex_result.json", result_json)
    return codex_result


def run_manual_mode(
    repo_root: Path,
    tool_dir: Path,
    logs_dir: Path,
    session: dict[str, Any],
    *,
    mode: str,
    project_state: str,
) -> int:
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
    blocked_commands = matching_forbidden_commands(prompt)
    if blocked_commands:
        write_json(
            turn_dir / "forbidden-command-block.json",
            {"matched_terms": blocked_commands, "prompt_path": str(prompt_path)},
        )
        session["turns"].append(
            {"turn": 1, "mode": "manual", "status": "BLOCKED_FORBIDDEN_COMMAND", "matched_terms": blocked_commands}
        )
        print("BLOCKED_FORBIDDEN_COMMAND", file=sys.stderr)
        return finalize_session(
            session,
            logs_dir,
            status="BLOCKED_FORBIDDEN_COMMAND",
            stop_reason="manual prompt contains forbidden command",
            exit_code=9,
        )

    decision = {
        "status": "CONTINUE",
        "codex_prompt": prompt,
        "rationale": "MANUAL_MODE=1 skips OpenAI and runs the current prompt once.",
        "test_failed": False,
    }
    write_json(turn_dir / "strategist_decision.json", decision)

    codex_result = run_codex_turn(repo_root, turn_dir, prompt, mode=mode, project_state=project_state)
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
    if os.environ.get(PAUSE_ENV_VAR) != "1":
        print(
            "Twin orchestrator is paused for NurseBridge and is not part of the active build workflow. "
            f"Set {PAUSE_ENV_VAR}=1 only after an explicit reactivation decision.",
            file=sys.stderr,
        )
        return 2

    args = parse_args()
    repo_root = Path(args.repo_root).expanduser().resolve()
    tool_dir = Path(args.tool_dir)
    if not tool_dir.is_absolute():
        tool_dir = repo_root / tool_dir

    try:
        work_block_mode = work_block_mode_from_env()
    except ValueError as exc:
        print(str(exc), file=sys.stderr)
        return 10

    manual_mode = os.environ.get("MANUAL_MODE") == "1"
    logs_root = tool_dir / "logs"
    logs_root.mkdir(parents=True, exist_ok=True)
    run_id = datetime.now(UTC).strftime("%Y%m%d-%H%M%S")
    logs_dir = logs_root / run_id
    logs_dir.mkdir(parents=True, exist_ok=True)
    session = new_session(repo_root=repo_root, tool_dir=tool_dir, logs_dir=logs_dir, args=args, manual_mode=manual_mode)
    session["checkpoint"] = create_checkpoint(repo_root, logs_dir)
    project_state = load_project_state(tool_dir)

    task_forbidden_commands = matching_forbidden_commands(args.task)
    if task_forbidden_commands:
        write_json(logs_dir / "forbidden-command-block.json", {"matched_terms": task_forbidden_commands, "task": args.task})
        session["forbidden_command_matches"] = task_forbidden_commands
        print("BLOCKED_FORBIDDEN_COMMAND", file=sys.stderr)
        return finalize_session(
            session,
            logs_dir,
            status="BLOCKED_FORBIDDEN_COMMAND",
            stop_reason="task contains forbidden command",
            exit_code=9,
        )

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
        return run_manual_mode(
            repo_root,
            tool_dir,
            logs_dir,
            session,
            mode=work_block_mode,
            project_state=project_state,
        )

    from openai import APITimeoutError, OpenAI

    client = OpenAI(timeout=DEFAULT_OPENAI_TIMEOUT_SEC)
    history: list[dict[str, Any]] = []
    consecutive_test_failures = 0

    for turn in range(1, args.max_turns + 1):
        turn_dir = logs_dir / f"turn-{turn:02d}"
        turn_dir.mkdir(parents=True, exist_ok=True)
        strategist_raw_path = turn_dir / "strategist_raw.txt"

        try:
            strategy = call_strategist(
                client,
                args.model,
                args.task,
                history,
                strategist_raw_path,
                mode=work_block_mode,
                project_state=project_state,
            )
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

        approval_terms = matching_approval_required(
            "\n".join([strategy.get("codex_prompt", ""), strategy.get("rationale", "")])
        )
        if approval_terms:
            write_json(turn_dir / "approval-required.json", {"matched_terms": approval_terms, "strategy": strategy})
            session["turns"].append(
                {"turn": turn, "status": "APPROVAL_REQUIRED", "matched_terms": approval_terms, "turn_dir": str(turn_dir)}
            )
            print("APPROVAL_REQUIRED", file=sys.stderr)
            return finalize_session(
                session,
                logs_dir,
                status="APPROVAL_REQUIRED",
                stop_reason="strategist recommended approval-required work",
                exit_code=11,
            )

        if strategy["status"] == "DONE":
            print("DONE")
            session["turns"].append({"turn": turn, "status": "DONE", "turn_dir": str(turn_dir)})
            return finalize_session(session, logs_dir, status="DONE", stop_reason="strategist returned DONE", exit_code=0)
        if strategy["status"] == "BLOCKED":
            print("BLOCKED")
            session["turns"].append({"turn": turn, "status": "BLOCKED", "turn_dir": str(turn_dir)})
            return finalize_session(session, logs_dir, status="BLOCKED", stop_reason="strategist returned BLOCKED", exit_code=5)

        codex_forbidden_commands = matching_forbidden_commands(strategy["codex_prompt"])
        if codex_forbidden_commands:
            write_json(
                turn_dir / "forbidden-command-block.json",
                {"matched_terms": codex_forbidden_commands, "strategy": strategy},
            )
            session["turns"].append(
                {
                    "turn": turn,
                    "status": "BLOCKED_FORBIDDEN_COMMAND",
                    "matched_terms": codex_forbidden_commands,
                    "turn_dir": str(turn_dir),
                }
            )
            print("BLOCKED_FORBIDDEN_COMMAND", file=sys.stderr)
            return finalize_session(
                session,
                logs_dir,
                status="BLOCKED_FORBIDDEN_COMMAND",
                stop_reason="codex prompt contains forbidden command",
                exit_code=9,
            )

        codex_result = run_codex_turn(
            repo_root,
            turn_dir,
            strategy["codex_prompt"],
            mode=work_block_mode,
            project_state=project_state,
        )

        test_failed = bool(strategy["test_failed"]) or codex_result.returncode != 0
        consecutive_test_failures = consecutive_test_failures + 1 if test_failed else 0
        turn_record = {
            "turn": turn,
            "strategy": strategy,
            "codex_returncode": codex_result.returncode,
            "codex_stdout_tail": truncate_output(codex_result.stdout),
            "codex_stderr_tail": truncate_output(codex_result.stderr),
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
