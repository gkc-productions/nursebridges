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
- `OPENAI_TIMEOUT_SEC`: optional. Defaults to `60`.
- `MAX_TURNS`: optional. Defaults to `3`.
- `MANUAL_MODE`: optional. Set `MANUAL_MODE=1` to skip OpenAI and run `prompts/current.md` once.

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

Before the first autonomous turn, the orchestrator records a non-mutating git checkpoint in `checkpoint.json`.

## Logs

Each run writes logs under:

```text
tools/twin-orchestrator/logs/YYYYMMDD-HHMMSS/
```

Each run writes `session.json` and `checkpoint.json`.

Per-turn logs include:

- `turn-XX/strategist_raw.txt`
- `turn-XX/strategist_decision.json` or `turn-XX/strategist-error.json`
- `turn-XX/codex_prompt.txt`
- `turn-XX/codex_stdout.txt`
- `turn-XX/codex_stderr.txt`
- `turn-XX/codex_result.json`

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
echo "Inspect repo and report package scripts. Do not change files." | codex exec --skip-git-repo-check --sandbox danger-full-access
```

## Manual Mode Test

Run this from the repo root:

```bash
MANUAL_MODE=1 CODEX_CMD='codex exec --skip-git-repo-check --sandbox danger-full-access' tools/twin-orchestrator/.venv/bin/python tools/twin-orchestrator/orchestrator.py
```

## One-Turn Strategist Test

Run this from the repo root:

```bash
OPENAI_MODEL="gpt-4o-mini" MAX_TURNS=1 CODEX_CMD='codex exec --skip-git-repo-check --sandbox danger-full-access' tools/twin-orchestrator/.venv/bin/python tools/twin-orchestrator/orchestrator.py
```
