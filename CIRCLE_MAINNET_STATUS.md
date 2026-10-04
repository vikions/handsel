# Circle integration status

Status as of 2026-10-04. HandselAgreement is deployed on Arc Mainnet. The project team completed an end-to-end agreement through a Circle passkey on the live app, including USDC commitment, worker proof and client-approved settlement. [Circle's wallet support table](https://developers.circle.com/wallets/supported-blockchains) lists Arc `ARC` / `ARC-TESTNET` with modular accounts. [Arc's network references](https://docs.arc.io/arc/references/connect-to-arc) and [contract addresses](https://docs.arc.io/arc/references/contract-addresses) define chain `5042` and the USDC interface.

| Integration | Status | Actual Handsel implementation / gate |
| --- | --- | --- |
| USDC settlement | MAINNET AGREEMENT COMPLETED | Immutable HandselAgreement at `0x51bfB2A08E7680786eD54a00eE4d915Bab6B3867` on chain `5042` uses official Arc USDC ERC20 `0x3600000000000000000000000000000000000000`. The project team completed a proof-based settlement. |
| Circle Modular Wallets (MSCA) | LIVE AGREEMENT FLOW | Browser passkey connector uses a production-domain Circle Client Key. The project team completed the agreement lifecycle through Circle passkey transactions; external EVM wallets are also supported. |
| Passkeys | REGISTRATION, LOGIN AND SETTLEMENT WORKING | WebAuthn registration and repeat login work on the live Mainnet app. An older Testnet passkey failed Mainnet verification; a new Mainnet passkey was used for the completed agreement. |
| Sponsored transactions / paymaster | ENABLED FOR CIRCLE USEROPS | The connector submits Circle UserOperations with `paymaster: true`. Actual fee sponsorship follows the production Circle policy for each operation. |
| Circle Contracts event monitors | OPTIONAL INGESTION PATH | [Circle's Create Event Monitor API](https://developers.circle.com/api-reference/contracts/smart-contract-platform/create-event-monitor) lists `ARC` and `ARC-TESTNET`. Handsel has a guarded monitor-setup script, while the live agreement timeline is indexed independently from Arc RPC logs. |
| Circle webhook signature verification | OPTIONAL INGESTION PATH | Backend verifies Circle signatures and accepts chain/contract-matched events. The core Mainnet payment flow and receipt indexing do not depend on Circle webhooks. |
| Circle Developer Controlled Wallets | ROADMAP | Not used by the deployed frontend/backend. No entity secret is needed for the current user-owned wallet flow. |
| Circle CCTP / Gateway / CPN / StableFX / Mint | ROADMAP | No such integrations in this repository; do not claim them. |
| OpenAI validation | ROADMAP | Current local keyword/URL proof checklist is deterministic and does not inspect linked artifacts. It never controls settlement. |

The Arc RPC indexer, Supabase activity tables, and Hardhat deploy/verify scripts are Handsel infrastructure, not Circle products. The testnet contract import in Circle Console does not itself prove that Circle Contracts APIs are used on mainnet. Re-check vendor support and billing before enabling any new Circle service.
