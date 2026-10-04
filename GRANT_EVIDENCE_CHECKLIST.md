# Circle grant evidence checklist

Do not fill placeholders with testnet data when claiming Arc Mainnet. Capture links and screenshots only after the corresponding action is real.

- [x] Live app: https://www.archandsel.xyz/ read-only browser check showed Arc Mainnet and zero initial contract counts on 2026-09-26.
- [ ] Timestamped production screenshot with Arc Mainnet shown: [CAPTURE FOR SUBMISSION].
- [ ] GitHub repository: https://github.com/vikions/handsel and final commit hash: [NEEDS HUMAN INPUT].
- [x] Arc Mainnet contract (chain 5042): [0x51bfB2A08E7680786eD54a00eE4d915Bab6B3867](https://explorer.arc.io/address/0x51bfB2A08E7680786eD54a00eE4d915Bab6B3867).
- [x] [Verified explorer source (exact match), ABI and Read/Write tab](https://explorer.arc.io/address/0x51bfB2A08E7680786eD54a00eE4d915Bab6B3867?tab=contract), confirmed 2026-09-26.
- [x] [Deployment transaction](https://explorer.arc.io/tx/0x3556fcbea8c41c0c75a2aeb9fde699177bdeb0afa70e2296f371061fb11dc369), block `22724141`; read-only postdeploy checks passed.
- [ ] Real minimal-value agreement ID: [ADD AFTER SMOKE TEST].
- [ ] USDC approval transaction: [ADD AFTER SMOKE TEST].
- [ ] Agreement creation transaction: [ADD AFTER SMOKE TEST].
- [ ] Worker acceptance and proof transactions: [ADD AFTER SMOKE TEST].
- [ ] Approval/release transaction and ERC20 transfer evidence: [ADD AFTER SMOKE TEST].
- [ ] Dashboard analytics, role-aware activity, agreement detail and receipt screenshots with matching ID/network.
- [x] Railway `/health` shows chain `5042`, contract address, Supabase and indexer readiness (checked 2026-09-26; no secrets shared).
- [x] Supabase service-role reads confirmed the migrated tables and a mainnet indexer cursor (2026-09-26).
- [ ] Supabase agreement/event rows for a real mainnet agreement: [ADD AFTER SMOKE TEST]. No old Handsel tables existed in the restored project before migration.
- [x] Local contract tests: 19 passing on 2026-09-26.
- [x] Local backend tests: 5 passing on 2026-09-26.
- [x] Local typecheck and full build: passed on 2026-09-26 (Vite chunk-size warning only).
- [x] Mainnet preflight with funded expected deployer: passed on 2026-09-26; balance was `1.003224` native USDC before deployment.
- [x] Circle Mainnet passkey registration and repeat sign-in: tested on the live app on 2026-10-04; no transaction was sent.
- [ ] Circle-sponsored transaction evidence: add the UserOperation hash and onchain transaction link when documenting a payment flow.
- [ ] Public architecture and current integration status: README and `CIRCLE_MAINNET_STATUS.md`.
