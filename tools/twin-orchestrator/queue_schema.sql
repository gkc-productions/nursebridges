-- NurseBridge Twin Orchestrator queue bridge.
-- PAUSED EXPERIMENT: not part of the active NurseBridge build workflow.
-- Do not apply this schema unless Twin automation is explicitly reactivated.
-- Service-role automation only: RLS is enabled and no public policies are added.

create table if not exists public.agent_tasks (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  turn integer not null default 1,
  parent_task_id uuid references public.agent_tasks(id),
  mode text not null check (mode in ('inspect','patch','verify','build-request')),
  title text not null,
  prompt text not null,
  rationale text,
  status text not null default 'pending' check (status in ('pending','in_progress','awaiting_review','done','error','blocked','cancelled')),
  requires_approval boolean not null default false,
  approved_by text,
  approved_at timestamptz,
  forbidden_hits text[] not null default '{}',
  claimed_by text,
  claimed_at timestamptz,
  max_runtime_sec integer not null default 900,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.agent_tasks(id) on delete cascade,
  worker_host text,
  worker_version text,
  command text,
  exit_code integer,
  outcome text not null check (outcome in ('success','failed','timeout','guardrail','error')),
  worker_summary text,
  stdout text,
  stderr text,
  head_before text,
  head_after text,
  changed_files jsonb not null default '[]'::jsonb,
  diff_stat text,
  notes jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  finished_at timestamptz,
  elapsed_sec numeric,
  created_at timestamptz not null default now()
);

create index if not exists idx_agent_tasks_status_created_at
  on public.agent_tasks(status, created_at);

create index if not exists idx_agent_tasks_session_turn
  on public.agent_tasks(session_id, turn);

create index if not exists idx_agent_runs_task_created_at
  on public.agent_runs(task_id, created_at);

create or replace function public.set_agent_tasks_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_agent_tasks_updated_at on public.agent_tasks;

create trigger set_agent_tasks_updated_at
before update on public.agent_tasks
for each row
execute function public.set_agent_tasks_updated_at();

alter table public.agent_tasks enable row level security;
alter table public.agent_runs enable row level security;

comment on table public.agent_tasks is
  'Twin-to-VM task queue. Service-role automation only; no public RLS policies are intentionally defined.';

comment on table public.agent_runs is
  'Twin-to-VM worker run results. Service-role automation only; no public RLS policies are intentionally defined.';
