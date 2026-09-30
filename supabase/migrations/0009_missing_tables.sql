-- ─── Tables manquantes identifiées lors de l'audit (2026-09-29) ──────────────

-- ─── Login attempts (rate-limiting) ──────────────────────────────────────────
create table if not exists login_attempts (
  id           uuid primary key default gen_random_uuid(),
  identifier   text not null,
  ip_address   text,
  user_agent   text,
  success      boolean not null default false,
  attempted_at timestamptz not null default now()
);

create index if not exists login_attempts_identifier_idx
  on login_attempts(identifier, attempted_at desc);

-- Nettoyage automatique : conserver 30 jours max
create index if not exists login_attempts_cleanup_idx
  on login_attempts(attempted_at);

-- RLS : accessible uniquement en service-role (auth server-side)
alter table login_attempts enable row level security;
create policy "service role only" on login_attempts
  using (false) with check (false);
