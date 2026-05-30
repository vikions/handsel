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

const disputeResolutionPresets = [
  {
    label: "Full payment to worker",
    detail: "Work accepted, release 100% to beneficiary.",
    clientBps: 0,
  },
  {
    label: "Mostly completed",
    detail: "Worker receives 75%, client receives 25%.",
    clientBps: 2500,
  },
  {
    label: "Half completed",
    detail: "Split escrow 50/50 between both sides.",
    clientBps: 5000,
  },
  {
    label: "Refund client",
    detail: "Work rejected, return 100% to client.",
    clientBps: 10_000,
  },
] as const;

type Route =
  | { page: "landing" }
  | { page: "overview" }
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

  if (route.page === "landing") {
    return <LandingPage />;
  }

  return (
    <div className="app-shell">
      <div className="background-grid" aria-hidden="true" />
      <Header route={route} />
      <main className="page-frame">
        <ConfigWarning />
        {route.page === "overview" ? <OverviewPage /> : null}
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
  if (normalized === "/") return { page: "landing" };
  if (normalized === "/overview") return { page: "overview" };
  if (normalized === "/dashboard") return { page: "dashboard" };
  if (normalized === "/create") return { page: "create" };
  if (normalized.startsWith("/agreements/")) {
    return routeWithId(normalized.replace("/agreements/", ""), "detail");
  }
  if (normalized.startsWith("/receipts/")) {
    return routeWithId(normalized.replace("/receipts/", ""), "receipt");
  }
  return { page: "landing" };
}

function routeWithId(value: string, page: "detail" | "receipt"): Route {
  try {
    const agreementId = BigInt(value);
    return page === "detail" ? { page: "detail", agreementId } : { page: "receipt", agreementId };
  } catch {
    return { page: "dashboard" };
  }
}

function LandingPage() {
  const fontsReady = useLandingFontsReady();

  return (
    <div className={fontsReady ? "landing-shell fonts-ready" : "landing-shell"}>
      <LandingProofSurface />
      <div className="landing-surface-gradient" aria-hidden="true" />
      <header className="landing-nav">
        <a className="landing-logo" href="#/" aria-label="Handsel home">
          Handsel
        </a>
        <nav className="landing-menu" aria-label="Landing navigation">
          <a href="#/">Home</a>
          <a href="#/overview">Overview</a>
          <a href="#/dashboard">Dashboard</a>
          <a href="#/create">Create</a>
        </nav>
        <a className="landing-nav-cta" href="#/create">
          Create agreement
        </a>
      </header>
      <main className="landing-hero">
        <p className="landing-kicker">Built on Arc technology</p>
        <h1>
          <span className="headline-line">Proof-based settlement</span>
          <span className="headline-line headline-muted">for real work.</span>
        </h1>
        <p className="landing-copy">Define the work. Hold the payment. Submit proof. Release on approval.</p>
        <div className="landing-actions">
          <a className="landing-primary" href="#/overview">
            View Overview
          </a>
          <a className="landing-secondary" href="#/create">
            Create Agreement
          </a>
        </div>
      </main>
    </div>
  );
}

function useLandingFontsReady() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const finish = () => {
      if (!cancelled) setReady(true);
    };

    if (!("fonts" in document)) {
      finish();
      return () => {
        cancelled = true;
      };
    }

    const timeout = window.setTimeout(finish, 1200);
    void document.fonts.ready.then(() => {
      window.clearTimeout(timeout);
      finish();
    });

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, []);

  return ready;
}

