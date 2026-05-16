import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Brain,
  CheckCircle,
  ClockCountdown,
  Copy,
  FileText,
  Handshake,
  Plus,
  Receipt,
  Scales,
  ShieldCheck,
  UploadSimple,
  Wallet,
  WarningCircle,
  XCircle,
} from "@phosphor-icons/react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useAccount,
  useConnect,
  useDisconnect,
  usePublicClient,
  useReadContract,
  useReadContracts,
  useWriteContract,
} from "wagmi";
import { formatUnits, isAddress, parseUnits, zeroAddress, type Address, type Hash } from "viem";
import { handselAddress, configIssues, contractsConfigured, usdcAddress, usdcDecimals } from "./lib/config";
import { handselAbi, erc20Abi } from "./lib/abi";
import {
  loadValidationResult,
  saveValidationResult,
  validateProof,
  type ValidationResult,
} from "./lib/aiValidation";
import { buildTimeline } from "./lib/timeline";
import { buildReceipt } from "./lib/receipts";

const statusLabels = [
  "Created",
  "Active",
  "Submitted",
  "Completed",
  "Disputed",
  "Resolved",
  "Refunded",
  "Cancelled",
] as const;

type Route =
  | { page: "dashboard" }
  | { page: "create" }
  | { page: "detail"; agreementId: bigint }
  | { page: "receipt"; agreementId: bigint };

type AgreementRecord = {
  id: bigint;
  client: Address;
  beneficiary: Address;
  arbiter: Address;
  amount: bigint;
  deadline: bigint;
  title: string;
  criteriaURI: string;
  metadataURI: string;
  proofURI: string;
  status: number;
  createdAt: bigint;
  acceptedAt: bigint;
  submittedAt: bigint;
  completedAt: bigint;
};

type ReadRow = {
  result?: unknown;
  error?: Error;
};

type TxState = {
  label: string;
  hash?: Hash;
  error?: string;
  success?: string;
};

type HandselWriteFunction =
  | "acceptAgreement"
  | "submitProof"
  | "approveProof"
  | "releaseAgreement"
  | "openDispute"
  | "resolveDispute"
  | "refundExpired"
  | "cancelUnaccepted";

type WriteRequest = Parameters<ReturnType<typeof useWriteContract>["writeContractAsync"]>[0];

export function App() {
  const route = useHashRoute();

  return (
    <div className="app-shell">
      <div className="background-grid" aria-hidden="true" />
      <TestnetBanner />
      <Header route={route} />
      <main className="page-frame">
        <ConfigWarning />
        {route.page === "dashboard" ? <Dashboard /> : null}
        {route.page === "create" ? <CreateAgreementPage /> : null}
        {route.page === "detail" ? <AgreementDetailPage agreementId={route.agreementId} /> : null}
        {route.page === "receipt" ? <ReceiptPage agreementId={route.agreementId} /> : null}
      </main>
    </div>
  );
}

function useHashRoute(): Route {
  const [hash, setHash] = useState(() => window.location.hash || "#/");

  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash || "#/");
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const normalized = hash.replace(/^#/, "") || "/";
  if (normalized === "/create") return { page: "create" };
  if (normalized.startsWith("/agreements/")) {
    return routeWithId(normalized.replace("/agreements/", ""), "detail");
  }
  if (normalized.startsWith("/receipts/")) {
    return routeWithId(normalized.replace("/receipts/", ""), "receipt");
  }
  return { page: "dashboard" };
}

function routeWithId(value: string, page: "detail" | "receipt"): Route {
  try {
    const agreementId = BigInt(value);
    return page === "detail" ? { page: "detail", agreementId } : { page: "receipt", agreementId };
  } catch {
    return { page: "dashboard" };
  }
}

function Header({ route }: { route: Route }) {
  return (
    <header className="topbar">
      <a className="brand" href="#/">
        <span className="brand-mark">
          <ShieldCheck size={20} weight="duotone" />
        </span>
        <span>Handsel</span>
      </a>
      <nav className="nav-links" aria-label="Primary navigation">
        <a className={route.page === "dashboard" ? "active" : ""} href="#/">
          Dashboard
        </a>
        <a className={route.page === "create" ? "active" : ""} href="#/create">
          Create
        </a>
      </nav>
      <ConnectButton />
    </header>
  );
}

