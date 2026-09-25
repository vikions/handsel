# Minimal-value Arc Mainnet smoke test

Run only after approved deployment, verified source, migration, and production configuration. Use distinct client, worker, and independent resolver wallets. Choose the smallest UI-supported agreement amount. Fund every transaction-sending wallet with native USDC for gas, unless Circle sponsorship has been confirmed on mainnet; fund the client with ERC20 USDC for the agreement. Never use testnet assets or share keys.

| Step | Actor | Write / contract function | USDC requirement | Expected evidence |
| --- | --- | --- | --- | --- |
| 1 | Client | `USDC.approve(HandselAgreement, amount)` | ERC20 allowance plus native gas or confirmed sponsorship | Successful approval tx, correct allowance |
| 2 | Client | `createAgreement(beneficiary, arbiter, amount, deadline, title, criteriaURI, metadataURI)` | Amount moves into contract; native gas or sponsorship | `AgreementCreated`, agreement ID, contract ERC20 balance increases |
| 3 | Worker | `acceptAgreement(id)` | Native gas or sponsorship | `AgreementAccepted`, status Active |
| 4 | Worker | `submitProof(id, proofURI)` | Native gas or sponsorship | `ProofSubmitted`, status Submitted; use a harmless public proof URL/text |
| 5 | Client | `approveProof(id)` | Native gas or sponsorship | `ProofApprovedAndReleased`, status Completed; worker ERC20 balance increases by amount |

Before step 1, record `getAgreementCount`, `totalVolume`, client/worker balances, and contract USDC address. After step 5, confirm dashboard metrics, role views, detail and receipt; check all transaction hashes/events in Arc explorer; confirm Railway `/health` shows chain 5042 and indexer enabled; query Supabase `agreements_index`, `agreement_events`, and `indexer_cursors` for chain 5042 plus the new contract. Wait for the configured confirmation buffer and indexing interval. The local proof checklist is advisory; inspect work manually before approval.

**Optional resolver scenario, not required for the initial grant update:** create a second smallest-value agreement, worker accepts/submits proof, client or worker calls `openDispute(id)`, then the independent resolver calls `resolveDispute(id, clientBps, beneficiaryBps)` with values summing to 10000. Verify split balances and `AgreementResolved`. This spends a separate amount and requires separate approval. The selected resolver is not a guaranteed legal arbiter.