function LandingProofSurface() {
  return (
    <div className="landing-surface-layer" aria-hidden="true">
      <div className="proof-surface">
        <div className="surface-rail rail-left">
          <span>criteria locked</span>
          <span>proof submitted</span>
          <span>client approved</span>
        </div>
        <div className="surface-card criteria-card">
          <span className="surface-label">Client</span>
          <strong>Maya Chen hires Ilya Moroz</strong>
          <p>300 USDC held for a cafe booking page. Release requires live URL, source PR, and handoff notes.</p>
          <div className="surface-lines">
            <span />
            <span />
            <span />
          </div>
        </div>
        <div className="surface-card proof-card">
          <span className="surface-label">Freelancer proof</span>
          <strong>staging.oma-cafe.app + PR #47</strong>
          <p>Responsive build, checkout screenshots, and QA notes attached before approval.</p>
          <div className="surface-meter">
            <span />
          </div>
        </div>
        <div className="surface-card receipt-card">
          <span className="surface-label">Settlement receipt</span>
          <div className="receipt-line">
            <span>Client</span>
            <strong>Maya C.</strong>
          </div>
          <div className="receipt-line">
            <span>Freelancer</span>
            <strong>Ilya M.</strong>
          </div>
          <div className="receipt-line">
            <span>Released</span>
            <strong>300 USDC</strong>
          </div>
          <div className="receipt-stamp">approved by client</div>
        </div>
        <div className="surface-card mini-card mini-card-one">
          <span className="surface-label">Podcast edit</span>
          <strong>75 USDC</strong>
          <p>Proof: final WAV and transcript link.</p>
        </div>
        <div className="surface-card mini-card mini-card-two">
          <span className="surface-label">Figma cleanup</span>
          <strong>120 USDC</strong>
          <p>Proof: shared file with annotated changes.</p>
        </div>
        <div className="surface-rail rail-right">
          <span>Created</span>
          <span>Submitted</span>
          <span>Completed</span>
        </div>
      </div>
    </div>
  );
}