function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { connectors, connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const connector = connectors[0];

  return (
    <button
      className="wallet-button"
      type="button"
      onClick={() => {
        if (isConnected) {
          disconnect();
          return;
        }
        if (connector) connect({ connector });
      }}
    >
      <Wallet size={18} weight="duotone" />
      <span>{isConnected && address ? formatAddress(address) : isPending ? "Connecting" : "Connect Wallet"}</span>
    </button>
  );
}

function TestnetBanner() {
  return (
    <div className="testnet-banner">
      <span>Handsel testnet MVP</span>
      <span>Proof-based settlement for real work.</span>
    </div>
  );
}

function ConfigWarning() {
  if (contractsConfigured) return null;

  return (
    <section className="notice-panel">
      <WarningCircle size={20} weight="duotone" />
      <div>
        <strong>Configuration needed</strong>
        <p>Set the Arc testnet RPC, chain id, Handsel contract address, and USDC token address before live reads or writes.</p>
        <ul>
          {configIssues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Dashboard() {
  const stats = useReadContracts({
    contracts: [
      { address: handselAddress, abi: handselAbi, functionName: "getAgreementCount" },
      { address: handselAddress, abi: handselAbi, functionName: "totalVolume" },
      { address: handselAddress, abi: handselAbi, functionName: "completedAgreements" },
      { address: handselAddress, abi: handselAbi, functionName: "disputedAgreements" },
    ],
    query: { enabled: contractsConfigured },
  });

  const totalAgreements = readBigInt(stats.data, 0);
  const totalVolume = readBigInt(stats.data, 1);
  const completed = readBigInt(stats.data, 2);
  const disputed = readBigInt(stats.data, 3);

  return (
    <div className="dashboard-grid">
      <section className="hero-panel">
        <div className="eyebrow">Programmable payment guarantee layer</div>
        <h1>USDC agreements that release when work is proven.</h1>
        <p>Define the work. Hold the payment. Submit proof. Release on approval.</p>
        <p className="muted-copy">
          AI-assisted review helps evaluate proof, but the client controls final approval.
        </p>
        <div className="hero-actions">
          <a className="primary-link" href="#/create">
            <Plus size={18} weight="bold" />
            Create agreement
          </a>
          <a className="secondary-link" href="#user-agreements">
            View agreements
            <ArrowRight size={18} weight="bold" />
          </a>
        </div>
      </section>

      <section className="stats-panel" aria-label="Protocol stats">
        <Metric label="Total agreements" value={totalAgreements.toString()} loading={stats.isLoading} />
        <Metric label="Total volume" value={formatUsdc(totalVolume)} loading={stats.isLoading} />
        <Metric label="Completed" value={completed.toString()} loading={stats.isLoading} />
        <Metric label="Disputed" value={disputed.toString()} loading={stats.isLoading} />
        {stats.error ? <InlineError message={stats.error.message} /> : null}
      </section>

      <section className="agent-panel">
        <div className="panel-icon">
          <Handshake size={24} weight="duotone" />
        </div>
        <div>
          <h2>Agent Task Mode</h2>
          <p>Built as an independent testnet MVP on Arc. Designed for freelance work, service deals, and future agent tasks.</p>
        </div>
      </section>

      <section className="activity-panel" id="user-agreements">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Wallet activity</span>
            <h2>Your agreements</h2>
          </div>
          <a className="text-link" href="#/create">
            New agreement
            <ArrowRight size={16} weight="bold" />
          </a>
        </div>
        <UserAgreements />
      </section>
    </div>
  );
}

function Metric({ label, value, loading }: { label: string; value: string; loading?: boolean }) {
  return (
    <div className="metric">
      <span>{label}</span>
      {loading ? <div className="skeleton metric-skeleton" /> : <strong>{value}</strong>}
    </div>
  );
}

function UserAgreements() {
  const { address, isConnected } = useAccount();

  const userIdsRead = useReadContract({
    address: handselAddress,
    abi: handselAbi,
    functionName: "getUserAgreementIds",
    args: [address ?? zeroAddress, 0n, 25n],
    query: { enabled: contractsConfigured && isConnected && Boolean(address) },
  });

  const ids = useMemo(() => (Array.isArray(userIdsRead.data) ? userIdsRead.data : []), [userIdsRead.data]);

  const agreementsRead = useReadContracts({
    contracts: ids.map((id) => ({
      address: handselAddress,
      abi: handselAbi,
      functionName: "getAgreement",
      args: [id],
    })),
    query: { enabled: contractsConfigured && ids.length > 0 },
  });

  const agreements = useMemo(
    () =>
      (agreementsRead.data ?? [])
        .map((row, index) => normalizeAgreement((row as ReadRow).result, ids[index]))
        .filter((agreement): agreement is AgreementRecord => Boolean(agreement)),
    [agreementsRead.data, ids],
  );

  if (!isConnected) {
    return <EmptyState title="Connect a wallet" body="Client, beneficiary, and arbiter agreements will appear here." />;
  }

  if (userIdsRead.isLoading || agreementsRead.isLoading) return <AgreementListSkeleton />;

  if (userIdsRead.error || agreementsRead.error) {
    return <InlineError message={(userIdsRead.error ?? agreementsRead.error)?.message ?? "Unable to load agreements."} />;
  }

  if (agreements.length === 0) {
    return <EmptyState title="No agreements yet" body="Create a proof-based service agreement or connect a participant wallet." />;
  }

  return (
    <div className="agreement-list">
      {agreements.map((agreement) => (
        <a className="agreement-row" href={`#/agreements/${agreement.id.toString()}`} key={agreement.id.toString()}>
          <div>
            <span className={`status-pill status-${statusLabels[agreement.status]?.toLowerCase() ?? "unknown"}`}>
              {statusLabels[agreement.status] ?? "Unknown"}
            </span>
            <strong>{agreement.title || `Agreement #${agreement.id.toString()}`}</strong>
            <p>{agreement.criteriaURI || agreement.metadataURI || "No criteria supplied"}</p>
          </div>
          <div className="row-amount">
            <strong>{formatUsdc(agreement.amount)}</strong>
            <span>Deadline {formatDate(agreement.deadline)}</span>
          </div>
        </a>
      ))}
    </div>
  );
}

function CreateAgreementPage() {
  const { address, isConnected } = useAccount();
  const queryClient = useQueryClient();
  const { run, isPending, txState } = useTxRunner();
  const [title, setTitle] = useState("Landing page implementation");
  const [beneficiary, setBeneficiary] = useState("");
  const [arbiter, setArbiter] = useState("");
  const [amount, setAmount] = useState("100");
  const [deadline, setDeadline] = useState(defaultDeadlineInput);
  const [criteriaURI, setCriteriaURI] = useState("Responsive landing page with deployed URL, source PR, and basic QA notes.");
  const [metadataURI, setMetadataURI] = useState("Proof-based service agreement for a small digital delivery.");
  const parsedAmount = parseUsdcAmount(amount);

  const allowanceRead = useReadContract({
    address: usdcAddress,
    abi: erc20Abi,
    functionName: "allowance",
    args: [address ?? zeroAddress, handselAddress],
    query: { enabled: contractsConfigured && isConnected && Boolean(address) },
  });

  const balanceRead = useReadContract({
    address: usdcAddress,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [address ?? zeroAddress],
    query: { enabled: contractsConfigured && isConnected && Boolean(address) },
  });

  const allowance = typeof allowanceRead.data === "bigint" ? allowanceRead.data : 0n;
  const balance = typeof balanceRead.data === "bigint" ? balanceRead.data : 0n;
  const needsApproval = parsedAmount !== null && allowance < parsedAmount;
  const formError = validateCreateForm({ arbiter, amount: parsedAmount, beneficiary, criteriaURI, deadline, title });

  async function approve() {
    if (parsedAmount === null) return;
    await run("Approving USDC", {
      address: usdcAddress,
      abi: erc20Abi,
      functionName: "approve",
      args: [handselAddress, parsedAmount],
    });
    await queryClient.invalidateQueries();
  }

  async function createAgreement() {
    if (parsedAmount === null || formError) return;
    const deadlineSeconds = BigInt(Math.floor(new Date(deadline).getTime() / 1000));
    const hash = await run("Creating agreement", {
      address: handselAddress,
      abi: handselAbi,
      functionName: "createAgreement",
      args: [
        beneficiary as Address,
        arbiter as Address,
        parsedAmount,
        deadlineSeconds,
        title.trim(),
        criteriaURI.trim(),
        metadataURI.trim(),
      ],
    });
    if (hash) window.location.hash = "#/";
  }

  return (
    <div className="form-layout">
      <section className="form-copy">
        <span className="eyebrow">Create agreement</span>
        <h1>Lock payment around clear work criteria.</h1>
        <p>
          Handsel creates a proof-based service agreement on Arc testnet. The beneficiary submits proof before the
          client releases USDC.
        </p>
        <div className="balance-strip">
          <span>Wallet balance</span>
          <strong>{formatUsdc(balance)}</strong>
        </div>
      </section>

      <section className="form-panel">
        <Field label="Agreement title" helper="A concise work label for dashboard and receipts.">
          <input value={title} onChange={(event) => setTitle(event.target.value)} />
        </Field>
        <Field label="Beneficiary address" helper="Freelancer or service wallet that can submit proof and receive release.">
          <input value={beneficiary} onChange={(event) => setBeneficiary(event.target.value)} placeholder="0x..." />
        </Field>
        <Field label="Arbiter address" helper="Fallback resolver wallet for disputed agreements.">
          <input value={arbiter} onChange={(event) => setArbiter(event.target.value)} placeholder="0x..." />
        </Field>
        <div className="form-grid">
          <Field label="Amount" helper="USDC amount, using 6 decimals.">
            <input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
          </Field>
          <Field label="Deadline" helper="Refunds open after this time if the agreement is still created or active.">
            <input type="datetime-local" value={deadline} onChange={(event) => setDeadline(event.target.value)} />
          </Field>
        </div>
        <Field label="Acceptance criteria" helper="Plain text, hash, or URI describing what proof should show.">
          <textarea value={criteriaURI} onChange={(event) => setCriteriaURI(event.target.value)} rows={4} />
        </Field>
        <Field label="Description or metadata URI" helper="Optional context for the agreement and public receipt.">
          <textarea value={metadataURI} onChange={(event) => setMetadataURI(event.target.value)} rows={3} />
        </Field>

        {formError ? <InlineError message={formError} /> : null}
        {parsedAmount !== null && parsedAmount > balance ? <InlineError message="Wallet USDC balance is below amount." /> : null}
        <TxStatus state={txState} />

        <div className="action-strip">
          <button
            className="secondary-button"
            disabled={!contractsConfigured || !isConnected || !needsApproval || Boolean(formError) || isPending}
            type="button"
            onClick={approve}
          >
            <ShieldCheck size={18} weight="duotone" />
            {needsApproval ? "Approve USDC" : "Approved"}
          </button>
          <button
            className="primary-button"
            disabled={!contractsConfigured || !isConnected || needsApproval || Boolean(formError) || isPending}
            type="button"
            onClick={createAgreement}
          >
            <Plus size={18} weight="bold" />
            Create agreement
          </button>
        </div>
      </section>
    </div>
  );
}

function AgreementDetailPage({ agreementId }: { agreementId: bigint }) {
  const agreementRead = useAgreementRead(agreementId);
  const agreement = useMemo(() => normalizeAgreement(agreementRead.data, agreementId), [agreementRead.data, agreementId]);

  if (agreementRead.isLoading) return <DetailSkeleton />;
  if (agreementRead.error) return <InlineError message={agreementRead.error.message} />;
  if (!agreement) return <EmptyState title="Agreement not found" body="Check the id and contract address." />;

  return <AgreementDetail agreement={agreement} />;
}

function AgreementDetail({ agreement }: { agreement: AgreementRecord }) {
  const { address, isConnected } = useAccount();
  const { run, isPending, txState } = useTxRunner();
  const [proofURI, setProofURI] = useState(agreement.proofURI);
  const [clientBps, setClientBps] = useState("5000");
  const [validation, setValidation] = useState<ValidationResult | null>(() => loadValidationResult(agreement.id));

  useEffect(() => {
    setProofURI(agreement.proofURI);
    setValidation(loadValidationResult(agreement.id));
  }, [agreement.id, agreement.proofURI]);

  const beneficiaryBps = 10_000 - Number(clientBps || 0);
  const connected = (address ?? "").toLowerCase();
  const isClient = connected === agreement.client.toLowerCase();
  const isBeneficiary = connected === agreement.beneficiary.toLowerCase();
  const isArbiter = connected === agreement.arbiter.toLowerCase();
  const isParty = isClient || isBeneficiary;
  const expired = Number(agreement.deadline) * 1000 < Date.now();
  const isSettled = agreement.status === 3 || agreement.status === 5;
  const timeline = buildTimeline(agreement, validation);

  async function callAgreement(label: string, functionName: HandselWriteFunction, args: readonly unknown[]) {
    await run(label, {
      address: handselAddress,
      abi: handselAbi,
      functionName,
      args,
    } as WriteRequest);
  }

  async function submitProof() {
    await callAgreement("Submitting proof", "submitProof", [agreement.id, proofURI.trim()]);
  }

  function runReview() {
    const result = validateProof({
      title: agreement.title,
      criteria: agreement.criteriaURI,
      proof: agreement.proofURI || proofURI,
    });
    saveValidationResult(agreement.id, result);
    setValidation(result);
  }

  async function resolveDispute() {
    const clientShare = Number(clientBps);
    if (!Number.isInteger(clientShare) || clientShare < 0 || clientShare > 10_000 || beneficiaryBps < 0) return;
    await callAgreement("Resolving dispute", "resolveDispute", [agreement.id, clientShare, beneficiaryBps]);
  }

  return (
    <div className="detail-layout">
      <section className="detail-main">
        <a className="back-link" href="#/">
          <ArrowRight size={16} weight="bold" />
          Dashboard
        </a>
        <div className="detail-title">
          <div>
            <span className={`status-pill status-${statusLabels[agreement.status]?.toLowerCase() ?? "unknown"}`}>
              {statusLabels[agreement.status] ?? "Unknown"}
            </span>
            <h1>{agreement.title || `Agreement #${agreement.id.toString()}`}</h1>
          </div>
          <strong>{formatUsdc(agreement.amount)}</strong>
        </div>

        <div className="detail-grid">
          <DetailItem label="Client" value={agreement.client} copy />
          <DetailItem label="Beneficiary" value={agreement.beneficiary} copy />
          <DetailItem label="Arbiter" value={agreement.arbiter} copy />
          <DetailItem label="Deadline" value={formatDate(agreement.deadline)} />
          <DetailItem label="Created" value={formatDate(agreement.createdAt)} />
          <DetailItem label="Submitted" value={agreement.submittedAt > 0n ? formatDate(agreement.submittedAt) : "No proof yet"} />
        </div>

        <section className="metadata-panel">
          <span className="eyebrow">Acceptance criteria</span>
          <p>{agreement.criteriaURI || "No criteria supplied."}</p>
        </section>

        <section className="metadata-panel">
          <span className="eyebrow">Proof submission</span>
          <p>{agreement.proofURI || "No proof has been submitted yet."}</p>
        </section>

        <section className="metadata-panel">
          <span className="eyebrow">Timeline</span>
          <div className="timeline-list">
            {timeline.map((event) => (
              <div className={event.complete ? "timeline-item complete" : "timeline-item"} key={event.label}>
                <span />
                <div>
                  <strong>{event.label}</strong>
                  <p>{event.detail}</p>
                  {event.timestamp ? <small>{typeof event.timestamp === "bigint" ? formatDate(event.timestamp) : formatIso(event.timestamp)}</small> : null}
                </div>
              </div>
            ))}
          </div>
        </section>

        {isSettled ? <SettlementReceiptSummary agreement={agreement} validation={validation} /> : null}
      </section>

      <aside className="actions-panel">
        <div className="section-heading compact">
          <div>
            <span className="eyebrow">Actions</span>
            <h2>Proof-first settlement</h2>
          </div>
        </div>
        {!isConnected ? <InlineError message="Connect a wallet to perform agreement actions." /> : null}

        {agreement.status === 0 && isBeneficiary ? (
          <ActionButton icon={<CheckCircle size={18} weight="duotone" />} disabled={isPending} onClick={() => callAgreement("Accepting agreement", "acceptAgreement", [agreement.id])}>
            Accept agreement
          </ActionButton>
        ) : null}

        {agreement.status === 1 && isBeneficiary ? (
          <div className="proof-panel">
            <Field label="Proof text or URL" helper="GitHub PR, deployed site, Figma, document, image, video, or delivery notes.">
              <textarea value={proofURI} onChange={(event) => setProofURI(event.target.value)} rows={4} />
            </Field>
            <ActionButton icon={<UploadSimple size={18} weight="duotone" />} disabled={isPending || proofURI.trim().length < 10} onClick={submitProof}>
              Submit proof
            </ActionButton>
          </div>
        ) : null}

        {agreement.status === 2 ? (
          <div className="review-panel">
            <div className={`recommendation recommendation-${validation?.recommendation ?? "empty"}`}>
              <Brain size={18} weight="duotone" />
              <div>
                <strong>{validation ? validation.recommendation.replace("_", " ") : "Not reviewed"}</strong>
                <p>{validation?.summary ?? "Run local MVP review before final client approval."}</p>
              </div>
            </div>
            <p className="review-note">AI-assisted review is a local MVP recommendation. Client approval controls release.</p>
            {isClient ? (
              <>
                <ActionButton icon={<Brain size={18} weight="duotone" />} disabled={isPending} onClick={runReview}>
                  Run AI-assisted review
                </ActionButton>
                <ActionButton icon={<CheckCircle size={18} weight="duotone" />} disabled={isPending} onClick={() => callAgreement("Approving proof", "approveProof", [agreement.id])}>
                  Approve and release
                </ActionButton>
              </>
            ) : null}
          </div>
        ) : null}

        {agreement.status === 1 && isClient ? (
          <ActionButton icon={<CheckCircle size={18} weight="duotone" />} disabled={isPending} onClick={() => callAgreement("Manual release", "releaseAgreement", [agreement.id])}>
            Manual release
          </ActionButton>
        ) : null}

        {agreement.status === 0 && isClient ? (
          <ActionButton icon={<XCircle size={18} weight="duotone" />} disabled={isPending} onClick={() => callAgreement("Cancelling agreement", "cancelUnaccepted", [agreement.id])}>
            Cancel unaccepted
          </ActionButton>
        ) : null}

        {(agreement.status === 1 || agreement.status === 2) && isParty ? (
          <ActionButton icon={<Scales size={18} weight="duotone" />} disabled={isPending} onClick={() => callAgreement("Opening dispute", "openDispute", [agreement.id])}>
            Open dispute
          </ActionButton>
        ) : null}

        {(agreement.status === 0 || agreement.status === 1) && isParty ? (
          <ActionButton
            icon={<ClockCountdown size={18} weight="duotone" />}
            disabled={isPending || !expired}
            onClick={() => callAgreement("Refunding expired agreement", "refundExpired", [agreement.id])}
          >
            Refund expired
          </ActionButton>
        ) : null}

        {agreement.status === 4 && isArbiter ? (
          <div className="resolve-panel">
            <Field label="Client bps" helper={`Beneficiary receives ${beneficiaryBps.toLocaleString()} bps.`}>
              <input value={clientBps} inputMode="numeric" onChange={(event) => setClientBps(event.target.value)} />
            </Field>
            <ActionButton icon={<Scales size={18} weight="duotone" />} disabled={isPending || beneficiaryBps < 0} onClick={resolveDispute}>
              Resolve dispute
            </ActionButton>
          </div>
        ) : null}

        {isSettled ? (
          <a className="receipt-link" href={`#/receipts/${agreement.id.toString()}`}>
            <Receipt size={18} weight="duotone" />
            Public receipt
          </a>
        ) : null}
        <TxStatus state={txState} />
      </aside>
    </div>
  );
}

function SettlementReceiptSummary({
  agreement,
  validation,
}: {
  agreement: AgreementRecord;
  validation: ValidationResult | null;
}) {
  const receipt = buildReceipt(
    {
      id: agreement.id,
      client: agreement.client,
      beneficiary: agreement.beneficiary,
      arbiter: agreement.arbiter,
      amountLabel: formatUsdc(agreement.amount),
      title: agreement.title,
      criteriaURI: agreement.criteriaURI,
      proofURI: agreement.proofURI,
      statusLabel: statusLabels[agreement.status] ?? "Unknown",
    },
    validation,
  );

  return (
    <section className="metadata-panel receipt-summary">
      <div className="section-heading compact">
        <div>
          <span className="eyebrow">Receipt</span>
          <h2>{receipt.heading}</h2>
        </div>
        <a className="text-link" href={`#/receipts/${agreement.id.toString()}`}>
          Open receipt
          <ArrowRight size={16} weight="bold" />
        </a>
      </div>
      <div className="receipt-grid compact-grid">
        <DetailItem label="Status" value={receipt.status} />
        <DetailItem label="Amount" value={formatUsdc(agreement.amount)} />
        <DetailItem label="AI recommendation" value={validation?.recommendation.replace("_", " ") ?? "Not reviewed"} />
      </div>
    </section>
  );
}

function ReceiptPage({ agreementId }: { agreementId: bigint }) {
  const agreementRead = useAgreementRead(agreementId);
  const agreement = useMemo(() => normalizeAgreement(agreementRead.data, agreementId), [agreementRead.data, agreementId]);
  const validation = useMemo(() => loadValidationResult(agreementId), [agreementId]);

  if (agreementRead.isLoading) return <DetailSkeleton />;
  if (agreementRead.error) return <InlineError message={agreementRead.error.message} />;
  if (!agreement) return <EmptyState title="Receipt not found" body="Check the id and contract address." />;

  const receipt = buildReceipt(
    {
      id: agreement.id,
      client: agreement.client,
      beneficiary: agreement.beneficiary,
      arbiter: agreement.arbiter,
      amountLabel: formatUsdc(agreement.amount),
      title: agreement.title,
      criteriaURI: agreement.criteriaURI,
      proofURI: agreement.proofURI,
      statusLabel: statusLabels[agreement.status] ?? "Unknown",
    },
    validation,
  );

  return (
    <section className="receipt-panel">
      <a className="back-link" href={`#/agreements/${agreement.id.toString()}`}>
        <ArrowRight size={16} weight="bold" />
        Agreement
      </a>
      <div className="detail-title">
        <div>
          <span className={`status-pill status-${receipt.status.toLowerCase()}`}>{receipt.status}</span>
          <h1>{receipt.heading}</h1>
        </div>
        <strong>{formatUsdc(agreement.amount)}</strong>
      </div>
      <p className="muted-copy">
        Public status view for a proof-based service agreement. This testnet receipt is a product record, not a legal
        settlement document.
      </p>
      <div className="receipt-grid">
        {receipt.parties.map((item) => (
          <DetailItem key={item.label} label={item.label} value={item.value} copy />
        ))}
        {receipt.facts.map((item) => (
          <DetailItem key={item.label} label={item.label} value={item.value} />
        ))}
      </div>
    </section>
  );
}

function useAgreementRead(agreementId: bigint) {
  return useReadContract({
    address: handselAddress,
    abi: handselAbi,
    functionName: "getAgreement",
    args: [agreementId],
    query: { enabled: contractsConfigured },
  });
}

function ActionButton({
  children,
  disabled,
  icon,
  onClick,
}: {
  children: string;
  disabled?: boolean;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button className="action-button" disabled={disabled} onClick={onClick} type="button">
      {icon}
      {children}
    </button>
  );
}

function DetailItem({ label, value, copy }: { label: string; value: string; copy?: boolean }) {
  return (
    <div className="detail-item">
      <span>{label}</span>
      <strong>{copy ? formatAddress(value as Address) : value}</strong>
      {copy ? (
        <button className="icon-button" type="button" onClick={() => navigator.clipboard.writeText(value)} aria-label={`Copy ${label}`}>
          <Copy size={15} weight="bold" />
        </button>
      ) : null}
    </div>
  );
}

function Field({ children, helper, label }: { children: React.ReactNode; helper?: string; label: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {helper ? <small>{helper}</small> : null}
    </label>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="empty-state">
      <div className="panel-icon">
        <FileText size={22} weight="duotone" />
      </div>
      <strong>{title}</strong>
      <p>{body}</p>
    </div>
  );
}

function InlineError({ message }: { message: string }) {
  return (
    <div className="inline-error">
      <WarningCircle size={18} weight="duotone" />
      <span>{message}</span>
    </div>
  );
}

function TxStatus({ state }: { state?: TxState }) {
  if (!state) return null;
  if (state.error) return <InlineError message={state.error} />;

  return (
    <div className="tx-status">
      <CheckCircle size={18} weight="duotone" />
      <div>
        <strong>{state.success ?? state.label}</strong>
        {state.hash ? <span>{formatAddress(state.hash)}</span> : null}
      </div>
    </div>
  );
}

function AgreementListSkeleton() {
  return (
    <div className="agreement-list">
      {[0, 1, 2].map((item) => (
        <div className="agreement-row skeleton-row" key={item}>
          <div>
            <div className="skeleton short" />
            <div className="skeleton medium" />
          </div>
          <div className="skeleton amount" />
        </div>
      ))}
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="detail-layout">
      <section className="detail-main">
        <div className="skeleton title" />
        <div className="skeleton wide" />
        <div className="detail-grid">
          {[0, 1, 2, 3, 4, 5].map((item) => (
            <div className="skeleton detail-skeleton" key={item} />
          ))}
        </div>
      </section>
    </div>
  );
}

function useTxRunner() {
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();
  const { writeContractAsync, isPending } = useWriteContract();
  const [txState, setTxState] = useState<TxState>();

  async function run(label: string, request: WriteRequest) {
    try {
      setTxState({ label });
      const hash = await writeContractAsync(request);
      setTxState({ label: "Waiting for confirmation", hash });
      await publicClient?.waitForTransactionReceipt({ hash });
      await queryClient.invalidateQueries();
      setTxState({ label, hash, success: "Transaction confirmed" });
      return hash;
    } catch (error) {
      setTxState({ label, error: error instanceof Error ? error.message : "Transaction failed." });
      return undefined;
    }
  }

  return { run, isPending, txState };
}

function normalizeAgreement(raw: unknown, id: bigint): AgreementRecord | null {
  if (!raw) return null;
  const record = raw as Partial<AgreementRecord> & readonly unknown[];

  return {
    id,
    client: (record.client ?? record[0]) as Address,
    beneficiary: (record.beneficiary ?? record[1]) as Address,
    arbiter: (record.arbiter ?? record[2]) as Address,
    amount: (record.amount ?? record[3]) as bigint,
    deadline: (record.deadline ?? record[4]) as bigint,
    title: (record.title ?? record[5]) as string,
    criteriaURI: (record.criteriaURI ?? record[6]) as string,
    metadataURI: (record.metadataURI ?? record[7]) as string,
    proofURI: (record.proofURI ?? record[8]) as string,
    status: Number(record.status ?? record[9] ?? 0),
    createdAt: (record.createdAt ?? record[10]) as bigint,
    acceptedAt: (record.acceptedAt ?? record[11]) as bigint,
    submittedAt: (record.submittedAt ?? record[12]) as bigint,
    completedAt: (record.completedAt ?? record[13]) as bigint,
  };
}

function readBigInt(data: readonly unknown[] | undefined, index: number) {
  const row = data?.[index] as ReadRow | undefined;
  return typeof row?.result === "bigint" ? row.result : 0n;
}

function parseUsdcAmount(value: string) {
  try {
    if (!value.trim()) return null;
    return parseUnits(value, usdcDecimals);
  } catch {
    return null;
  }
}

function validateCreateForm({
  arbiter,
  amount,
  beneficiary,
  criteriaURI,
  deadline,
  title,
}: {
  arbiter: string;
  amount: bigint | null;
  beneficiary: string;
  criteriaURI: string;
  deadline: string;
  title: string;
}) {
  if (!title.trim()) return "Enter an agreement title.";
  if (!isAddress(beneficiary)) return "Enter a valid beneficiary address.";
  if (!isAddress(arbiter)) return "Enter a valid arbiter address.";
  if (beneficiary.toLowerCase() === arbiter.toLowerCase()) return "Beneficiary and arbiter must be different wallets.";
  if (amount === null || amount <= 0n) return "Enter a positive USDC amount.";
  if (criteriaURI.trim().length < 10) return "Add clear acceptance criteria.";
  const deadlineMs = new Date(deadline).getTime();
  if (!Number.isFinite(deadlineMs) || deadlineMs <= Date.now()) return "Deadline must be in the future.";
  return "";
}

function defaultDeadlineInput() {
  const date = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function formatUsdc(amount: bigint) {
  const value = formatUnits(amount, usdcDecimals);
  const [whole, fraction = ""] = value.split(".");
  const normalizedWhole = Number(whole).toLocaleString("en-US");
  const normalizedFraction = fraction.replace(/0+$/, "").slice(0, 6);
  return `${normalizedWhole}${normalizedFraction ? `.${normalizedFraction}` : ""} USDC`;
}

function formatAddress(address: Address | string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatDate(timestamp: bigint) {
  if (timestamp === 0n) return "Not set";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(Number(timestamp) * 1000));
}

function formatIso(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
