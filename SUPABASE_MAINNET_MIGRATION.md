# Supabase mainnet activity migration

**Not applied by this repository.** The contract remains authoritative; Supabase only indexes its events. Run this in a reviewed maintenance window, using a staging copy first. Back up the production database in Supabase Dashboard (or `pg_dump` with a securely held database URL) and verify a restore before touching production. Never commit a database URL or service-role key.

## Before applying

1. Confirm `202608040001_circle_activity.sql` is already applied and the current Railway service is healthy. Temporarily stop the old webhook/indexer writer or place it in maintenance mode. The old writer uses `agreement_id` as its sole upsert key; it cannot write safely after the composite-key migration.
2. Export `agreements_index` and `agreement_events`; record row counts and max agreement ID. Test restoration on a separate Supabase project.
3. Run these read-only checks in SQL Editor. A non-empty duplicate result blocks the unique log index; investigate before migration. Do not delete rows blindly.

```sql
select count(*) from public.agreements_index;
select count(*) from public.agreement_events;
select lower(tx_hash), log_index, count(*)
from public.agreement_events
where log_index is not null
group by lower(tx_hash), log_index
having count(*) > 1;
select count(*) from public.agreement_events e
left join public.agreements_index a on a.agreement_id = e.agreement_id
where a.agreement_id is null;
```

## Apply

Apply the full `supabase/migrations/202609180001_network_aware_activity.sql` in Supabase SQL Editor, or through the project's normal migration mechanism. The file runs in one transaction, preserves existing testnet rows, gives them chain ID `5042002` and the original testnet contract address, and adds a composite `(chain_id, contract_address, agreement_id)` primary key. It changes the event notification ID from UUID to text for deterministic RPC log IDs. Constraint changes are guarded for reruns; indexes/table use `IF NOT EXISTS`. A failure rolls back the whole migration. Record the migration result and time.

## Verify before restarting writes

```sql
select network, chain_id, contract_address, count(*)
from public.agreements_index group by 1,2,3;
select network, chain_id, contract_address, count(*)
from public.agreement_events group by 1,2,3;
select conname, pg_get_constraintdef(oid)
from pg_constraint where conrelid = 'public.agreements_index'::regclass;
select indexname from pg_indexes where schemaname='public'
  and tablename in ('agreement_events', 'agreements_index');
select count(*) from public.indexer_cursors;
```

Historical counts must match the backup. `indexer_cursors` starts empty. Testnet rows must remain on chain `5042002`; no mainnet rows are expected before real activity. Verify `anon` and `authenticated` roles cannot read these tables; only the server-side service role is used.

## Switch and recovery

Deploy the new Railway service with `ARC_NETWORK=mainnet`, `ARC_CHAIN_ID=5042`, the new mainnet contract address, **actual deployment block**, RPC, Supabase URL/key, and allowed app origin. Set the contract/block before enabling the service so the indexer never starts at block zero. The cursor is isolated by chain and contract. Check `/health`, then a wallet's `/api/activity/<address>` and the cursor row. Update Vercel only after the backend is ready.

If migration fails, leave the old service paused, inspect the SQL error and restore from backup if necessary. If the new service fails after migration, roll back the application service or restore the database as a unit; do **not** restart the old writer against the new composite schema. Preserve the backup until the first real mainnet agreement and event have been indexed. Supabase free-tier pause/quotas can interrupt indexing; unpause and verify service health before the smoke test.
