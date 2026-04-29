# NurseBridge Twin Orchestrator

Local autonomous build orchestrator for the NurseBridge repository.

## Install

```bash
cd /home/nurseapp/nursebridge/tools/twin-orchestrator
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
```

## Environment Variables

- `OPENAI_API_KEY`: required. The orchestrator exits before doing work if this is missing.
- `OPENAI_MODEL`: optional. Defaults to `gpt-4o-mini`.
- `CODEX_CMD`: optional. Defaults to `codex exec --skip-git-repo-check`.
- `CODEX_TIMEOUT_SECONDS`: optional. Defaults to `1800`.

Secrets are never printed by the orchestrator.

## Run

```bash
cd /home/nurseapp/nursebridge/tools/twin-orchestrator
. .venv/bin/activate
python3 orchestrator.py
```

Defaults:

- Repo root: `/home/nurseapp/nursebridge`
- Tool directory: `tools/twin-orchestrator`
- Max turns: `3`
- Seed task: Android app startup crash diagnosis, read-only investigation

Before the first autonomous turn, the orchestrator records a git checkpoint:

```bash
git status --short
git add .
git commit -m "checkpoint before autonomous orchestrator session" || true
```

## Logs

Each run writes logs under:

```text
tools/twin-orchestrator/logs/YYYYMMDD-HHMMSS/
```

Per-turn logs include the strategist JSON, the exact Codex prompt, Codex stdout/stderr, return code, and state history.

## Guardrails

The orchestrator requires manual approval with `--approve-guardrails` if the task contains guarded terms covering:

- payments, Stripe, payouts, banking, billing integration
- legal claim, compliance claim, HIPAA
- Cloudflare, DNS, systemd
- `.env`, env file, secrets, Supabase password, secret rotation
- drop table, database reset, truncate
- major UI redesign, full UI redesign
- hospital partnership, government partnership

Stop conditions:

- `DONE`
- `BLOCKED`
- forbidden task not approved
- two consecutive test failures
- max turns reached
- strategist error

## Codex CLI Compatibility Test

Run this from the repo root:

```bash
echo "list the files in this repo" | codex exec --skip-git-repo-check
```
