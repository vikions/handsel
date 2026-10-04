# Verified product changes since the original grant application

This lists the shipped product changes. The project team has completed the core agreement lifecycle on Arc Mainnet through a Circle passkey; dispute and refund remain fallback paths.

- Proof-first `HandselAgreement` lifecycle: create/fund, accept, submit proof, explicit client release, dispute/resolver split, expiry refund, unaccepted cancellation; 19 contract tests.
- Rebuilt agreement creation with preview, validation, clear parties/criteria, USDC allowance, role-aware actions, and transaction states.
- Dashboard and Work Passport views for client, worker and resolver activity; public analytics and receipts linked to Arc explorer.
- Circle Modular Wallet passkey connector and UserOperation write path used for a complete Mainnet agreement flow; external EVM wallets remain available.
- Railway API with signed Circle contract-event webhook handling, guarded Arc Mainnet monitor setup (not activated), and a network-aware Arc RPC indexer for mainnet activity.
- Supabase production migrations applied for chain/contract-scoped agreement IDs, events, and a resumable indexer cursor.
- Mainnet network settings, guarded deployment command, read-only preflight/postdeploy checks, source-verification runbook, and production smoke plan.
- HandselAgreement deployed on Arc Mainnet chain `5042` at `0x51bfB2A08E7680786eD54a00eE4d915Bab6B3867` in block `22724141`; deployment and read-only contract checks passed. Blockscout reports an exact source match and exposes ABI/Read/Write. The same numerical address exists on Arc Testnet, so all activity is chain-scoped. The project team completed a proof-based Mainnet agreement through Circle passkey.
- Clearer distinction between deterministic local proof checklist and human approval, plus Circle integration status matrix.

Do not infer production users, revenue, or mainnet transaction volume from testnet analytics. Add real metrics only after independently checking explorer and backend records.
