# Handsel

Handsel is a proof-based USDC agreement layer for freelance, service, and agent work on Arc.

The name comes from an old trade/legal term for a first installment or earnest money. The product follows that pattern: a client commits USDC around clear work criteria, the beneficiary submits proof, AI-assisted review can help evaluate delivery, and the client explicitly approves release.

Tagline: **Proof-based settlement for real work.**

Live app: **https://www.archandsel.xyz/**

Handsel is already deployed on Arc testnet with a working public app, a live smart contract, and end-to-end USDC agreement flows. It uses Circle's arc-escrow sample as technical inspiration, but is not affiliated with or endorsed by Circle.

Handsel is not a regulated escrow service or legal substitute. It is open-source software for Arc experimentation and grant evaluation.

## Why Arc and USDC

Arc is EVM-compatible and designed for USDC-denominated activity. Handsel uses ERC20 USDC as the settlement asset and presents amounts in USDC terms, which keeps the product focused on real payment workflows instead of custom token mechanics.

Arc is not a future integration for Handsel. It is the settlement layer Handsel is already built on.

## Live Arc Testnet Deployment

- Live app: **https://www.archandsel.xyz/**
- Network: **Arc Testnet**
- Chain ID: **5042002**
- RPC: **https://rpc.testnet.arc.network**
- Explorer: **https://testnet.arcscan.app**
- Handsel contract: **0x51bfB2A08E7680786eD54a00eE4d915Bab6B3867**
- USDC contract: **0x3600000000000000000000000000000000000000**

Explorer links:

- Handsel contract: <https://testnet.arcscan.app/address/0x51bfB2A08E7680786eD54a00eE4d915Bab6B3867>
- USDC contract: <https://testnet.arcscan.app/address/0x3600000000000000000000000000000000000000>

## Circle Reference

Circle's arc-escrow repository demonstrates a sample escrow workflow on Arc testnet. Handsel builds a differentiated product layer around proof-based freelance and service payments: structured work criteria, proof submission, AI-assisted review, explicit client approval, dispute fallback, public receipts, and agent-tested settlement flows.

The Circle sample helps guide future Circle developer platform integrations: Circle Wallets / Programmable Wallets, gas sponsorship where supported, server-side transaction records, webhooks, and AI-assisted validation. This repository does not copy Circle's UI, branding, embedded bytecode, or large source blocks.

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

The current product intentionally keeps Vite and direct wallet transactions so the live Arc testnet app remains simple, auditable, and easy to verify. Circle Wallets, gas sponsorship, Supabase persistence, and OpenAI-backed validation are planned product layers on top of the current onchain escrow flow.

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

- Overview shows live contract reads for total agreements, total USDC volume, clients, freelancers, completed count, disputed count, and recent onchain agreements.
- Dashboard shows wallet-specific agreements and user actions.
- Create Agreement captures title, beneficiary, arbiter, USDC amount, deadline, acceptance criteria, and description or metadata URI.
- Agreement Detail shows parties, criteria, proof, timeline, AI-assisted local review, and role-aware actions.
- Submit Proof lets the beneficiary provide a URL or delivery note.
- Review Proof lets the client run a deterministic local recommendation before approving release.
- Public Receipt shows agreement status, parties, criteria, proof, amount, and review recommendation.
- Landing page includes example agreement requests to communicate real-world use cases for small USDC service tasks.

## Environment Variables

Live frontend variables:

```bash
VITE_ARC_TESTNET_RPC_URL=https://rpc.testnet.arc.network
VITE_ARC_TESTNET_CHAIN_ID=5042002
VITE_USDC_ADDRESS=0x3600000000000000000000000000000000000000
VITE_HANDSEL_CONTRACT_ADDRESS=0x51bfB2A08E7680786eD54a00eE4d915Bab6B3867
```

The app still compiles without real credentials, but live contract reads and writes require the Arc testnet values above.

Deployment variables:

```bash
ARC_TESTNET_RPC_URL=https://rpc.testnet.arc.network
ARC_TESTNET_CHAIN_ID=5042002
PRIVATE_KEY=
USDC_ADDRESS=0x3600000000000000000000000000000000000000
HANDSEL_CONTRACT_ADDRESS=0x51bfB2A08E7680786eD54a00eE4d915Bab6B3867
```

Planned Circle / AI integration variables:

```bash
NEXT_PUBLIC_APP_URL=https://www.archandsel.xyz
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

CIRCLE_API_KEY=
CIRCLE_ENTITY_SECRET=
CIRCLE_BLOCKCHAIN=ARC-TESTNET

OPENAI_API_KEY=

NEXT_PUBLIC_USDC_CONTRACT_ADDRESS=0x3600000000000000000000000000000000000000
NEXT_PUBLIC_HANDSEL_CONTRACT_ADDRESS=0x51bfB2A08E7680786eD54a00eE4d915Bab6B3867
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

Run the local browser app:

```bash
pnpm dev
```

## Deployment and Smoke Test

Before changing the live deployment, verify locally:

```bash
pnpm --filter @handsel/contracts test
pnpm --filter @handsel/frontend build
pnpm build
```

For contract deployment or redeployment, set these values in a local `.env` file only:

```bash
ARC_TESTNET_RPC_URL=https://rpc.testnet.arc.network
ARC_TESTNET_CHAIN_ID=5042002
PRIVATE_KEY=
USDC_ADDRESS=0x3600000000000000000000000000000000000000
```

Do not commit private keys or real wallet credentials. The deployment script also checks that `ARC_TESTNET_RPC_URL`, `ARC_TESTNET_CHAIN_ID`, and `USDC_ADDRESS` are present before it can deploy.

Deploy or redeploy the contract:

```bash
pnpm --filter @handsel/contracts deploy:arc
```

After deployment, set the frontend environment to the deployed contract and USDC addresses. The current Arc testnet deployment uses:

```bash
VITE_ARC_TESTNET_RPC_URL=https://rpc.testnet.arc.network
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
3. Switch to the beneficiary wallet and accept.
4. Submit proof text or a proof URL.
5. Switch to the client wallet, run local AI-assisted review, and approve release.
6. Open the receipt page and confirm the final status and settlement summary.

## Grant Alignment

Handsel demonstrates real-world economic activity on Arc testnet: structured service agreements, USDC commitment, proof submission, AI-assisted review, human approval, fallback dispute/refund flow, public settlement receipts, and verifiable contract activity on Arcscan.

## Roadmap

- Current: Live Arc testnet deployment with a public app, deployed Handsel contract, USDC agreement creation, proof submission, client release, dispute resolution, public receipts, and onchain verification.
- Next: Production hardening for contract tests, frontend states, transaction visibility, receipts, error handling, and agreement lifecycle UX.
- AI-assisted review: Expand the local proof review seam into a stronger AI-assisted recommendation layer that compares criteria and submitted proof while keeping final settlement decisions in human hands.
- Circle developer platform: Research and integrate Circle Wallets / Programmable Wallets to reduce onboarding friction, plus Circle Gas Station where supported for sponsored transaction fees.
- Product expansion: Agreement templates, analytics, dispute workflow improvements, marketplace/API paths, and user onboarding for freelancers, agencies, creators, and small businesses.

## Security and Compliance Notes

Handsel is a testnet MVP. It does not provide regulated escrow services, legal dispute adjudication, compliance screening, custody services, or production availability claims. Integrators are responsible for their own legal, regulatory, tax, operational, and counterparty-risk reviews before any production use.
