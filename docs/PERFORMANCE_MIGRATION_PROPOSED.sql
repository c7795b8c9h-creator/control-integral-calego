-- CALEGO Control Integral V7 Lite
-- PROPOSED ONLY. Do not apply until the V7 publication window.
-- Supabase performance advisor identifies review_sessions.machine_id as an unindexed FK.

create index if not exists idx_review_sessions_machine_id
  on public.review_sessions(machine_id);

-- RLS init-plan and multiple-permissive-policy warnings are intentionally NOT changed here.
-- Those optimizations must be regression-tested against gerente/responsable permissions,
-- inactive users, area/module access, QR validation, evidence access and review ownership
-- before any production migration is applied.
