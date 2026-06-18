# NurseBridge Twin Orchestrator

Paused experiment - not part of active NurseBridge build workflow.

Twin automation is retained here for reference only. Do not run the local
orchestrator, Supabase queue worker, queue loop, or Twin task insertion flow for
current NurseBridge work.

## Current Workflow

Active NurseBridge work should use:

- User + ChatGPT for strategy and prioritization.
- Direct, scoped Codex prompts for implementation.
- Manual human approval before any EAS build.

## Pause Rules

- Do not run `orchestrator.py`.
- Do not run `worker.py`.
- Do not apply `queue_schema.sql`.
- Do not create new Twin tasks.
- Do not start a queue loop, background worker, systemd unit, schedule, tmux
  session, or nohup process for this tooling.
- Do not touch Cloudflare, systemd, Supabase schema, env files, or secrets as
  part of this experiment.

Both `orchestrator.py` and `worker.py` are guarded by default and exit before
doing work unless the experiment is explicitly re-enabled in a future decision.

## Retained Files

These files remain because they may be useful historical reference if the
experiment is revisited later:

- `orchestrator.py`: local autonomous orchestrator prototype.
- `prompts/current.md`: last scoped prompt used while experimenting.
- `project-state.md`: project state snapshot captured for the prototype.
- `queue_schema.sql`: proposed Supabase queue schema, not applied by this pause.
- `worker.py`: proposed Supabase queue worker, not active.
- `worker_requirements.txt`: worker dependency list.
- `requirements.txt`: local orchestrator dependency list.

## Reactivation

Reactivation should be a separate, explicit project decision with a fresh review
of guardrails, schema impact, secrets handling, service startup behavior, and the
current NurseBridge release priorities.
