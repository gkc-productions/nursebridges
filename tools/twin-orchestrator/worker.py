#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import shlex
import socket
import subprocess
import sys
import time
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import requests

VALID_MODES = {"inspect", "patch", "verify", "build-request"}
PENDING_STATUSES = {"pending"}
PAUSE_ENV_VAR = "NURSEBRIDGE_TWIN_EXPERIMENT_ENABLED"
FORBIDDEN_TERMS = (
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
    "dns",
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


@dataclass(frozen=True)
class Config:
    supabase_url: str
    supabase_service_key: str
    repo: Path
    poll_sec: int
    codex_bin: str
    worker_host: str
    worker_version: str
    max_stdout_chars: int
    max_stderr_chars: int
    dry_run: bool


@dataclass
class CommandResult:
    returncode: int
    stdout: str
    stderr: str
    timed_out: bool = False


def utc_now() -> str:
    return datetime.now(UTC).isoformat()


def env_int(name: str, default: int) -> int:
    raw = os.environ.get(name)
    if raw is None or raw.strip() == "":
        return default
    try:
        value = int(raw)
    except ValueError as exc:
        raise SystemExit(f"{name} must be an integer") from exc
    if value < 0:
        raise SystemExit(f"{name} must be nonnegative")
    return value


def validate_supabase_url(value: str) -> str:
    parsed = urlparse(value)
    if parsed.scheme != "https" or not parsed.netloc:
        raise SystemExit("SUPABASE_URL must be an https URL")
    return value.rstrip("/")


def load_config() -> Config:
    supabase_url = os.environ.get("SUPABASE_URL", "").strip()
    supabase_key = os.environ.get("SUPABASE_SERVICE_KEY", "").strip()
    if not supabase_url:
        raise SystemExit("SUPABASE_URL is required")
    if not supabase_key:
        raise SystemExit("SUPABASE_SERVICE_KEY is required")

    return Config(
        supabase_url=validate_supabase_url(supabase_url),
        supabase_service_key=supabase_key,
        repo=Path(os.environ.get("NURSEBRIDGE_REPO", "/home/nurseapp/nursebridge")).expanduser().resolve(),
        poll_sec=env_int("POLL_SEC", 10),
        codex_bin=os.environ.get("CODEX_BIN", "codex").strip() or "codex",
        worker_host=os.environ.get("WORKER_HOST", socket.gethostname()).strip() or socket.gethostname(),
        worker_version=os.environ.get("WORKER_VERSION", "queue-worker-0.1").strip() or "queue-worker-0.1",
        max_stdout_chars=env_int("MAX_STDOUT_CHARS", 30000),
        max_stderr_chars=env_int("MAX_STDERR_CHARS", 12000),
        dry_run=os.environ.get("DRY_RUN") == "1",
    )


class SupabaseQueue:
    def __init__(self, config: Config):
        self.config = config
        self.session = requests.Session()
        self.session.headers.update(
            {
                "apikey": config.supabase_service_key,
                "Authorization": f"Bearer {config.supabase_service_key}",
                "Content-Type": "application/json",
                "Prefer": "return=representation",
            }
        )

    def url(self, table: str) -> str:
        return f"{self.config.supabase_url}/rest/v1/{table}"

    def request(self, method: str, table: str, *, params: dict[str, str] | None = None, data: Any = None) -> Any:
        response = self.session.request(method, self.url(table), params=params, json=data, timeout=30)
        if response.status_code >= 400:
            raise RuntimeError(f"Supabase REST {method} {table} failed with HTTP {response.status_code}: {response.text}")
        if not response.text:
            return None
        return response.json()

    def fetch_pending_tasks(self, limit: int = 20) -> list[dict[str, Any]]:
        rows = self.request(
            "GET",
            "agent_tasks",
            params={
                "status": "eq.pending",
                "order": "created_at.asc",
                "limit": str(limit),
            },
        )
        return rows if isinstance(rows, list) else []

    def claim_next_task(self) -> dict[str, Any] | None:
        for task in self.fetch_pending_tasks():
            if task.get("requires_approval") and not task.get("approved_at"):
                continue
            claimed = self.request(
                "PATCH",
                "agent_tasks",
                params={"id": f"eq.{task['id']}", "status": "eq.pending"},
                data={
                    "status": "in_progress",
                    "claimed_by": self.config.worker_host,
                    "claimed_at": utc_now(),
                },
            )
            if isinstance(claimed, list) and claimed:
                return claimed[0]
        return None

    def update_task(self, task_id: str, patch: dict[str, Any]) -> None:
        self.request("PATCH", "agent_tasks", params={"id": f"eq.{task_id}"}, data=patch)

    def insert_run(self, row: dict[str, Any]) -> None:
        self.request("POST", "agent_runs", data=row)


def truncate(value: str, limit: int) -> str:
    if limit == 0:
        return ""
    if len(value) <= limit:
        return value
    return f"[truncated {len(value) - limit} chars]\n{value[-limit:]}"


def run_cmd(cmd: list[str], repo: Path, *, stdin: str | None = None, timeout: int = 60) -> CommandResult:
    try:
        completed = subprocess.run(
            cmd,
            cwd=str(repo),
            input=stdin,
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False,
        )
        return CommandResult(completed.returncode, completed.stdout or "", completed.stderr or "")
    except subprocess.TimeoutExpired as exc:
        return CommandResult(
            124,
            exc.stdout.decode("utf-8", errors="replace") if isinstance(exc.stdout, bytes) else (exc.stdout or ""),
            exc.stderr.decode("utf-8", errors="replace") if isinstance(exc.stderr, bytes) else (exc.stderr or ""),
            timed_out=True,
        )
    except Exception as exc:
        return CommandResult(1, "", str(exc))


def git_text(repo: Path, args: list[str]) -> str:
    result = run_cmd(["git", *args], repo, timeout=30)
    if result.returncode != 0:
        return ""
    return result.stdout.strip()


def changed_files(repo: Path, head_before: str, head_after: str) -> list[dict[str, str]]:
    if not head_before or not head_after:
        return []
    output = git_text(repo, ["diff", "--name-status", f"{head_before}..{head_after}"])
    files: list[dict[str, str]] = []
    for line in output.splitlines():
        parts = line.split("\t")
        if len(parts) >= 2:
            files.append({"status": parts[0], "path": parts[-1]})
    return files


def diff_stat(repo: Path, head_before: str, head_after: str) -> str:
    if not head_before or not head_after:
        return ""
    return git_text(repo, ["diff", "--stat", f"{head_before}..{head_after}"])


def find_forbidden_hits(prompt: str) -> list[str]:
    lowered = prompt.lower()
    return [term for term in FORBIDDEN_TERMS if term in lowered]


def codex_command(config: Config) -> list[str]:
    return [*shlex.split(config.codex_bin), "exec", "--skip-git-repo-check", "--sandbox", "danger-full-access"]


def worker_summary_for(result: CommandResult) -> str:
    if result.timed_out:
        return "Codex timed out."
    if result.returncode == 0:
        return "Codex completed successfully."
    return "Codex failed."


def insert_guardrail_run(queue: SupabaseQueue, task: dict[str, Any], hits: list[str]) -> None:
    now = utc_now()
    queue.insert_run(
        {
            "task_id": task["id"],
            "worker_host": queue.config.worker_host,
            "worker_version": queue.config.worker_version,
            "command": "",
            "exit_code": None,
            "outcome": "guardrail",
            "worker_summary": "Blocked by VM worker guardrails.",
            "stdout": "",
            "stderr": "",
            "head_before": "",
            "head_after": "",
            "changed_files": [],
            "diff_stat": "",
            "notes": {"forbidden_hits": hits},
            "started_at": now,
            "finished_at": now,
            "elapsed_sec": 0,
        }
    )


def execute_task(queue: SupabaseQueue, task: dict[str, Any]) -> None:
    mode = task.get("mode")
    prompt = str(task.get("prompt") or "")
    hits = find_forbidden_hits(prompt)

    if mode not in VALID_MODES:
        hits = [*hits, f"invalid mode: {mode}"]
    if mode == "build-request" and not task.get("approved_at"):
        hits = [*hits, "build-request requires approved_at"]
    if hits and not task.get("approved_at"):
        queue.update_task(task["id"], {"status": "blocked", "forbidden_hits": hits})
        insert_guardrail_run(queue, task, hits)
        print(f"blocked task {task['id']} title={task.get('title')!r} hits={hits}")
        return

    command = codex_command(queue.config)
    max_runtime_sec = int(task.get("max_runtime_sec") or 900)
    started = time.monotonic()
    started_at = utc_now()
    head_before = git_text(queue.config.repo, ["rev-parse", "HEAD"])
    result = run_cmd(command, queue.config.repo, stdin=prompt, timeout=max_runtime_sec)
    head_after = git_text(queue.config.repo, ["rev-parse", "HEAD"])
    finished_at = utc_now()
    elapsed = round(time.monotonic() - started, 3)

    if result.timed_out:
        outcome = "timeout"
        next_status = "error"
    elif result.returncode == 0:
        outcome = "success"
        next_status = "awaiting_review"
    else:
        outcome = "failed"
        next_status = "error"

    queue.insert_run(
        {
            "task_id": task["id"],
            "worker_host": queue.config.worker_host,
            "worker_version": queue.config.worker_version,
            "command": " ".join(shlex.quote(part) for part in command),
            "exit_code": result.returncode,
            "outcome": outcome,
            "worker_summary": worker_summary_for(result),
            "stdout": truncate(result.stdout, queue.config.max_stdout_chars),
            "stderr": truncate(result.stderr, queue.config.max_stderr_chars),
            "head_before": head_before,
            "head_after": head_after,
            "changed_files": changed_files(queue.config.repo, head_before, head_after),
            "diff_stat": diff_stat(queue.config.repo, head_before, head_after),
            "notes": {"mode": mode, "timed_out": result.timed_out},
            "started_at": started_at,
            "finished_at": finished_at,
            "elapsed_sec": elapsed,
        }
    )
    queue.update_task(task["id"], {"status": next_status})
    print(f"completed task {task['id']} title={task.get('title')!r} outcome={outcome}")


def dry_run(queue: SupabaseQueue) -> int:
    tasks = queue.fetch_pending_tasks()
    print(f"DRY_RUN pending_tasks={len(tasks)}")
    if tasks:
        first = tasks[0]
        print(
            "first_task "
            + json.dumps(
                {
                    "id": first.get("id"),
                    "title": first.get("title"),
                    "mode": first.get("mode"),
                    "status": first.get("status"),
                },
                sort_keys=True,
            )
        )
    return 0


def main() -> int:
    if os.environ.get(PAUSE_ENV_VAR) != "1":
        print(
            "Twin worker is paused for NurseBridge and is not part of the active build workflow. "
            f"Set {PAUSE_ENV_VAR}=1 only after an explicit reactivation decision.",
            file=sys.stderr,
        )
        return 2

    config = load_config()
    if not config.repo.exists():
        raise SystemExit(f"NURSEBRIDGE_REPO does not exist: {config.repo}")

    queue = SupabaseQueue(config)
    print(
        "worker starting "
        + json.dumps(
            {
                "repo": str(config.repo),
                "poll_sec": config.poll_sec,
                "worker_host": config.worker_host,
                "worker_version": config.worker_version,
                "dry_run": config.dry_run,
            },
            sort_keys=True,
        )
    )

    if config.dry_run:
        return dry_run(queue)

    try:
        while True:
            task = queue.claim_next_task()
            if task is None:
                time.sleep(config.poll_sec)
                continue
            print(f"claimed task {task['id']} title={task.get('title')!r} mode={task.get('mode')!r}")
            try:
                execute_task(queue, task)
            except Exception as exc:
                now = utc_now()
                queue.insert_run(
                    {
                        "task_id": task["id"],
                        "worker_host": config.worker_host,
                        "worker_version": config.worker_version,
                        "command": "",
                        "exit_code": None,
                        "outcome": "error",
                        "worker_summary": "Worker error.",
                        "stdout": "",
                        "stderr": str(exc),
                        "head_before": "",
                        "head_after": "",
                        "changed_files": [],
                        "diff_stat": "",
                        "notes": {},
                        "started_at": now,
                        "finished_at": now,
                        "elapsed_sec": 0,
                    }
                )
                queue.update_task(task["id"], {"status": "error"})
                print(f"worker error task {task['id']}: {exc}", file=sys.stderr)
    except KeyboardInterrupt:
        print("worker stopped")
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
