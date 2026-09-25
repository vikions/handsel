# Circle integration status

Status as of 2026-09-26. HandselAgreement is deployed on Arc Mainnet, but no mainnet agreement, production wallet transaction, Circle monitor or delivered webhook is verified. [Circle's wallet support table](https://developers.circle.com/wallets/supported-blockchains) lists Arc `ARC` / `ARC-TESTNET` with modular accounts. [Arc's network references](https://docs.arc.io/arc/references/connect-to-arc) and [contract addresses](https://docs.arc.io/arc/references/contract-addresses) define chain `5042` and the USDC interface.

| Integration | Status | Actual Handsel implementation / gate |
| --- | --- | --- |
| USDC settlement | DEPLOYED; AGREEMENT SMOKE TEST PENDING | Immutable HandselAgreement at `0x51bfB2A08E7680786eD54a00eE4d915Bab6B3867` on chain `5042` uses official Arc USDC ERC20 `0x3600000000000000000000000000000000000000`. Deployment transaction succeeded; no mainnet agreement has settled yet. |
| Circle Modular Wallets (MSCA) | READY BUT REQUIRES PRODUCTION CREDENTIALS | Browser passkey connector and UserOperation path are implemented. Requires a production-domain Circle Client Key and mainnet end-to-end smoke test. External EVM wallets are also supported. |
| Passkeys | READY BUT REQUIRES PRODUCTION CREDENTIALS | WebAuthn registration/login via Circle Modular Wallet SDK; account persistence is network-separated locally. No mainnet transaction demonstrated yet. |
| Sponsored transactions / paymaster | READY BUT REQUIRES PRODUCTION CREDENTIALS | Connector requests `paymaster: true`; actual sponsorship depends on Circle account policy/balance and must be validated on mainnet. No zero-fee claim. |
| Circle Contracts event monitors | READY BUT REQUIRES PRODUCTION CREDENTIALS | [Circle's Create Event Monitor API](https://developers.circle.com/api-reference/contracts/smart-contract-platform/create-event-monitor) now lists `ARC` and `ARC-TESTNET`. Guarded setup script supports both, but no Handsel mainnet monitor/subscription has been created or proven here. Requires a mainnet API key, contract address, HTTPS webhook and separate approval. Arc RPC indexer remains independent. |
| Circle webhook signature verification | READY BUT REQUIRES PRODUCTION CREDENTIALS | Backend verifies Circle signature and accepts chain/contract-matched events on either network. It has not received a proven Handsel mainnet event; mainnet activity does not depend on it. |
| Circle Developer Controlled Wallets | ROADMAP | Not used by the deployed frontend/backend. No entity secret is needed for the current user-owned wallet flow. |
| Circle CCTP / Gateway / CPN / StableFX / Mint | ROADMAP | No such integrations in this repository; do not claim them. |
| OpenAI validation | ROADMAP | Current local keyword/URL proof checklist is deterministic and does not inspect linked artifacts. It never controls settlement. |

The Arc RPC indexer, Supabase activity tables, and Hardhat deploy/verify scripts are Handsel infrastructure, not Circle products. The testnet contract import in Circle Console does not itself prove that Circle Contracts APIs are used on mainnet. Re-check vendor support and billing before enabling any new Circle service.
