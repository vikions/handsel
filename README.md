# ArcEscrow

ArcEscrow is a grant-oriented MVP for a programmable USDC escrow protocol on Arc testnet. A client locks USDC into an escrow, a beneficiary accepts after seeing funded terms, the client releases funds after delivery, and a chosen arbiter can resolve disputes with transparent onchain settlement.

This is not a regulated legal escrow service or a replacement for licensed escrow providers. It is an open-source programmable payment guarantee primitive for small digital-service agreements, P2P service transactions, marketplace integrations, and future AI-agent-to-agent commerce on Arc testnet.

## Why Arc

Arc is EVM-compatible and designed around USDC-denominated activity. ArcEscrow uses that fit directly: deposits settle in ERC20 USDC, user-facing values are expressed in USDC, and the frontend is built around testnet configuration for an Arc deployment.

## Circle and USDC Alignment

The protocol uses USDC as the escrow asset instead of a custom token. That keeps the MVP focused on payment guarantees, settlement transparency, and composable service-commerce flows that can be integrated by marketplaces, small teams, and agents.

## Architecture

- `contracts/`: Hardhat Solidity project.
- `contracts/contracts/ArcEscrow.sol`: Escrow contract using OpenZeppelin `SafeERC20` and `ReentrancyGuard`.
- `contracts/contracts/test/MockUSDC.sol`: local-test-only ERC20 mock with 6 decimals.
- `contracts/scripts/deploy.ts`: Arc testnet deployment script.
- `contracts/test/ArcEscrow.test.ts`: TypeScript Hardhat tests.
- `frontend/`: React + Vite + TypeScript app using wagmi and viem.

The contract has no admin custody path, no upgradeability, and no owner-only withdrawal function.

## Contract Functions

- `createEscrow(beneficiary, arbiter, amount, deadline, metadataURI)`: locks USDC from the client and creates a funded escrow.
- `acceptEscrow(escrowId)`: beneficiary moves a created escrow to active.
- `releaseEscrow(escrowId)`: client releases all funds to the beneficiary.
- `openDispute(escrowId)`: client or beneficiary moves an active escrow to disputed.
- `resolveDispute(escrowId, clientBps, beneficiaryBps)`: arbiter splits funds; basis points must total `10000`.
- `refundExpired(escrowId)`: client or beneficiary refunds an expired created or active escrow to the client.
- `cancelUnaccepted(escrowId)`: client cancels an unaccepted escrow and receives funds back.

Read helpers include `getEscrow`, `getEscrowCount`, `getUserEscrowCount`, and `getUserEscrowIds`.

## Local Setup

Install dependencies:

```bash
pnpm install
```

Run contract tests:

```bash
pnpm test
```

Run the frontend:

```bash
pnpm dev
```

Build all packages:

```bash
pnpm build
```

## Environment

Root `.env.example` contains both contract and frontend variables. Vite also reads `frontend/.env`, and Hardhat reads `contracts/.env` plus root `.env`.

Contracts:

```bash
ARC_TESTNET_RPC_URL=
ARC_TESTNET_CHAIN_ID=
PRIVATE_KEY=
USDC_ADDRESS=
```

Frontend:

```bash
VITE_ARC_TESTNET_RPC_URL=
VITE_ARC_TESTNET_CHAIN_ID=
VITE_ARC_ESCROW_ADDRESS=
VITE_USDC_ADDRESS=
```

## Deploy to Arc Testnet

1. Set `ARC_TESTNET_RPC_URL`, `ARC_TESTNET_CHAIN_ID`, `PRIVATE_KEY`, and the official Arc testnet `USDC_ADDRESS`.
2. Compile contracts:

```bash
pnpm --filter @arc-escrow/contracts compile
```

3. Deploy:

```bash
pnpm --filter @arc-escrow/contracts deploy:arc
```

4. Copy the deployed `ArcEscrow` address into `frontend/.env` as `VITE_ARC_ESCROW_ADDRESS`.
5. Set `VITE_USDC_ADDRESS`, `VITE_ARC_TESTNET_RPC_URL`, and `VITE_ARC_TESTNET_CHAIN_ID`.

## Grant Milestones

Phase 1 delivers a working Arc testnet MVP: escrow contract, local test coverage, deployment script, and frontend flows for create, accept, release, dispute, resolve, refund, and cancel.

Phase 2 can add curated arbiters, event indexing, notifications, richer agreement metadata, and dispute evidence links.

Phase 3 can add an SDK/API for marketplaces and agent commerce, including programmatic escrow creation and settlement monitoring.

## Compliance-Conscious Disclaimer

ArcEscrow is open-source software for testnet demonstration and programmable payment guarantees. It does not provide legal escrow services, compliance screening, custody services, dispute adjudication as a regulated service, or mainnet availability claims. Integrators are responsible for their own legal, regulatory, tax, and counterparty-risk reviews before any production use.

## Future Roadmap

- Phase 1 testnet MVP.
- Phase 2 curated arbiters and notifications.
- Phase 3 SDK/API for marketplaces and agent commerce.
