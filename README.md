# Handsel

Handsel is proof-based USDC settlement for real digital work on Arc, where completed agreements become verifiable work history.

The name comes from an old trade/legal term for a first installment or earnest money. A client defines the result and commits USDC, the worker submits proof, and the client approves settlement. Completed agreements become an objective, shareable work record.

Tagline: **Proof-based USDC settlement for real digital work.**

Product line: **Agree. Prove. Settle. Build a work history.**

Live app: **https://www.archandsel.xyz/**

Handsel is already deployed on Arc testnet with a working public app, a live smart contract, and end-to-end USDC agreement flows. It uses Circle's arc-escrow sample as technical inspiration, but is not affiliated with or endorsed by Circle.

Handsel is not a regulated escrow service or legal substitute. It is open-source software for Arc experimentation and grant evaluation.

## Why Arc and USDC

Arc is EVM-compatible and designed for USDC-denominated activity. Handsel uses ERC20 USDC as the settlement asset and presents amounts in USDC terms, which keeps the product focused on real payment workflows instead of custom token mechanics.

Arc is not a future integration for Handsel. It is the settlement layer Handsel is already built on.

## Live Arc Testnet Deployment

- Live app: **https://www.archandsel.xyz/**
- Public analytics dashboard: **https://www.archandsel.xyz/#/analytics**
- Public Work Passport: **https://www.archandsel.xyz/#/profile/<wallet-address>**
- Network: **Arc Testnet**
- Chain ID: **5042002**
- Browser RPC: **https://rpc.drpc.testnet.arc.io**
- Explorer: **https://testnet.arcscan.app**
- Handsel contract: **0x51bfB2A08E7680786eD54a00eE4d915Bab6B3867**
- USDC contract: **0x3600000000000000000000000000000000000000**

Explorer links:

- Handsel contract: <https://testnet.arcscan.app/address/0x51bfB2A08E7680786eD54a00eE4d915Bab6B3867>
- USDC contract: <https://testnet.arcscan.app/address/0x3600000000000000000000000000000000000000>

## Circle Reference

Circle's arc-escrow repository demonstrates a sample escrow workflow on Arc testnet. Handsel builds a differentiated product layer around proof-based freelance and service payments: structured work criteria, proof submission, AI-assisted review, explicit client approval, dispute fallback, public receipts, and verifiable wallet work history.

The Circle sample informed the architecture of Handsel's implemented Circle integration: Modular Wallet passkey onboarding, sponsored Arc Testnet user operations, Circle Contracts event monitoring, signed webhooks, server-side transaction records, and persistent activity indexing. This repository does not copy Circle's UI, branding, embedded bytecode, or large source blocks.

### Circle Contracts event monitoring

Handsel includes an idempotent setup script for Circle Contracts event monitors. It registers the deployed Arc Testnet lifecycle events and, when `HANDSEL_WEBHOOK_URL` is set, creates a restricted `contracts.eventLog` webhook subscription.

Add `CIRCLE_API_KEY` to the local root `.env` file, then run:

```bash
pnpm circle:monitors
```

The script never writes the API key to output or source control. The Railway-ready server verifies Circle's ECDSA signature, decodes the event, reloads the agreement from Arc, and stores the indexed snapshot and transaction event in Supabase.

### Circle Modular Wallets

The frontend implements a Circle passkey smart account alongside the existing injected wallet. Users retain control through WebAuthn, and Handsel submits Circle-wallet contract actions as sponsored Arc Testnet user operations. The integration activates automatically when the production Circle Client Key and Client URL are supplied; no code change is required.

## Current Architecture

- `contracts/`: Hardhat Solidity project for the Handsel agreement primitive.
- `contracts/contracts/HandselAgreement.sol`: USDC agreement contract using OpenZeppelin `SafeERC20` and `ReentrancyGuard`.
- `contracts/contracts/test/MockUSDC.sol`: local-test-only USDC mock with 6 decimals.
- `contracts/test/HandselAgreement.test.ts`: focused lifecycle and access-control tests.
- `contracts/scripts/deploy.ts`: Arc testnet deployment script.
- `frontend/`: React + Vite + TypeScript app using wagmi and viem for direct wallet calls.
- `frontend/src/lib/aiValidation.ts`: deterministic local advisory review seam.
- `frontend/src/lib/timeline.ts`: timeline view-model helper.
- `frontend/src/lib/receipts.ts`: public receipt view-model helper.
- `frontend/src/lib/circleWallet.ts`: Circle passkey smart-account and gas-sponsored transaction adapter.
- `frontend/src/lib/activityApi.ts`: personal Circle-indexed agreement activity client.
- `server/`: Railway-ready Node API for Circle webhook verification and activity reads.
- `supabase/migrations/`: service-role-only agreement index and idempotent event ledger.

