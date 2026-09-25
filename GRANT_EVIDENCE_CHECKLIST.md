# Circle grant evidence checklist

Do not fill placeholders with testnet data when claiming Arc Mainnet. Capture links and screenshots only after the corresponding action is real.

- [ ] Live app: https://www.archandsel.xyz/ and timestamped screenshot with Arc Mainnet shown.
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
- [ ] Railway `/health` shows chain `5042`, contract address, Supabase and indexer readiness (do not share secrets).
- [ ] Supabase queries show expected mainnet agreement/events and nonzero cursor; old testnet rows retained.
- [x] Local contract tests: 19 passing on 2026-09-26.
- [x] Local backend tests: 5 passing on 2026-09-26.
- [x] Local typecheck and full build: passed on 2026-09-26 (Vite chunk-size warning only).
- [x] Mainnet preflight with funded expected deployer: passed on 2026-09-26; balance was `1.003224` native USDC before deployment.
- [ ] Circle mainnet passkey and sponsored UserOperation: pending live smoke test; do not present as proven.
- [ ] Public architecture and current integration status: README and `CIRCLE_MAINNET_STATUS.md`.
