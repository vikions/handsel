# Handsel

**Proof-based USDC settlement for real digital work.**

Handsel is a programmable agreement layer on Arc. A client defines measurable work, commits USDC, a worker submits proof, and the client explicitly approves settlement. Dispute, expiry refund, and cancellation flows remain available as fallbacks. Completed agreements form verifiable work history and public settlement receipts.

Live app: **https://www.archandsel.xyz/**

> Mainnet status (2026-10-04): `HandselAgreement` is deployed and source-verified on Arc Mainnet. The public Vercel app and Railway API target chain `5042`; Supabase migrations and RPC indexing are active. The project team completed the client-to-worker agreement flow through a Circle passkey on Arc Mainnet: commit USDC, accept work, submit proof, and approve release. The Arc Testnet deployment remains separate.

Mainnet contract address (chain `5042`): **[`0x51bfB2A08E7680786eD54a00eE4d915Bab6B3867`](https://explorer.arc.io/address/0x51bfB2A08E7680786eD54a00eE4d915Bab6B3867?tab=contract)**. [Deployment transaction](https://explorer.arc.io/tx/0x3556fcbea8c41c0c75a2aeb9fde699177bdeb0afa70e2296f371061fb11dc369), block `22724141`. Blockscout reports an **exact source match** and exposes Read/Write Contract. The same numerical address exists on Arc Testnet because contract addresses derive from deployer and nonce; **chain ID distinguishes the two contracts**. The public app targets the Mainnet deployment.

Handsel is independent and is not affiliated with or endorsed by Circle. It is software, not a regulated escrow service or a substitute for legal agreements, compliance review, or professional advice.

## Why Arc and USDC

Arc is an EVM-compatible network with USDC as its native gas asset. Handsel uses the official ERC20 USDC interface for approval, deposits, and settlement, keeping agreement accounting in six-decimal USDC units while Arc network fees use the native 18-decimal representation.

Official Arc Mainnet configuration:

| Setting | Value |
| --- | --- |
| Chain | Arc Mainnet |
| Chain ID | `5042` |
| Official primary RPC | `https://rpc.mainnet.arc.io` |
| Handsel RPC | `https://rpc.mainnet.arc.io` |
| Explorer | `https://explorer.arc.io` |
| USDC ERC20 interface | `0x3600000000000000000000000000000000000000` |
| USDC decimals | `6` |

Arc Testnet remains supported with chain ID `5042002`, `https://rpc.testnet.arc.io`, and `https://explorer.testnet.arc.io`.

## Architecture

- `contracts/`: Solidity 0.8.24 + Hardhat, optimizer enabled with 200 runs.
- `HandselAgreement.sol`: immutable USDC address, proof-first lifecycle, SafeERC20, ReentrancyGuard, no owner withdrawal, no proxy.
- `frontend/`: React + Vite + TypeScript, wagmi/viem direct contract reads and writes.
- `frontend/src/lib/circleWallet.ts`: Circle Modular Wallet passkey account and sponsored UserOperations, using `/arc` on mainnet and `/arcTestnet` on testnet.
- `server/`: Railway-ready API with verified Circle webhook handling and an Arc RPC event indexer.
- `supabase/`: network-aware agreement, event, and indexer-cursor storage.
- The contract is the source of truth. Supabase is a query index, never a settlement authority.

## Agreement Flow

1. Client approves USDC and creates an agreement.
2. Worker accepts the agreement.
3. Worker submits proof text, a hash, or a URI.
4. Client approves the proof and USDC is released.
5. Either participant can dispute an active or submitted agreement.
6. The selected resolver can split disputed funds.
7. An expired created/active agreement can be refunded; an unaccepted agreement can be cancelled.

The manual `releaseAgreement` path remains available when proof review happens offchain.

## Circle Integrations

### Modular Wallets

Circle Modular Wallet passkey onboarding and UserOperation transactions are active on Arc Mainnet. The production Client Key is configured on Vercel. The project team completed an agreement from USDC commitment through proof approval using Circle passkeys; registration and repeat sign-in also work. An older Circle Testnet passkey did not authenticate against the Mainnet configuration; creating a new Mainnet passkey worked. The browser key is public but should be domain-restricted in Circle Console. External EVM wallets remain available. See [Circle integration status](CIRCLE_MAINNET_STATUS.md) for the current integration details.

### Circle Contracts

Circle's current [Create Event Monitor API](https://developers.circle.com/api-reference/contracts/smart-contract-platform/create-event-monitor) lists both `ARC` and `ARC-TESTNET`. Handsel has a signature-verifying webhook route and a guarded monitor-setup script for either network, but **no Arc Mainnet monitor or delivered webhook has been verified yet**. The old test API key was removed from the Mainnet Railway environment. The mainnet script requires an explicit Circle mainnet API key, contract address, HTTPS webhook URL, `ARC_NETWORK=mainnet`, and `CONFIRM_CIRCLE_MAINNET_MONITORS=HANDSEL_ARC_MAINNET_5042`. Running it makes remote Circle API changes and requires separate approval.

Mainnet activity is indexed directly from Arc RPC logs by the Railway service, independently of Circle monitors. The indexer stores network, chain ID, contract address, transaction hash, block, and log index, so testnet and mainnet records cannot collide. Signed Circle webhooks are an optional second ingestion path after the corresponding monitor and subscription are actually configured. Duplicate RPC/webhook logs share one deterministic event ID.

The "proof review" button currently runs a deterministic local text/URL checklist, not OpenAI or artifact inspection. It cannot authorize payment. The client must inspect delivery and approve onchain.

## Network Selection

Production defaults to mainnet:

```bash
VITE_ARC_NETWORK=mainnet
ARC_NETWORK=mainnet
```

For testnet development, set both to `testnet` and supply the existing testnet contract address. Never point a mainnet frontend at a testnet backend: the frontend rejects activity responses for the wrong network.

## Environment Variables

Copy `.env.example` locally. Do not commit `.env`.

Frontend/Vercel:

```bash
VITE_ARC_NETWORK=mainnet
VITE_ARC_RPC_URL=https://rpc.mainnet.arc.io
VITE_ARC_FALLBACK_RPC_URL=https://rpc.quicknode.mainnet.arc.io
VITE_ARC_CHAIN_ID=5042
VITE_USDC_ADDRESS=0x3600000000000000000000000000000000000000
VITE_HANDSEL_CONTRACT_ADDRESS=0x51bfB2A08E7680786eD54a00eE4d915Bab6B3867
VITE_HANDSEL_API_URL=https://handselserver-production.up.railway.app
VITE_CIRCLE_CLIENT_KEY=
VITE_CIRCLE_CLIENT_URL=https://modular-sdk.circle.com/v1/rpc/w3s/buidl
```

Railway/server:

```bash
APP_ORIGIN=https://www.archandsel.xyz
ARC_NETWORK=mainnet
ARC_RPC_URL=https://rpc.mainnet.arc.io
ARC_CHAIN_ID=5042
USDC_ADDRESS=0x3600000000000000000000000000000000000000
HANDSEL_CONTRACT_ADDRESS=0x51bfB2A08E7680786eD54a00eE4d915Bab6B3867
HANDSEL_DEPLOYMENT_BLOCK=22724141
INDEXER_INTERVAL_MS=15000
INDEXER_CONFIRMATIONS=2
SUPABASE_URL=https://jbxstevzehfrhlpjhvut.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<server only>
```

Set `VITE_CIRCLE_CLIENT_KEY` to a Mainnet Client Key authorized for the app domain; use a separate Testnet key for testnet development. No actual key belongs in the repository. `CIRCLE_API_KEY` is not required by the mainnet RPC indexer. Keep it server-only for supported Circle API operations. Never expose it through a `VITE_*` variable.

Hardhat, local only:

```bash
ARC_MAINNET_RPC_URL=https://rpc.mainnet.arc.io
ARC_MAINNET_CHAIN_ID=5042
PRIVATE_KEY=
USDC_ADDRESS=0x3600000000000000000000000000000000000000
CONFIRM_ARC_MAINNET_DEPLOYMENT=
EXPECTED_MAINNET_DEPLOYER=<reviewed signer address>
HANDSEL_MAINNET_DEPLOYMENT_ADDRESS=
```

## Supabase Migration

Apply migrations in order:

1. `supabase/migrations/202608040001_circle_activity.sql`
2. `supabase/migrations/202609180001_network_aware_activity.sql`

The second migration preserves existing testnet rows and changes identity to `chain_id + contract_address + agreement_id`. It also adds a cursor table for resumable RPC indexing. Both migrations were applied to the restored production project on 2026-09-26. The project had no Handsel tables before migration; service-role reads confirmed the tables and mainnet cursor. Read [the migration runbook](SUPABASE_MAINNET_MIGRATION.md) before applying the files to another database.

## Local Verification

```bash
pnpm install
pnpm --filter @handsel/contracts test
pnpm --filter @handsel/server test
pnpm --filter @handsel/frontend build
pnpm typecheck
pnpm build
pnpm mainnet:preflight
```

Run the frontend and API:

```bash
pnpm dev:vite
pnpm dev:server
```

## Mainnet Deployment Runbook

The mainnet deployment was completed on 2026-09-26 and recorded in `deployments/arc-mainnet.json`. **Do not deploy a second copy.** `pnpm mainnet:preflight` remains a read-only check of the chain, USDC, compiler settings, deployer and gas estimate.

The following command is preserved as a historical/reference procedure, **not an instruction to run it now**. The script refuses a previously recorded mainnet deployment.

```powershell
$env:CONFIRM_ARC_MAINNET_DEPLOYMENT="HANDSEL_ARC_MAINNET_5042"
pnpm --filter @handsel/contracts deploy:arc:mainnet
Remove-Item Env:CONFIRM_ARC_MAINNET_DEPLOYMENT
```

Constructor argument:

```text
0x3600000000000000000000000000000000000000
```

Do not repeat the deploy command if the transaction result is uncertain. Check the deployer account and explorer first. The contract address, transaction hash and deployment block are printed and recorded only after a successful receipt.

Run read-only postdeploy checks with the recorded values. Hardhat's `run` command does not forward custom CLI flags, so pass values through environment variables:

```powershell
$env:HANDSEL_POSTDEPLOY_ADDRESS="0x51bfB2A08E7680786eD54a00eE4d915Bab6B3867"
$env:HANDSEL_POSTDEPLOY_BLOCK="22724141"
$env:HANDSEL_POSTDEPLOY_TX="0x3556fcbea8c41c0c75a2aeb9fde699177bdeb0afa70e2296f371061fb11dc369"
pnpm mainnet:postdeploy
```

The postdeploy command checks chain ID, deployed code, immutable USDC, contract reads and optional deployment receipt, then prints explorer, Vercel, Railway and verification values. It changes no remote settings. `HANDSEL_POSTDEPLOY_RECORD=true` can create the local metadata file if a separately deployed address was not already recorded; it refuses overwrites and requires `HANDSEL_POSTDEPLOY_TX`.

Hardhat's legacy verification API returned HTML instead of JSON. The contract was subsequently verified through Blockscout's manual Solidity Standard JSON Input form using the exact Hardhat build-info input. The explorer now reports **Contract source code verified (exact match)** and exposes the ABI and Read/Write Contract tab. The command below remains a reference for environments where the API works:

```powershell
pnpm --filter @handsel/contracts verify:arc:mainnet -- <HANDSEL_CONTRACT_ADDRESS> 0x3600000000000000000000000000000000000000
```

Hardhat uses Solidity `0.8.24` with optimizer enabled at 200 runs and one constructor argument (USDC). Manual verification used MIT license, Solidity Standard JSON Input, compiler `v0.8.24+commit.e11b9ed9`, and the matching Hardhat build-info `input`. The [mainnet explorer shows verified source and Read/Write](https://explorer.arc.io/address/0x51bfB2A08E7680786eD54a00eE4d915Bab6B3867?tab=contract).

Follow [the production smoke test](MAINNET_SMOKE_TEST.md), [Circle status matrix](CIRCLE_MAINNET_STATUS.md), [grant evidence checklist](GRANT_EVIDENCE_CHECKLIST.md), and [grant update draft](CIRCLE_GRANT_UPDATE_DRAFT.md). Supabase, Railway, and Vercel are configured for Mainnet and were checked read-only. Next, perform a separately approved minimal-value agreement sequence, verify explorer events and indexed records, and capture evidence. No real agreement transaction was sent during the infrastructure cutover.

## Existing Testnet Deployment

- Contract: `0x51bfB2A08E7680786eD54a00eE4d915Bab6B3867`
- Explorer: https://explorer.testnet.arc.io/address/0x51bfB2A08E7680786eD54a00eE4d915Bab6B3867
- USDC: `0x3600000000000000000000000000000000000000`

The testnet deployment and records are preserved. Use `deploy:arc:testnet` only for a new isolated test deployment.

## Circle Reference

Circle's `arc-escrow` repository demonstrates a sample escrow workflow on Arc Testnet. Handsel uses it as technical inspiration, not copied product code. Handsel adds structured criteria, proof submission, human-controlled approval, dispute fallback, public receipts, Work Passport history, network-separated indexing, and a mainnet-safe deployment path.

## Production Safety

The contract has no admin custody path or upgrade mechanism, so deployed behavior cannot be patched. Before using meaningful value, obtain an independent Solidity review, verify source/bytecode and constructor arguments, test every role with minimal amounts, monitor indexed events and balances, and prepare operational incident procedures.

Arbiters are selected by agreement participants; Handsel does not guarantee dispute outcomes. Users and integrators remain responsible for legal, regulatory, sanctions, tax, counterparty, wallet, and operational requirements.
