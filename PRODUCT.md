# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Clients and independent workers creating proof-based service agreements, plus grant reviewers evaluating verifiable Arc activity. A future audience includes marketplaces and autonomous agents settling task-based work.

## Product Purpose

Handsel lets a client define work, commit USDC, receive proof from a beneficiary, and explicitly approve settlement. Dispute, resolution, cancellation, and expiry refund paths provide fallback states.

## Positioning

Handsel is proof-based USDC settlement for real digital work on Arc, where completed agreements become verifiable work history. Its primary path is criteria first, proof submission second, and human-controlled release last.

## Operating Context

Users connect an EVM wallet, create an agreement with a beneficiary and arbiter, approve USDC, and submit onchain transactions on Arc. Production targets Arc Mainnet; Arc Testnet remains available for development.

## Capabilities and Constraints

- The current product is a Vite client using wagmi and viem for direct onchain interaction.
- The deployed Solidity contract holds USDC without an admin withdrawal or upgrade path.
- AI-assisted review is a deterministic local MVP recommendation; client approval controls release.
- Public analytics are derived from contract reads and events.
- The product is not a regulated escrow service or legal substitute.
- Circle Modular Wallet/passkey support and sponsored user operations are network-aware. Mainnet passkey registration and repeat sign-in work on the live app. Circle Contracts event monitor APIs list Arc Mainnet, but a Handsel mainnet monitor/webhook has not been configured; Arc RPC indexing is the default.
- Supabase persistence and the Railway activity API use Arc RPC indexing on mainnet and separate records by chain and contract.
- Server-side OpenAI validation is not implemented; the current AI-assisted review is explicitly local and advisory.

## Brand Commitments

- Product name: Handsel.
- Tagline: Proof-based USDC settlement for real digital work.
- Core line: Agree. Prove. Settle. Build a work history.
- Handsel is independent and is not affiliated with or endorsed by Circle.
- Avoid claims of guaranteed dispute resolution, legal replacement, or universal availability.

## Evidence on Hand

- Live app at `https://www.archandsel.xyz/`.
- Arc Testnet and Arc Mainnet contracts both exist at `0x51bfB2A08E7680786eD54a00eE4d915Bab6B3867` on their respective chains. The mainnet deployment is recorded in `deployments/arc-mainnet.json`; passkey onboarding works on the live app.
- Public analytics route at `https://www.archandsel.xyz/#/analytics`.
- Public wallet Work Passport route at `https://www.archandsel.xyz/#/profile/<wallet>`.
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