function Header({ route }: { route: Route }) {
  return (
    <header className="topbar">
      <a className="brand" href="#/">
        <span>Handsel</span>
      </a>
      <nav className="nav-links" aria-label="Primary navigation">
        <a className={route.page === "dashboard" ? "active" : ""} href="#/dashboard">
          Dashboard
        </a>
        <a className={route.page === "overview" ? "active" : ""} href="#/overview">
          Overview
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

function ConfigWarning() {
  if (contractsConfigured) return null;

  return (
    <section className="notice-panel">
      <WarningCircle size={20} weight="duotone" />
      <div>
        <strong>App config needed</strong>
        <p>Add the Arc RPC, chain id, Handsel contract address, and USDC address for live reads and writes.</p>
        <ul>
          {configIssues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function OverviewPage() {
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
  const sampleSize = Number(totalAgreements > 80n ? 80n : totalAgreements);
  const overviewIds = useMemo(() => Array.from({ length: sampleSize }, (_, index) => BigInt(index)), [sampleSize]);

  const agreementsRead = useReadContracts({
    contracts: overviewIds.map((id) => ({
      address: handselAddress,
      abi: handselAbi,
      functionName: "getAgreement",
      args: [id],
    })),
    query: { enabled: contractsConfigured && overviewIds.length > 0 },
  });

  const agreements = useMemo(
    () =>
      (agreementsRead.data ?? [])
        .map((row, index) => normalizeAgreement((row as ReadRow).result, overviewIds[index]))
        .filter((agreement): agreement is AgreementRecord => Boolean(agreement)),
    [agreementsRead.data, overviewIds],
  );

  const uniqueClients = new Set(agreements.map((agreement) => agreement.client.toLowerCase())).size;
  const uniqueFreelancers = new Set(agreements.map((agreement) => agreement.beneficiary.toLowerCase())).size;
  const inProgress = agreements.filter((agreement) => agreement.status === 1 || agreement.status === 2).length;

  return (
    <div className="overview-layout">
      <section className="overview-hero">
        <span className="eyebrow">Protocol overview</span>
        <h1>Real work moving through Handsel.</h1>
        <p>Live contract reads for agreements, USDC volume, clients, freelancers, and settlement status.</p>
      </section>

      <section className="overview-number-grid" aria-label="Protocol overview metrics">
        <OverviewMetric label="Agreements" value={totalAgreements.toString()} loading={stats.isLoading} />
        <OverviewMetric label="USDC volume" value={formatCompactUsdc(totalVolume)} loading={stats.isLoading} />
        <OverviewMetric label="Clients" value={uniqueClients.toString()} loading={agreementsRead.isLoading} />
        <OverviewMetric label="Freelancers" value={uniqueFreelancers.toString()} loading={agreementsRead.isLoading} />
      </section>

      <section className="overview-ledger">
        <div className="overview-status">
          <span>Completed</span>
          <strong>{completed.toString()}</strong>
        </div>
        <div className="overview-status">
          <span>In progress</span>
          <strong>{inProgress.toString()}</strong>
        </div>
        <div className="overview-status">
          <span>Disputed</span>
          <strong>{disputed.toString()}</strong>
        </div>
      </section>

      <section className="overview-flow">
        <div>
          <span>1</span>
          <strong>Define work</strong>
          <p>Client sets amount, recipient, deadline, and proof requirements.</p>
        </div>
        <div>
          <span>2</span>
          <strong>Submit proof</strong>
          <p>Freelancer attaches delivery evidence such as URL, PR, file, or notes.</p>
        </div>
        <div>
          <span>3</span>
          <strong>Release USDC</strong>
          <p>Client reviews proof and approves settlement on Arc.</p>
        </div>
      </section>

      {stats.error ? <InlineError message={stats.error.message} /> : null}
      {agreementsRead.error ? <InlineError message={agreementsRead.error.message} /> : null}
    </div>
  );
}

function OverviewMetric({ label, value, loading }: { label: string; value: string; loading?: boolean }) {
  return (
    <div className="overview-metric">
      <span>{label}</span>
      {loading ? <div className="skeleton metric-skeleton" /> : <strong>{value}</strong>}
    </div>
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
        <div className="eyebrow">Handsel dashboard</div>
        <h1>Deals</h1>
        <p>Hold USDC. Get proof. Release on approval.</p>
        <div className="hero-actions">
          <a className="primary-link" href="#/create">
            <Plus size={18} weight="bold" />
            Create agreement
          </a>
        </div>
      </section>

      <section className="stats-panel" aria-label="Protocol stats">
        <Metric label="Total agreements" value={totalAgreements.toString()} loading={stats.isLoading} />
        <Metric label="Total volume" value={formatCompactUsdc(totalVolume)} loading={stats.isLoading} />
        <Metric label="Completed" value={completed.toString()} loading={stats.isLoading} />
        <Metric label="Disputed" value={disputed.toString()} loading={stats.isLoading} />
        {stats.error ? <InlineError message={stats.error.message} /> : null}
      </section>

      <section className="agent-panel">
        <div className="panel-icon">
          <Handshake size={24} weight="duotone" />
        </div>
        <div>
          <h2>Agent task mode</h2>
          <p>Future workflow for autonomous task settlement.</p>
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
    return <EmptyState title="Connect a wallet" body="Your client and freelancer agreements will appear here." />;
  }

  if (userIdsRead.isLoading || agreementsRead.isLoading) return <AgreementListSkeleton />;

  if (userIdsRead.error || agreementsRead.error) {
    return <InlineError message={(userIdsRead.error ?? agreementsRead.error)?.message ?? "Unable to load agreements."} />;
  }

  if (agreements.length === 0) {
    return <EmptyState title="No agreements yet" body="Create the first deal, then come back here to track it." />;
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
  const [title, setTitle] = useState("Cafe booking page");
  const [beneficiary, setBeneficiary] = useState("");
  const [arbiter, setArbiter] = useState("");
  const [amount, setAmount] = useState("100");
  const [deadline, setDeadline] = useState(defaultDeadlineInput);
  const [criteriaURI, setCriteriaURI] = useState("Live URL, source PR, mobile screenshots, and handoff notes.");
  const [metadataURI, setMetadataURI] = useState("Booking page for a small cafe launch.");
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
    if (hash) window.location.hash = "#/dashboard";
  }

  return (
    <div className="form-layout">
      <section className="form-copy">
        <span className="eyebrow">Create agreement</span>
        <h1>Create a deal.</h1>
        <p>Set recipient, amount, deadline, and proof.</p>
        <div className="balance-strip">
          <span>Wallet balance</span>
          <strong>{formatUsdc(balance)}</strong>
        </div>
      </section>

      <section className="form-panel">
        <Field label="Title">
          <input value={title} onChange={(event) => setTitle(event.target.value)} />
        </Field>
        <Field label="Freelancer wallet">
          <input value={beneficiary} onChange={(event) => setBeneficiary(event.target.value)} placeholder="0x..." />
        </Field>
        <Field label="Arbiter wallet">
          <input value={arbiter} onChange={(event) => setArbiter(event.target.value)} placeholder="0x..." />
        </Field>
        <div className="form-grid">
          <Field label="Amount">
            <input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
          </Field>
          <Field label="Deadline">
            <input type="datetime-local" value={deadline} onChange={(event) => setDeadline(event.target.value)} />
          </Field>
        </div>
        <Field label="Proof required">
          <textarea value={criteriaURI} onChange={(event) => setCriteriaURI(event.target.value)} rows={4} />
        </Field>
        <Field label="Notes">
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
  const [validation, setValidation] = useState<ValidationResult | null>(() => loadValidationResult(agreement.id));

  useEffect(() => {
    setProofURI(agreement.proofURI);
    setValidation(loadValidationResult(agreement.id));
  }, [agreement.id, agreement.proofURI]);

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

  function formatSplitAmount(bps: number) {
    return formatUsdc((agreement.amount * BigInt(bps)) / 10_000n);
  }

  async function resolveDispute(clientShareBps: number) {
    const beneficiaryShareBps = 10_000 - clientShareBps;
    await callAgreement("Resolving dispute", "resolveDispute", [agreement.id, clientShareBps, beneficiaryShareBps]);
  }

  return (
    <div className="detail-layout">
      <section className="detail-main">
        <a className="back-link" href="#/dashboard">
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
        {isSettled ? (
          <div className="settled-note">
            <CheckCircle size={18} weight="duotone" />
            <div>
              <strong>Agreement settled</strong>
              <p>Funds have been distributed. No further client, worker, or arbiter action is available.</p>
            </div>
          </div>
        ) : null}

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
                <p>{validation?.summary ?? "Run local review before final client approval."}</p>
              </div>
            </div>
            <p className="review-note">AI-assisted review is a local recommendation. Client approval controls release.</p>
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
            <div className="resolve-summary">
              <Scales size={18} weight="duotone" />
              <div>
                <strong>Resolve escrow split</strong>
                <p>Choose how the locked {formatUsdc(agreement.amount)} should be distributed.</p>
              </div>
            </div>
            <div className="resolution-grid">
              {disputeResolutionPresets.map((preset) => {
                const workerBps = 10_000 - preset.clientBps;
                return (
                  <button
                    className="resolution-option"
                    disabled={isPending}
                    key={preset.label}
                    onClick={() => resolveDispute(preset.clientBps)}
                    type="button"
                  >
                    <strong>{preset.label}</strong>
                    <span>{preset.detail}</span>
                    <small>
                      Worker: {formatSplitAmount(workerBps)} · Client: {formatSplitAmount(preset.clientBps)}
                    </small>
                  </button>
                );
              })}
            </div>
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
        Public status view for a proof-based service agreement. This receipt is a product record, not a legal
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

function formatCompactUsdc(amount: bigint) {
  const unit = 10n ** BigInt(usdcDecimals);
  const whole = amount / unit;
  if (whole === 0n && amount > 0n) return "<1";
  return whole.toLocaleString("en-US");
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
