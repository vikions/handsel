-- Preserve existing Arc Testnet rows while making agreement and event identity network-aware.
begin;

alter table public.agreements_index
  add column if not exists network text not null default 'testnet',
  add column if not exists chain_id bigint not null default 5042002,
  add column if not exists contract_address text not null default '0x51bfb2a08e7680786ed54a00ee4d915bab6b3867';

alter table public.agreement_events
  drop constraint if exists agreement_events_agreement_id_fkey;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.agreements_index'::regclass
      and conname = 'agreements_index_pkey'
      and pg_get_constraintdef(oid) = 'PRIMARY KEY (chain_id, contract_address, agreement_id)'
  ) then
    alter table public.agreements_index drop constraint if exists agreements_index_pkey;
    alter table public.agreements_index
      add constraint agreements_index_pkey primary key (chain_id, contract_address, agreement_id);
  end if;
end $$;

alter table public.agreement_events
  alter column notification_id type text using notification_id::text,
  add column if not exists network text not null default 'testnet',
  add column if not exists chain_id bigint not null default 5042002,
  add column if not exists contract_address text not null default '0x51bfb2a08e7680786ed54a00ee4d915bab6b3867';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.agreement_events'::regclass
      and conname = 'agreement_events_agreement_network_fkey'
  ) then
    alter table public.agreement_events
      add constraint agreement_events_agreement_network_fkey
      foreign key (chain_id, contract_address, agreement_id)
      references public.agreements_index (chain_id, contract_address, agreement_id)
      on delete cascade;
  end if;
end $$;

create unique index if not exists agreement_events_chain_log_idx
  on public.agreement_events (chain_id, contract_address, tx_hash, log_index);

create index if not exists agreements_index_network_client_idx
  on public.agreements_index (chain_id, contract_address, client);
create index if not exists agreements_index_network_beneficiary_idx
  on public.agreements_index (chain_id, contract_address, beneficiary);
create index if not exists agreements_index_network_arbiter_idx
  on public.agreements_index (chain_id, contract_address, arbiter);

create table if not exists public.indexer_cursors (
  network text not null,
  chain_id bigint not null,
  contract_address text not null,
  next_block bigint not null,
  updated_at timestamptz not null default now(),
  primary key (chain_id, contract_address)
);

alter table public.indexer_cursors enable row level security;
revoke all on public.indexer_cursors from anon, authenticated;

commit;
