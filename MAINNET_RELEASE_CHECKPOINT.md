# HANDSEL - GRANT READY MAINNET RELEASE CHECKPOINT

**Updated 2026-09-26. Status: MAINNET CONTRACT AND APP CONFIGURED; REAL AGREEMENT SMOKE TEST PENDING.** HandselAgreement exists on chain `5042` at `0x51bfB2A08E7680786eD54a00eE4d915Bab6B3867` (block `22724141`, tx `0x3556fcbea8c41c0c75a2aeb9fde699177bdeb0afa70e2296f371061fb11dc369`). [Blockscout reports an exact source match](https://explorer.arc.io/address/0x51bfB2A08E7680786eD54a00eE4d915Bab6B3867?tab=contract). The same numerical address exists on Arc Testnet; chain ID distinguishes the deployments. Supabase, Railway, and the public Vercel app now target Mainnet. No real agreement was created or settled during this cutover.

## A-C. Status, changes, verification

- **A:** Mainnet infrastructure is live; end-to-end payment operation is not yet demonstrated. The testnet contract remains separate.
- **B:** Added network-aware Arc RPC indexing, chain/contract-scoped Supabase identity, Circle webhook/RPC deduplication, strict mainnet deployment guards, read-only preflight/postdeploy scripts, accurate mainnet UI/error states, and operational/grant documents. The previous contract mechanics and visual shell were preserved. Unrelated untracked work was left untouched.
- **C:** `pnpm test` passed on 2026-09-26 (19 contract, 5 backend); `pnpm typecheck` and `pnpm build` passed before the infrastructure cutover. Vercel production build succeeded. Public browser checks show chain `5042`, zero initial agreement/volume counts, and no configuration warning on Dashboard/Create. Railway `/health` reports `network=mainnet`, `chainId=5042`, `indexer=true`, and `supabase=true`; service-role reads confirmed the mainnet cursor. No client/worker transaction has been sent for the smoke test.

## D-G. Network and contract

- **D:** Arc Mainnet chain ID `5042`; official RPC `https://rpc.mainnet.arc.io` (QuickNode fallback `https://rpc.quicknode.mainnet.arc.io`); explorer `https://explorer.arc.io`; USDC ERC20 `0x3600000000000000000000000000000000000000`, 6 decimals. Native USDC gas accounting uses 18 decimals. dRPC was not used for the live indexer because its `eth_getLogs` range limit blocked scanning.
- **E:** Solidity `0.8.24`, optimizer enabled/200 runs, one immutable constructor address. Deploy script prints network, chain, signer, USDC, contract, arguments, estimated gas and intended action before sending. It rejects wrong chain/USDC, unexpected signer, insufficient gas, missing confirmation phrase, or existing deployment metadata. There is no admin withdrawal or upgrade path. An independent contract review is still recommended before meaningful value; a nonresponsive resolver can leave disputed funds locked.
- **F:** One deployment succeeded on 2026-09-26 with funded expected deployer. Do **not** run the deploy command again. Public metadata is recorded in `deployments/arc-mainnet.json`; preflight and postdeploy are read-only.
- **G:** Constructor argument exactly `0x3600000000000000000000000000000000000000`.

## H-K. Production data and settings

- **H:** Both Supabase migrations were applied to the restored production project. It had no Handsel tables before migration. REST checks confirmed agreement/event tables and a mainnet cursor; no agreement/event rows exist yet. See `SUPABASE_MAINNET_MIGRATION.md` for new-database or recovery procedures.
- **I:** Railway service is running at `https://handselserver-production.up.railway.app` with `ARC_NETWORK=mainnet`, `ARC_RPC_URL=https://rpc.mainnet.arc.io`, `ARC_CHAIN_ID=5042`, the verified contract, deployment block `22724141`, Supabase service role, and the RPC indexer. `/health` and `/api/activity/<address>` returned healthy Mainnet responses. The service-role key is server-only.
- **J:** Vercel production at `https://www.archandsel.xyz` uses Mainnet chain `5042`, official RPC, QuickNode fallback, official USDC interface, the verified contract, and the Railway API. A successful production build was promoted after correcting CRLF characters mistakenly included by PowerShell-piped environment values. Browser checks confirmed correct network and live zero-count reads.
- **K:** The testnet Circle Client Key was removed from Vercel Production, and the test Circle API key was removed from Railway Mainnet. Add `VITE_CIRCLE_CLIENT_KEY=<Circle mainnet domain-restricted Client Key>` and `VITE_CIRCLE_CLIENT_URL=https://modular-sdk.circle.com/v1/rpc/w3s/buidl` only when mainnet Modular Wallet/passkey operation is configured. Circle API keys remain server-only; the RPC indexer does not need one. Verify sponsorship policy and a successful UserOperation before claiming gas sponsorship.

## L-M. Integration truth

- **L:** Existing testnet product uses official USDC/Handsel contract mechanics and has browser wallet plus Circle Modular Wallet code paths. Arc Mainnet USDC contract interface and chain were verified read-only. After deployment and smoke test, the immutable USDC settlement and Arc RPC-backed receipts may be called live.
- **M:** Mainnet Circle passkey/MSCA/sponsorship is implemented but **unproven** until a successful UserOperation with production credentials. Circle Contracts APIs list Arc Mainnet and the repository has a guarded monitor setup script and signed webhook receiver, but no Handsel mainnet monitor or delivered webhook has been verified. Mainnet activity uses Handsel's Arc RPC indexer by default. Developer Controlled Wallets, CCTP, Circle Mint, CPN and OpenAI validation are not integrated. The local proof checklist is deterministic text/URL matching only. See `CIRCLE_MAINNET_STATUS.md`.

## N-Q. After the deployment transaction

- **N:** Deployment, source verification, Supabase migration, Railway cutover, Vercel cutover, and read-only browser checks are complete. Next run a separately approved minimal-value smoke test, capture explorer/receipt/indexer evidence, and update the grant. Circle mainnet event monitors remain optional and require production credentials plus delivered-webhook verification; they do not replace the Arc RPC indexer.
- **O:** `MAINNET_SMOKE_TEST.md` specifies client USDC approval, `createAgreement`, worker `acceptAgreement`/`submitProof`, client `approveProof`, balances, explorer events, backend cursor and Supabase rows. A separate resolver dispute test is optional and needs separate value approval.
- **P:** Hardhat's legacy API returned HTML instead of JSON. Manual Blockscout verification succeeded using MIT license, Solidity Standard JSON Input from matching Hardhat build-info, and compiler `v0.8.24+commit.e11b9ed9`. [Verified source (exact match), ABI and Read/Write](https://explorer.arc.io/address/0x51bfB2A08E7680786eD54a00eE4d915Bab6B3867?tab=contract) are visible.
- **Q:** Fill `GRANT_EVIDENCE_CHECKLIST.md` with the verified contract, deployment tx, agreement ID, approval/create/proof/release txs, dashboard/receipt screenshots, actual mainnet counts, and backend/indexer status. Use `CIRCLE_GRANT_UPDATE_DRAFT.md` and `CHANGELOG_SINCE_GRANT.md` without inventing traction.

## R-T. Human gate

1. **R1:** Review code, contract liveness/dispute risk, Circle/mainnet terms and production wallet choice. Fund the reviewed deployer with enough native USDC; set `EXPECTED_MAINNET_DEPLOYER` locally; rerun preflight. No private key belongs in chat or Git.
2. **R2:** Completed: one mainnet deployment, address/block/tx record, postdeploy checks, and manual Blockscout exact-match source verification.
3. **R3:** Completed for core app: production Supabase migrations, Railway, and Vercel are configured for Mainnet. Circle mainnet Client Key remains unset until separately configured and verified; do not reuse testnet credentials as mainnet proof.
4. **R4:** Execute the minimal-value real agreement with distinct client/worker accounts, inspect explorer and indexer records, and fill evidence.
5. **R5:** Replace grant placeholders with observed links/data and resubmit before the deadline. The grant program's stated cutoff is September 25, 11:59pm ET; confirm the portal remains open.

- **S:** Rough hands-on estimate: 1-3 hours if funding, Circle access, Supabase backup/migration and explorer verification work first try. External approval, propagation, or API issues can add unpredictable time; do not wait until the final minutes.
- **T:** The mainnet contract and app infrastructure are deployed, but a credible full-product claim still needs a real client/worker settlement. Circle mainnet passkey/sponsorship has not been validated. A paused Supabase project, stale Vercel build-time values, or an unreliable resolver could block usage. Never represent testnet analytics as mainnet traction.

Remaining `5042002`, `arcTestnet`, testnet explorer and old contract references are intentional compatibility paths, local tests, or migration backfill. The earlier address-based mainnet rejection was removed after both networks produced the same address; network checks must use chain ID. Exactly one mainnet contract deployment was sent. Supabase, Railway, and Vercel were updated afterward; no agreement or Circle UserOperation was sent during this cutover.
