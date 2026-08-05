create table if not exists public.agreements_index (
  agreement_id bigint primary key,
  client text not null,
  beneficiary text not null,
  arbiter text not null,
  amount numeric(78, 0) not null,
  deadline bigint not null,
  title text not null default '',
  criteria_uri text not null default '',
  metadata_uri text not null default '',
  proof_uri text not null default '',
  status smallint not null,
  created_at_chain bigint not null default 0,
  accepted_at_chain bigint not null default 0,
  submitted_at_chain bigint not null default 0,
  completed_at_chain bigint not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists agreements_index_client_idx on public.agreements_index (client);
create index if not exists agreements_index_beneficiary_idx on public.agreements_index (beneficiary);
create index if not exists agreements_index_arbiter_idx on public.agreements_index (arbiter);

create table if not exists public.agreement_events (
  notification_id uuid primary key,
  agreement_id bigint not null references public.agreements_index (agreement_id) on delete cascade,
  event_name text not null,
  tx_hash text not null,
  block_height bigint,
  log_index text,
  event_args jsonb not null default '{}'::jsonb,
  raw_notification jsonb not null,
  confirmed_at timestamptz not null,
  received_at timestamptz not null default now()
);

create index if not exists agreement_events_agreement_idx
  on public.agreement_events (agreement_id, confirmed_at desc);

alter table public.agreements_index enable row level security;
alter table public.agreement_events enable row level security;

revoke all on public.agreements_index from anon, authenticated;
revoke all on public.agreement_events from anon, authenticated;

