-- Add lifecycle enum values first so later migrations can safely use them.
-- Kept separate because newly added enum values may not be usable until the
-- transaction that added them has committed.

alter type public.job_status add value if not exists 'assigned';
alter type public.job_status add value if not exists 'completed';
alter type public.job_status add value if not exists 'cancelled';

alter type public.application_status add value if not exists 'accepted';
alter type public.application_status add value if not exists 'rejected';
alter type public.application_status add value if not exists 'withdrawn';