The deployed contract remains the settlement source of truth. Circle Contracts supplies event delivery, Supabase supplies a durable query index, and the frontend retains direct Arc reads for core agreement state. The Circle modules are implemented and need only deployment credentials and service configuration. OpenAI-backed server validation is not presented as live.

## Current Capability Status

### Live

- Arc Testnet deployment and USDC agreement lifecycle.
- Verified Handsel contract with public source and ABI on ArcScan.
- Client, worker, and resolver contract roles.
- Proof submission, client release, dispute resolution, expiry refund, and cancellation.
- Public analytics, role-aware personal dashboard, Work Passport, and settlement receipts.
- Direct onchain reads remain available independently of the indexing backend.

### Implemented - activates from environment configuration

- Circle Modular Wallet registration and login through device passkeys.
- Sponsored Circle smart-wallet user operations on Arc Testnet.
- Circle Contracts lifecycle event monitors and signed webhook delivery.
- Railway activity API and Supabase agreement/event index.
- Indexed transaction links in personal activity, Work Passport, and public receipts.

These are complete code paths, not roadmap placeholders. Add the documented Circle, Supabase, Railway, and Vercel values to activate them without modifying the application.

## Smart Contract Flow

1. Client calls `createAgreement` with worker, resolver, amount, deadline, title, criteria, and metadata.
2. USDC is transferred from the client to the Handsel contract.
3. Worker calls `acceptAgreement`.
4. Worker calls `submitProof` with proof text, hash, or URI.
5. Client reviews the proof and calls `approveProof` to release USDC.
6. Client can use `releaseAgreement` as a manual release path while the agreement is active.
7. Client or worker can open a dispute from active or submitted status.
8. Resolver distributes disputed funds with a basis-point split.
9. Created or active agreements can be refunded after deadline.
10. Unaccepted agreements can be cancelled by the client.

The contract has no admin withdrawal function, no owner custody path, and no upgradeability in the MVP.

## Frontend Flow

- Overview shows live contract reads for total agreements, total USDC volume, clients, freelancers, completed count, disputed count, and recent onchain agreements.
- Dashboard groups wallet-specific work into awaiting action, active, completed, and historical agreements.
- Work Passport exposes objective completed agreements, settled USDC, role counts, dispute history, and public receipts for any wallet address.
- Create Agreement captures title, worker, resolver, USDC amount, deadline, acceptance criteria, and optional brief or metadata URI.
- Agreement Detail shows parties, criteria, proof, timeline, AI-assisted local review, and role-aware actions.
- Submit Proof lets the worker provide a URL or delivery note.
- Review Proof lets the client run a deterministic local recommendation before approving release.
- Public Receipt shows completion state, settlement method, participant roles, proof, amount, verified contract, Work Passport links, and indexed ArcScan transactions when available.
- Landing page includes example agreement requests to communicate real-world use cases for small USDC service tasks.

## Environment Variables

Live frontend variables:

```bash
VITE_ARC_TESTNET_RPC_URL=https://rpc.drpc.testnet.arc.io
VITE_ARC_FALLBACK_RPC_URL=https://rpc.quicknode.testnet.arc.io
VITE_ARC_TESTNET_CHAIN_ID=5042002
VITE_USDC_ADDRESS=0x3600000000000000000000000000000000000000
VITE_HANDSEL_CONTRACT_ADDRESS=0x51bfB2A08E7680786eD54a00eE4d915Bab6B3867
VITE_HANDSEL_API_URL=http://localhost:8787
VITE_CIRCLE_CLIENT_KEY=
VITE_CIRCLE_CLIENT_URL=https://modular-sdk.circle.com/v1/rpc/w3s/buidl
```

The app still compiles without Circle or Supabase credentials. Arc contract values enable regular wallet reads and writes; Circle and backend values activate the additional implemented integrations.

Deployment variables:

```bash
ARC_TESTNET_RPC_URL=https://rpc.drpc.testnet.arc.io
ARC_TESTNET_CHAIN_ID=5042002
PRIVATE_KEY=
USDC_ADDRESS=0x3600000000000000000000000000000000000000
HANDSEL_CONTRACT_ADDRESS=0x51bfB2A08E7680786eD54a00eE4d915Bab6B3867
```

Server and Circle integration variables:

```bash
PORT=8787
APP_ORIGIN=http://localhost:5173,https://www.archandsel.xyz
ARC_TESTNET_RPC_URL=https://rpc.drpc.testnet.arc.io
HANDSEL_CONTRACT_ADDRESS=0x51bfB2A08E7680786eD54a00eE4d915Bab6B3867
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
CIRCLE_API_KEY=
CIRCLE_BLOCKCHAIN=ARC-TESTNET
HANDSEL_WEBHOOK_URL=https://your-railway-domain.example/api/webhooks/circle
```

