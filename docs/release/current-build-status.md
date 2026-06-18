# Current Build Status

Twin automation is paused and is not part of the active NurseBridge build
workflow.

## Active Workflow

- User + ChatGPT for strategy and prioritization.
- Direct, scoped Codex prompts for implementation.
- Keep changes narrow and product-focused.

## Current Active Blocker

Mobile create-job returns 400 on the real Android app.

## Operational Constraints

- Do not run an EAS build unless explicitly approved.
- Do not touch API/Admin/Cloudflare/systemd unless a health check fails.
- Do not touch Supabase schema, env files, or secrets unless explicitly approved
  for a separate scoped task.

## Next Priority

Diagnose and fix the mobile create-job 400 using direct scoped Codex tasks.
