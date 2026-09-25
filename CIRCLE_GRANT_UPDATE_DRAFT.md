# Circle Developer Grant update draft

Use only after checking each claim against the final deployed product. Replace mainnet placeholders with real evidence before resubmission. Do not describe a prepared integration as live.

1. **One line:** Handsel is proof-based USDC settlement for real digital work on Arc.
2. **Product:** Clients set work criteria and commit USDC in an immutable agreement contract. Workers accept and submit proof. Clients approve release; a selected resolver can handle disputes, and expiry/cancellation provide fallback paths.
3. **Problem:** Freelance and service deals need a clear connection between deliverables, payment commitment, and verifiable settlement instead of informal screenshots or opaque status updates.
4. **Solution:** A proof-first agreement workflow with role-aware actions, onchain USDC custody and settlement, public receipts, and a queryable activity index. Human approval, not local automated review, controls funds.
5. **Why Arc:** Arc provides an EVM-compatible network with USDC-native gas and an official USDC ERC20 interface, allowing agreement accounting and fees in USDC terms.
6. **Why USDC:** The agreement locks and settles in a dollar-denominated digital asset. The contract stores amounts in six-decimal ERC20 USDC units.
7. **Progress since original application:** Proof-first contract lifecycle and tests; rebuilt agreement creation; client/worker/resolver views; receipts and analytics; Railway API; signed Circle webhook path for testnet; network-aware Supabase schema; resumable Arc RPC indexer; Arc Mainnet configuration and deployment safety tooling. See `CHANGELOG_SINCE_GRANT.md`.
8. **Mainnet status:** HandselAgreement was deployed at `0x51bfB2A08E7680786eD54a00eE4d915Bab6B3867` on chain `5042` in block `22724141`. [Deployment transaction](https://explorer.arc.io/tx/0x3556fcbea8c41c0c75a2aeb9fde699177bdeb0afa70e2296f371061fb11dc369); [exact-match verified source and ABI](https://explorer.arc.io/address/0x51bfB2A08E7680786eD54a00eE4d915Bab6B3867?tab=contract). A real mainnet agreement and production app switch are still pending; do not say the full app is live on mainnet yet.
9. **Circle integrations:** Official USDC is the settlement asset. Circle Modular Wallet passkey/MSCA connector and sponsored UserOperation path are implemented but require production credentials and mainnet transaction validation. Circle Contracts APIs list Arc Mainnet; Handsel has a guarded monitor setup script and signed webhook receiver, but no mainnet monitor or delivered event has been verified yet. Mainnet activity uses independent Arc RPC indexing by default. We do not use Developer Controlled Wallets, CCTP, or Circle Mint today.
10. **Architecture:** Solidity/Hardhat immutable HandselAgreement; React/Vite wagmi/viem frontend; Railway API; Supabase activity index. The contract is the settlement source of truth, not the database.
11. **Traction/usage:** [NEEDS HUMAN INPUT]. State separately what is testnet activity and what is real mainnet activity; do not invent users, revenue, or transaction volume.
12. **Open source:** https://github.com/vikions/handsel; license and final commit: [NEEDS HUMAN INPUT].
13. **Team:** [NEEDS HUMAN INPUT].
14. **Funding to date:** [NEEDS HUMAN INPUT].
15. **Grant use:** Independent contract/security review; reliability and incident response for indexing/receipts; accessible wallet onboarding; proof-storage and reviewer workflow improvements; measured user pilots.
16. **Milestones:** (1) Verified mainnet contract and minimal-value end-to-end settlement; (2) monitored production activity/receipts and reliability hardening; (3) wallet onboarding and carefully scoped pilot integrations, with human approval retained.
17. **Live URL:** https://www.archandsel.xyz/ (verify production config before presenting it as mainnet).
18. **GitHub URL:** https://github.com/vikions/handsel.
19. **Mainnet address:** `0x51bfB2A08E7680786eD54a00eE4d915Bab6B3867` (chain `5042`; same numerical address also exists on testnet chain `5042002`).
20. **Transaction evidence:** `0x3556fcbea8c41c0c75a2aeb9fde699177bdeb0afa70e2296f371061fb11dc369` (deployment only; settlement evidence pending).

Handsel is independent, not affiliated with or endorsed by Circle, and is not a regulated escrow or legal substitute. No claims about user traction, partnerships, or revenue should be added without records.