`CIRCLE_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are server-only. Never expose them through `VITE_*`. The Circle Client Key is intended for the browser and must be domain-restricted in Circle Console.

## Activate Circle-backed Personal Activity

1. Create a Supabase project and run `supabase/migrations/202608040001_circle_activity.sql` in its SQL editor.
2. Deploy `server/` to Railway using the variables in `server/.env.example`.
3. Set `HANDSEL_WEBHOOK_URL` locally to `https://<railway-domain>/api/webhooks/circle`.
4. Create a restricted Circle API key with Contracts and Webhooks Read/Write access, then run `pnpm circle:monitors`.
5. In Circle Console Modular Wallets Configurator, set both the Client Key allowed domain and Passkey Domain to `www.archandsel.xyz`, matching the canonical application host exactly.
6. Add the Client Key, Client URL, and Railway API URL to the Vercel frontend variables and redeploy.

The personal dashboard is keyed by the connected wallet address. It shows agreements where that address is client, worker, or resolver, plus a Circle-indexed event ledger linked to ArcScan. The public Work Passport uses the same objective agreement history for any shareable wallet route.

## Local Setup

Install dependencies:

```bash
pnpm install
```

Run contract tests:

```bash
pnpm --filter @handsel/contracts test
```

Build the frontend:

```bash
pnpm --filter @handsel/frontend build
```

Build all packages:

```bash
pnpm build
```

Run the local browser app:

```bash
pnpm dev
```

This command builds and serves the same static artifact deployed by Vercel. Use `pnpm dev:vite` when the local machine permits Vite's hot-reload process.

Run the API in a second terminal:

```bash
pnpm dev:server
```

## Deployment and Smoke Test

Before changing the live deployment, verify locally:

```bash
pnpm --filter @handsel/contracts test
pnpm --filter @handsel/frontend build
pnpm build
```

The contract is already deployed and verified; final-submission setup does not require redeployment. The deployment script remains available for isolated development environments and requires these local-only values:

```bash
ARC_TESTNET_RPC_URL=https://rpc.drpc.testnet.arc.io
ARC_TESTNET_CHAIN_ID=5042002
PRIVATE_KEY=
USDC_ADDRESS=0x3600000000000000000000000000000000000000
```

Do not commit private keys or real wallet credentials. The deployment script also checks that `ARC_TESTNET_RPC_URL`, `ARC_TESTNET_CHAIN_ID`, and `USDC_ADDRESS` are present before it can deploy.

The current Arc Testnet frontend configuration is:

```bash
VITE_ARC_TESTNET_RPC_URL=https://rpc.drpc.testnet.arc.io
VITE_ARC_FALLBACK_RPC_URL=https://rpc.quicknode.testnet.arc.io
VITE_ARC_TESTNET_CHAIN_ID=5042002
VITE_USDC_ADDRESS=0x3600000000000000000000000000000000000000
VITE_HANDSEL_CONTRACT_ADDRESS=0x51bfB2A08E7680786eD54a00eE4d915Bab6B3867
```

Then run the local browser smoke test:

```bash
pnpm dev
```

Recommended browser flow:

1. Connect wallet on Arc testnet.
2. Create an agreement with title, criteria, beneficiary, arbiter, amount, and deadline.
3. Switch to the worker wallet and accept.
4. Submit proof text or a proof URL.
5. Switch to the client wallet, run local AI-assisted review, and approve release.
6. Open the receipt page and confirm the final status and settlement summary.

## Grant Alignment

Handsel demonstrates real-world economic activity on Arc testnet: structured service agreements, USDC commitment, proof submission, AI-assisted review, human approval, fallback dispute/refund flow, public settlement receipts, and verifiable contract activity on Arcscan.

## Implementation and Expansion

- Live now: Arc Testnet deployment, verified contract, USDC agreement lifecycle, direct onchain analytics, Work Passport, public receipts, and the personal work hub.
- Implemented integration activation: Supply Circle, Supabase, Railway, and Vercel environment values to activate the existing passkey wallet adapter, sponsored user operations, Circle Contracts webhooks, activity API, and persistent indexing. No feature implementation remains for these paths.
- AI-assisted review: Expand the local proof review seam into a stronger AI-assisted recommendation layer that compares criteria and submitted proof while keeping final settlement decisions in human hands.
- Crosschain funding: Add CCTP Bridge Kit as an optional pre-agreement funding step that brings USDC onto Arc without changing Handsel's settlement rules.
- Agent tasks: Add allowlisted API automation around the existing agreement lifecycle and transaction trail.
- Product expansion: Agreement templates, analytics, dispute workflow improvements, marketplace/API paths, and user onboarding for freelancers, agencies, creators, and small businesses.

## Security and Compliance Notes

Handsel is a testnet MVP. It does not provide regulated escrow services, legal dispute adjudication, compliance screening, custody services, or production availability claims. Integrators are responsible for their own legal, regulatory, tax, operational, and counterparty-risk reviews before any production use.
