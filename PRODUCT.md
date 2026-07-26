# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Clients and independent workers creating small proof-based service agreements, plus hackathon and grant reviewers evaluating real Arc testnet activity. A future audience includes marketplaces and autonomous agents settling task-based work.

## Product Purpose

Handsel lets a client define work, commit USDC, receive proof from a beneficiary, and explicitly approve settlement. Dispute, resolution, cancellation, and expiry refund paths provide fallback states.

## Positioning

Handsel is a proof-based USDC agreement layer for freelance, service, and future agent work on Arc. Its primary path is criteria first, proof submission second, and human-controlled release last.

## Operating Context

Users connect an EVM wallet, create an agreement with a beneficiary and arbiter, approve USDC, and submit onchain transactions on Arc testnet. Agreement status, proof, parties, timeline, and settlement receipts are visible in the web app.

## Capabilities and Constraints

- The current product is a Vite client using wagmi and viem for direct onchain interaction.
- The deployed Solidity contract holds USDC without an admin withdrawal or upgrade path.
- AI-assisted review is a deterministic local MVP recommendation; client approval controls release.
- Public analytics are derived from contract reads and events.
- The product is a testnet MVP, not a regulated escrow service or legal substitute.
- Circle Wallets, persistent server state, and server-side AI validation are roadmap items, not current capabilities.

## Brand Commitments

- Product name: Handsel.
- Tagline: Proof-based settlement for real work.
- Core line: Define the work. Hold the payment. Submit proof. Release on approval.
- Handsel is independent and is not affiliated with or endorsed by Circle.
- Avoid claims of mainnet readiness, guaranteed dispute resolution, legal replacement, or universal availability.

## Evidence on Hand

- Live app at `https://www.archandsel.xyz/`.
- Arc testnet contract at `0x51bfB2A08E7680786eD54a00eE4d915Bab6B3867`.
- Public analytics route at `https://www.archandsel.xyz/#/analytics`.
- Real contract lifecycle, tests, wallet interactions, proof submission, local review, and receipt UI exist in this repository.
- No testimonials, customer logos, production benchmarks, or mainnet evidence should be fabricated.

## Product Principles

1. Make the next agreement action obvious.
2. Show proof and settlement state before promotional explanation.
3. Keep AI advisory and human approval explicit.
4. Present onchain data in language ordinary clients and workers understand.
5. Preserve verifiable Arc activity and compliance-conscious claims.

## Accessibility & Inclusion

Core flows must work with keyboard navigation, visible focus, readable contrast, reduced motion preferences, and narrow mobile screens.
