# Handsel

Handsel is a proof-based USDC agreement layer for freelance, service, and agent work on Arc.

The name comes from an old trade/legal term for a first installment or earnest money. The product follows that pattern: a client commits USDC around clear work criteria, the beneficiary submits proof, AI-assisted review can help evaluate delivery, and the client explicitly approves release.

Tagline: **Proof-based settlement for real work.**

Handsel is an independent testnet MVP built on Arc. It uses Circle's arc-escrow sample as technical inspiration, but is not affiliated with or endorsed by Circle.

Handsel is not a regulated escrow service or legal substitute. It is open-source software for Arc testnet experimentation and grant evaluation.

## Why Arc and USDC

Arc is EVM-compatible and designed for USDC-denominated activity. Handsel uses ERC20 USDC as the settlement asset and presents amounts in USDC terms, which keeps the MVP focused on real payment workflows instead of custom token mechanics.

## Circle Reference

Circle's arc-escrow repository demonstrates a sample escrow workflow on Arc testnet. Handsel builds a differentiated product layer around proof-based freelance and service payments: structured work criteria, proof submission, AI-assisted review, explicit client approval, dispute fallback, public receipts, and future agent-task settlement.

The Circle sample guides the Phase 2 architecture direction: server-side API routes, Supabase product state, Circle Developer Controlled Wallets, OpenAI validation, webhooks, transaction records, and timeline updates. This repository does not copy Circle's UI, branding, embedded bytecode, or large source blocks.

## Current Architecture

- `contracts/`: Hardhat Solidity project for the Handsel agreement primitive.
- `contracts/contracts/HandselAgreement.sol`: USDC agreement contract using OpenZeppelin `SafeERC20` and `ReentrancyGuard`.
- `contracts/contracts/test/MockUSDC.sol`: local-test-only USDC mock with 6 decimals.
- `contracts/test/HandselAgreement.test.ts`: focused lifecycle and access-control tests.
- `contracts/scripts/deploy.ts`: Arc testnet deployment script.
- `frontend/`: React + Vite + TypeScript app using wagmi and viem for direct wallet calls.
- `frontend/src/lib/aiValidation.ts`: deterministic local MVP review seam for future OpenAI validation.
- `frontend/src/lib/timeline.ts`: timeline view-model helper.
- `frontend/src/lib/receipts.ts`: public receipt view-model helper.

Phase 1 intentionally keeps Vite and direct wallet transactions so the MVP remains working. Supabase, Circle, and OpenAI are documented as Phase 2 server-side integrations and are not required for local build.

## Smart Contract Flow

1. Client calls `createAgreement` with beneficiary, arbiter, amount, deadline, title, criteria, and metadata.
2. USDC is transferred from the client to the Handsel contract.
3. Beneficiary calls `acceptAgreement`.
4. Beneficiary calls `submitProof` with proof text, hash, or URI.
5. Client reviews the proof and calls `approveProof` to release USDC.
6. Client can use `releaseAgreement` as a manual release path while the agreement is active.
7. Client or beneficiary can open a dispute from active or submitted status.
8. Arbiter resolves disputed funds with a basis-point split.
9. Created or active agreements can be refunded after deadline.
10. Unaccepted agreements can be cancelled by the client.

The contract has no admin withdrawal function, no owner custody path, and no upgradeability in the MVP.

## Frontend Flow

- Dashboard shows total agreements, total USDC volume, completed count, disputed count, wallet agreements, and an Agent Task Mode preview.
- Create Agreement captures title, beneficiary, arbiter, USDC amount, deadline, acceptance criteria, and description or metadata URI.
- Agreement Detail shows parties, criteria, proof, timeline, AI-assisted local review, and role-aware actions.
- Submit Proof lets the beneficiary provide a URL or delivery note.
- Review Proof lets the client run a deterministic local recommendation before approving release.
- Public Receipt shows agreement status, parties, criteria, proof, amount, and review recommendation.

## Environment Variables

Minimum Phase 1 variables:

```bash
ARC_TESTNET_RPC_URL=
ARC_TESTNET_CHAIN_ID=
PRIVATE_KEY=
USDC_ADDRESS=
HANDSEL_CONTRACT_ADDRESS=

VITE_ARC_TESTNET_RPC_URL=
VITE_ARC_TESTNET_CHAIN_ID=
VITE_USDC_ADDRESS=
VITE_HANDSEL_CONTRACT_ADDRESS=
```

Future Phase 2 variables:

```bash
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

CIRCLE_API_KEY=
CIRCLE_ENTITY_SECRET=
CIRCLE_BLOCKCHAIN=ARC-TESTNET

OPENAI_API_KEY=

NEXT_PUBLIC_USDC_CONTRACT_ADDRESS=
NEXT_PUBLIC_HANDSEL_CONTRACT_ADDRESS=
```

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

Run the frontend:

```bash
pnpm dev
```

## Deploy to Arc Testnet

1. Set `ARC_TESTNET_RPC_URL`, `ARC_TESTNET_CHAIN_ID`, `PRIVATE_KEY`, and the official Arc testnet `USDC_ADDRESS`.
2. Compile:

```bash
pnpm --filter @handsel/contracts compile
```

3. Deploy:

```bash
pnpm --filter @handsel/contracts deploy:arc
```

4. Set `VITE_HANDSEL_CONTRACT_ADDRESS` and `NEXT_PUBLIC_HANDSEL_CONTRACT_ADDRESS` to the deployed address.

## Grant Alignment

Handsel demonstrates real-world economic activity on Arc testnet: structured service agreements, USDC commitment, proof submission, AI-assisted review, human approval, fallback dispute/refund flow, and public settlement receipts.

## Roadmap

- Phase 1: Working testnet MVP with direct wallet calls, HandselAgreement, local proof review, and receipt UI.
- Phase 2: Next.js API routes, Supabase persistence, Circle Developer Controlled Wallets, Circle webhooks, and OpenAI proof validation.
- Phase 3: SDK/API for marketplaces and AI-agent task settlement.

## Security and Compliance Notes

Handsel is a testnet MVP. It does not provide regulated escrow services, legal dispute adjudication, compliance screening, custody services, or production availability claims. Integrators are responsible for their own legal, regulatory, tax, operational, and counterparty-risk reviews before any production use.
