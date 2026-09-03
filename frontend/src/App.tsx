import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  ArrowSquareOut,
  Brain,
  Briefcase,
  CalendarBlank,
  CaretDown,
  CheckCircle,
  ClockCountdown,
  Copy,
  CurrencyCircleDollar,
  FileText,
  Fingerprint,
  Gavel,
  IdentificationCard,
  NotePencil,
  Plus,
  Receipt,
  Scales,
  ShieldCheck,
  UploadSimple,
  UserCircle,
  Wallet,
  WarningCircle,
  XCircle,
} from "@phosphor-icons/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useAccount,
  useConnect,
  useDisconnect,
  usePublicClient,
  useReadContract,
  useReadContracts,
  useWriteContract,
} from "wagmi";
import { formatUnits, getAddress, isAddress, parseUnits, zeroAddress, type Address, type Hash } from "viem";
import {
  circleWalletConfigured,
  handselAddress,
  configIssues,
  contractsConfigured,
  selectCircleWalletMode,
  usdcAddress,
  usdcDecimals,
} from "./lib/config";
import { handselAbi, erc20Abi } from "./lib/abi";
import {
  loadValidationResult,
  saveValidationResult,
  validateProof,
  type ValidationResult,
} from "./lib/aiValidation";
import { buildTimeline } from "./lib/timeline";
import { buildReceipt } from "./lib/receipts";
import { activityApiConfigured, getPersonalActivity } from "./lib/activityApi";

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
    detail: "Split the settlement 50/50 between both sides.",
    clientBps: 5000,
  },
  {
    label: "Refund client",
    detail: "Work rejected, return 100% to client.",
    clientBps: 10_000,
  },
] as const;

const landingTaskTickerItems = [
  { title: "Landing page for a night club", amount: "4.00" },
  { title: "Cafe booking page", amount: "4.00" },
  { title: "Creator link-in-bio setup", amount: "2.50" },
  { title: "Local gym promo page", amount: "5.00" },
  { title: "Restaurant menu cleanup", amount: "3.20" },
  { title: "Event flyer mobile page", amount: "3.75" },
  { title: "Podcast cover refresh", amount: "2.80" },
  { title: "Small agency case study", amount: "4.60" },
  { title: "Tattoo studio gallery fix", amount: "3.50" },
  { title: "Barbershop hours update", amount: "2.25" },
  { title: "Boutique product banner", amount: "3.90" },
  { title: "DJ press kit page", amount: "4.40" },
  { title: "Yoga coach signup form", amount: "3.30" },
  { title: "Food truck launch page", amount: "5.50" },
  { title: "Real estate lead form", amount: "4.80" },
  { title: "Streamer sponsor panel", amount: "2.70" },
  { title: "Photography mini portfolio", amount: "5.20" },
  { title: "Newsletter template polish", amount: "2.90" },
  { title: "Discord community rules page", amount: "3.10" },
  { title: "Indie game teaser site", amount: "5.75" },
] as const;

const arcScanContractUrl = "https://testnet.arcscan.app/address/0x51bfB2A08E7680786eD54a00eE4d915Bab6B3867";

type Route =
  | { page: "landing" }
  | { page: "analytics" }
  | { page: "dashboard" }
  | { page: "create" }
  | { page: "profile"; address: Address }
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

type AgreementAnalyticsState = {
  isLoading: boolean;
  loaded: number;
  clients: number;
  freelancers: number;
  inProgress: number;
  error?: string;
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

  useEffect(() => {
    const routeTitles: Record<Route["page"], string> = {
      analytics: "Activity",
      create: "Create agreement",
      dashboard: "Agreements",
      detail: "Agreement",
      landing: "Proof-based settlement",
      profile: "Work Passport",
      receipt: "Settlement receipt",
    };
    document.title = `${routeTitles[route.page]} | Handsel`;
  }, [route.page]);

  if (route.page === "landing") {
    return <LandingPage />;
  }

  return (
    <div className="app-shell">
      <div className="background-grid" aria-hidden="true" />
      <Header route={route} />
      <main className="page-frame">
        <ConfigWarning />
        {route.page === "analytics" ? <AnalyticsPage /> : null}
        {route.page === "dashboard" ? <Dashboard /> : null}
        {route.page === "create" ? <CreateAgreementPage /> : null}
        {route.page === "profile" ? <WorkPassportPage address={route.address} /> : null}
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
  if (normalized === "/analytics" || normalized === "/overview") return { page: "analytics" };
  if (normalized === "/dashboard") return { page: "dashboard" };
  if (normalized === "/create") return { page: "create" };
  if (normalized.startsWith("/profile/")) {
    const address = normalized.replace("/profile/", "");
    return isAddress(address) ? { page: "profile", address: getAddress(address) } : { page: "dashboard" };
  }
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
          <a href="#/analytics">Analytics</a>
          <a href="#/dashboard">Dashboard</a>
          <a href="#/create">Create</a>
        </nav>
        <a className="landing-nav-cta" href="#/create">
          Create agreement
        </a>
      </header>
      <main className="landing-hero">
        <p className="landing-kicker">Agree. Prove. Settle.</p>
        <h1>
          <span className="headline-line">Proof-based USDC settlement</span>
          <span className="headline-line headline-muted">for real digital work.</span>
        </h1>
        <p className="landing-copy">
          Create an agreement, commit USDC, submit proof, settle the work, and build a verifiable work history on Arc.
        </p>
        <div className="landing-actions">
          <a className="landing-primary" href="#/create">
            Create agreement
          </a>
          <a className="landing-secondary" href="#/analytics">
            View public activity
          </a>
        </div>
        <div className="landing-trust" aria-label="Product verification">
          <span><CheckCircle size={15} weight="fill" /> Live on Arc Testnet</span>
          <span><CurrencyCircleDollar size={15} weight="duotone" /> USDC settlement</span>
          <a href={arcScanContractUrl} rel="noreferrer" target="_blank">
            <ShieldCheck size={15} weight="duotone" /> Verified contract
          </a>
          <a href="#/analytics"><Receipt size={15} weight="duotone" /> Public settlement history</a>
        </div>
      </main>
      <LandingTaskTicker />
    </div>
  );
}

function LandingTaskTicker() {
  return (
    <aside className="landing-task-ticker" aria-label="Example agreement requests">
      <div className="landing-task-track">
        {[0, 1].map((group) => (
          <div className="landing-task-group" aria-hidden={group === 1} key={group}>
            {landingTaskTickerItems.map((item) => (
              <span className="landing-task-pill" key={`${group}-${item.title}`}>
                <span>{item.title}</span>
                <strong>{item.amount} USDC</strong>
              </span>
            ))}
          </div>
        ))}
      </div>
    </aside>
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
      <div className="topbar-inner">
        <a className="brand" href="#/" aria-label="Handsel home">
          Handsel
        </a>
        <nav className="nav-links" aria-label="Primary navigation">
          <a
            aria-current={route.page === "dashboard" ? "page" : undefined}
            className={route.page === "dashboard" ? "active" : ""}
            href="#/dashboard"
          >
            Agreements
          </a>
          <a
            aria-current={route.page === "create" ? "page" : undefined}
            className={route.page === "create" ? "active" : ""}
            href="#/create"
          >
            Create
          </a>
          <a
            aria-current={route.page === "analytics" ? "page" : undefined}
            className={route.page === "analytics" ? "active" : ""}
            href="#/analytics"
          >
            Activity
          </a>
        </nav>
        <div className="topbar-actions">
          <ConnectButton />
        </div>
      </div>
    </header>
  );
}

function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { connectors, connect, error, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const [open, setOpen] = useState(false);
  const browserConnector = connectors.find((connector) => connector.id !== "circlePasskey");
  const circleConnector = connectors.find((connector) => connector.id === "circlePasskey");

  useEffect(() => {
    const closeMenu = () => setOpen(false);
    window.addEventListener("hashchange", closeMenu);
    return () => window.removeEventListener("hashchange", closeMenu);
  }, []);

  if (isConnected) {
    return (
      <button className="wallet-button" type="button" onClick={() => disconnect()}>
        <Wallet size={18} weight="duotone" />
        <span>{address ? formatAddress(address) : "Disconnect"}</span>
      </button>
    );
  }

  return (
    <div className="wallet-menu-wrap">
      <button className="wallet-button" type="button" onClick={() => setOpen((value) => !value)}>
        <Wallet size={18} weight="duotone" />
        <span>{isPending ? "Connecting" : "Connect Wallet"}</span>
      </button>
      {open ? (
        <div className="wallet-menu">
          <button type="button" onClick={() => browserConnector && connect({ connector: browserConnector })}>
            <Wallet size={18} />
            <span><strong>Browser wallet</strong><small>MetaMask or another installed wallet</small></span>
          </button>
          <button
            type="button"
            disabled={!circleWalletConfigured}
            onClick={() => {
              selectCircleWalletMode("login");
              if (circleConnector) connect({ connector: circleConnector });
            }}
          >
            <Fingerprint size={18} />
            <span><strong>Circle passkey</strong><small>Sign in with an existing device passkey</small></span>
          </button>
          <button
            type="button"
            disabled={!circleWalletConfigured}
            onClick={() => {
              selectCircleWalletMode("register");
              if (circleConnector) connect({ connector: circleConnector });
            }}
          >
            <Plus size={18} />
            <span><strong>Create passkey wallet</strong><small>No wallet extension required</small></span>
          </button>
          <div className={circleWalletConfigured ? "wallet-menu-note configured" : "wallet-menu-note"}>
            {circleWalletConfigured
              ? "Circle passkey transactions use sponsored Arc Testnet network fees."
              : "Circle passkey is implemented and activates when this deployment receives its Circle Client Key."}
          </div>
          {error ? <small className="wallet-menu-error">{error.message}</small> : null}
        </div>
      ) : null}
    </div>
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

let agreementAnalyticsRequest:
  | { count: number; promise: Promise<Omit<AgreementAnalyticsState, "isLoading">> }
  | undefined;

function useAgreementAnalytics(expectedAgreementCount: bigint): AgreementAnalyticsState {
  const publicClient = usePublicClient();
  const [state, setState] = useState<AgreementAnalyticsState>({
    isLoading: false,
    loaded: 0,
    clients: 0,
    freelancers: 0,
    inProgress: 0,
  });

  useEffect(() => {
    if (!contractsConfigured || !publicClient || handselAddress === zeroAddress || expectedAgreementCount === 0n) {
      setState({ isLoading: false, loaded: 0, clients: 0, freelancers: 0, inProgress: 0 });
      return;
    }

    let cancelled = false;
    setState((previous) => ({ ...previous, isLoading: true, error: undefined }));

    loadAgreementAnalytics(publicClient, Number(expectedAgreementCount))
      .then((analytics) => {
        if (cancelled) return;
        setState({ ...analytics, isLoading: false });
      })
      .catch((error) => {
        if (cancelled) return;
        setState((previous) => ({
          ...previous,
          isLoading: false,
          error: error instanceof Error ? error.message : "Unable to load event analytics.",
        }));
      });

    return () => {
      cancelled = true;
    };
  }, [expectedAgreementCount, publicClient]);

  return state;
}

function loadAgreementAnalytics(
  publicClient: NonNullable<ReturnType<typeof usePublicClient>>,
  agreementCount: number,
): Promise<Omit<AgreementAnalyticsState, "isLoading">> {
  if (agreementAnalyticsRequest?.count === agreementCount) {
    return agreementAnalyticsRequest.promise;
  }

  const promise = (async () => {
    const clients = new Set<string>();
    const freelancers = new Set<string>();
    let loaded = 0;
    let inProgress = 0;
    const batchSize = 50;

    for (let offset = 0; offset < agreementCount; offset += batchSize) {
      const size = Math.min(batchSize, agreementCount - offset);
      const ids = Array.from({ length: size }, (_, index) => BigInt(offset + index));
      const rows = await publicClient.multicall({
        allowFailure: true,
        batchSize: 0,
        contracts: ids.map((id) => ({
          address: handselAddress,
          abi: handselAbi,
          functionName: "getAgreement",
          args: [id],
        })),
      });

      rows.forEach((row, index) => {
        if (row.status !== "success") return;
        const agreement = normalizeAgreement(row.result, ids[index]);
        if (!agreement) return;
        clients.add(agreement.client.toLowerCase());
        freelancers.add(agreement.beneficiary.toLowerCase());
        if (agreement.status === 1 || agreement.status === 2) inProgress += 1;
        loaded += 1;
      });
    }

    if (loaded !== agreementCount) {
      throw new Error(`Loaded ${loaded} of ${agreementCount} agreements. Retry the public analytics read.`);
    }

    return {
      loaded,
      clients: clients.size,
      freelancers: freelancers.size,
      inProgress,
    };
  })();

  agreementAnalyticsRequest = { count: agreementCount, promise };
  void promise.finally(() => {
    if (agreementAnalyticsRequest?.promise === promise) {
      agreementAnalyticsRequest = undefined;
    }
  });

  return promise;
}

function AnalyticsPage() {
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
  const agreementAnalytics = useAgreementAnalytics(totalAgreements);

  return (
    <div className="overview-layout">
      <section className="overview-hero">
        <span className="eyebrow">Public analytics</span>
        <h1>Handsel activity on Arc.</h1>
        <p>Public contract reads for agreements, USDC volume, clients, freelancers, and settlement status.</p>
      </section>

      <section className="overview-number-grid" aria-label="Protocol overview metrics">
        <OverviewMetric label="Agreements" value={totalAgreements.toString()} loading={stats.isLoading} />
        <OverviewMetric label="USDC volume" value={formatCompactUsdc(totalVolume)} loading={stats.isLoading} />
        <OverviewMetric
          label="Clients"
          value={agreementAnalytics.clients.toString()}
          loading={agreementAnalytics.isLoading}
        />
        <OverviewMetric
          label="Freelancers"
          value={agreementAnalytics.freelancers.toString()}
          loading={agreementAnalytics.isLoading}
        />
      </section>

      <section className="overview-ledger">
        <div className="overview-status">
          <span>Completed</span>
          <strong>{completed.toString()}</strong>
        </div>
        <div className="overview-status">
          <span>In progress</span>
          <strong>{agreementAnalytics.inProgress.toString()}</strong>
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
      {agreementAnalytics.error ? <InlineError message={agreementAnalytics.error} /> : null}
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
  const { address } = useAccount();
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
    <div className="dashboard-page">
      <section className="page-heading">
        <div>
          <span className="page-kicker live-kicker">
            <span className="live-dot" />
            Live on Arc
          </span>
          <h1>Work agreements</h1>
          <p>One place for committed funds, submitted proof, and settlement.</p>
        </div>
        <div className="page-heading-actions">
          {address ? (
            <a className="secondary-link" href={`#/profile/${address}`}>
              <IdentificationCard size={18} weight="duotone" />
              Work Passport
            </a>
          ) : null}
          <a className="primary-link" href="#/create">
            <Plus size={18} weight="bold" />
            Create agreement
          </a>
        </div>
      </section>

      <section className="dashboard-stats" aria-label="Protocol stats">
        <Metric label="Agreements" value={totalAgreements.toString()} loading={stats.isLoading} />
        <Metric label="USDC volume" value={formatCompactUsdc(totalVolume)} loading={stats.isLoading} />
        <Metric label="Completed" value={completed.toString()} loading={stats.isLoading} />
        <Metric label="Disputed" value={disputed.toString()} loading={stats.isLoading} />
        {stats.error ? <InlineError message={stats.error.message} /> : null}
      </section>

      <section className="activity-panel" id="user-agreements">
        <div className="section-heading">
          <div>
            <h2>My work activity</h2>
            <p>Work organized by what needs attention, what is active, and what has settled.</p>
          </div>
        </div>
        <UserAgreements />
      </section>

      {activityApiConfigured ? <CircleActivity address={address} /> : null}

    </div>
  );
}

function CircleActivity({ address }: { address?: Address }) {
  const activity = useQuery({
    queryKey: ["circle-activity", address],
    queryFn: () => getPersonalActivity(address!),
    enabled: Boolean(address),
    refetchInterval: 15_000,
  });

  return (
    <section className="circle-activity-panel">
      <div className="section-heading circle-activity-heading">
        <div>
          <span className="circle-source"><span /> Circle Contracts</span>
          <h2>Verified activity</h2>
        </div>
        {activity.data ? <small>{activity.data.events.length} indexed events</small> : null}
      </div>
      {!address ? <EmptyState title="Connect your wallet" body="Your indexed agreement history will appear here." /> : null}
      {address && activity.isLoading ? <AgreementListSkeleton /> : null}
      {activity.error ? <InlineError message={activity.error.message} /> : null}
      {address && activity.data?.events.length === 0 ? (
        <EmptyState title="No Circle events yet" body="New agreement actions will be indexed here automatically." />
      ) : null}
      {activity.data?.events.length ? (
        <div className="circle-event-list">
          {activity.data.events.slice(0, 12).map((event) => (
            <a
              className="circle-event-row"
              href={`https://testnet.arcscan.app/tx/${event.tx_hash}`}
              key={event.notification_id}
              rel="noreferrer"
              target="_blank"
            >
              <span className="circle-event-mark" />
              <div>
                <strong>{formatEventName(event.event_name)}</strong>
                <small>Agreement #{event.agreement_id} / {new Date(event.confirmed_at).toLocaleString()}</small>
              </div>
              <ArrowRight size={16} weight="bold" />
            </a>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function formatEventName(eventName: string) {
  return eventName.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^Agreement /, "");
}

function Metric({ label, value, loading }: { label: string; value: string; loading?: boolean }) {
  return (
    <div className="metric">
      <span>{label}</span>
      {loading ? <div className="skeleton metric-skeleton" /> : <strong>{value}</strong>}
    </div>
  );
}

function useAddressAgreements(address?: Address, enabled = true) {
  const userCountRead = useReadContract({
    address: handselAddress,
    abi: handselAbi,
    functionName: "getUserAgreementCount",
    args: [address ?? zeroAddress],
    query: { enabled: contractsConfigured && enabled && Boolean(address) },
  });
  const count = typeof userCountRead.data === "bigint" ? userCountRead.data : 0n;

  const userIdsRead = useReadContract({
    address: handselAddress,
    abi: handselAbi,
    functionName: "getUserAgreementIds",
    args: [address ?? zeroAddress, 0n, count || 1n],
    query: { enabled: contractsConfigured && enabled && Boolean(address) && count > 0n },
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
  const error = userCountRead.error ?? userIdsRead.error ?? agreementsRead.error;
  const isLoading =
    userCountRead.isLoading || (count > 0n && userIdsRead.isLoading) || (ids.length > 0 && agreementsRead.isLoading);

  return { agreements, count, error, isLoading };
}

function UserAgreements() {
  const { address, isConnected } = useAccount();
  const activity = useAddressAgreements(address, isConnected);

  if (!isConnected) {
    return <EmptyState title="Connect a wallet" body="Your client, worker, and resolver activity will appear here." />;
  }

  if (activity.isLoading) return <AgreementListSkeleton />;

  if (activity.error) {
    return <InlineError message={activity.error.message || "Unable to load agreements."} />;
  }

  if (activity.agreements.length === 0) {
    return <EmptyState title="No agreements yet" body="Create the first deal, then come back here to track it." />;
  }

  const awaiting = activity.agreements.filter((agreement) => agreementNeedsAction(agreement, address));
  const active = activity.agreements.filter(
    (agreement) => [0, 1, 2, 4].includes(agreement.status) && !agreementNeedsAction(agreement, address),
  );
  const completed = activity.agreements.filter((agreement) => agreement.status === 3 || agreement.status === 5);
  const history = activity.agreements.filter((agreement) => agreement.status === 6 || agreement.status === 7);

  return (
    <div className="work-hub">
      <AgreementGroup
        address={address!}
        agreements={awaiting}
        empty="Nothing needs your action right now."
        title="Awaiting my action"
        urgent
      />
      <AgreementGroup address={address!} agreements={active} title="Active work" />
      <AgreementGroup address={address!} agreements={completed} title="Completed work" />
      <AgreementGroup address={address!} agreements={history} title="Other history" />
    </div>
  );
}

function AgreementGroup({
  address,
  agreements,
  empty,
  title,
  urgent,
}: {
  address: Address;
  agreements: AgreementRecord[];
  empty?: string;
  title: string;
  urgent?: boolean;
}) {
  if (agreements.length === 0 && !empty) return null;

  return (
    <section className={urgent ? "work-group urgent" : "work-group"}>
      <div className="work-group-heading">
        <h3>{title}</h3>
        <span>{agreements.length}</span>
      </div>
      {agreements.length ? (
        <div className="agreement-list">
          {agreements.map((agreement) => (
            <AgreementRow address={address} agreement={agreement} key={agreement.id.toString()} urgent={urgent} />
          ))}
        </div>
      ) : (
        <p className="work-group-empty">{empty}</p>
      )}
    </section>
  );
}

function AgreementRow({
  address,
  agreement,
  urgent,
}: {
  address: Address;
  agreement: AgreementRecord;
  urgent?: boolean;
}) {
  const role = agreementRole(agreement, address);
  const nextAction = urgent ? agreementActionLabel(agreement, role) : undefined;

  return (
    <a
      className={urgent ? "agreement-row agreement-row-urgent" : "agreement-row"}
      href={`#/agreements/${agreement.id.toString()}`}
    >
      <div className="agreement-identity">
        <div className="agreement-row-labels">
          <span className={`status-pill status-${statusLabels[agreement.status]?.toLowerCase() ?? "unknown"}`}>
            {statusLabels[agreement.status] ?? "Unknown"}
          </span>
          <span className="agreement-role">{role}</span>
          <span className="agreement-number">#{agreement.id.toString()}</span>
        </div>
        <strong>{agreement.title || `Agreement #${agreement.id.toString()}`}</strong>
        <p>{nextAction || agreement.criteriaURI || agreement.metadataURI || "Acceptance criteria not supplied"}</p>
      </div>
      <div className="row-amount">
        <strong>{formatUsdc(agreement.amount)}</strong>
        <span>{agreement.status === 3 || agreement.status === 5 ? "Settled" : `Due ${formatDate(agreement.deadline)}`}</span>
        <ArrowRight size={17} weight="bold" aria-hidden="true" />
      </div>
    </a>
  );
}

function agreementRole(agreement: AgreementRecord, address: Address) {
  const normalized = address.toLowerCase();
  if (normalized === agreement.client.toLowerCase()) return "Client";
  if (normalized === agreement.beneficiary.toLowerCase()) return "Worker";
  return "Resolver";
}

function agreementNeedsAction(agreement: AgreementRecord, address?: Address) {
  if (!address) return false;
  const role = agreementRole(agreement, address);
  return (
    (role === "Worker" && (agreement.status === 0 || agreement.status === 1)) ||
    (role === "Client" && agreement.status === 2) ||
    (role === "Resolver" && agreement.status === 4)
  );
}

function agreementActionLabel(agreement: AgreementRecord, role: string) {
  if (role === "Worker" && agreement.status === 0) return "Accept this agreement";
  if (role === "Worker" && agreement.status === 1) return "Submit proof of completed work";
  if (role === "Client" && agreement.status === 2) return "Review proof and decide settlement";
  if (role === "Resolver" && agreement.status === 4) return "Resolve the disputed settlement";
  return "Open agreement";
}

function WorkPassportPage({ address }: { address: Address }) {
  const activity = useAddressAgreements(address);
  const indexedActivity = useQuery({
    queryKey: ["passport-activity", address],
    queryFn: () => getPersonalActivity(address),
    enabled: activityApiConfigured,
  });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timeout = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  if (activity.isLoading) return <DetailSkeleton />;
  if (activity.error) return <InlineError message={activity.error.message || "Unable to load work history."} />;

  const agreements = activity.agreements;
  const completed = agreements
    .filter((agreement) => agreement.status === 3 || agreement.status === 5)
    .sort((left, right) => Number(right.completedAt - left.completedAt));
  const totalSettled = completed.reduce((total, agreement) => total + agreement.amount, 0n);
  const asClient = agreements.filter((agreement) => agreement.client.toLowerCase() === address.toLowerCase()).length;
  const asWorker = agreements.filter((agreement) => agreement.beneficiary.toLowerCase() === address.toLowerCase()).length;
  const asResolver = agreements.filter((agreement) => agreement.arbiter.toLowerCase() === address.toLowerCase()).length;
  const disputes = agreements.filter((agreement) => agreement.status === 4 || agreement.status === 5).length;
  const resolvedDisputes = agreements.filter((agreement) => agreement.status === 5).length;

  return (
    <div className="passport-page">
      <section className="passport-heading">
        <div>
          <span className="page-kicker">Handsel Work Passport</span>
          <h1>Verifiable work history.</h1>
          <p>Objective agreement and settlement activity recorded by the Handsel contract on Arc Testnet.</p>
        </div>
        <div className="passport-heading-actions">
          <button
            className="secondary-button"
            onClick={() => {
              void navigator.clipboard.writeText(window.location.href);
              setCopied(true);
            }}
            type="button"
          >
            <Copy size={17} weight="bold" />
            {copied ? "Link copied" : "Copy profile link"}
          </button>
          <a className="primary-link" href={arcScanContractUrl} rel="noreferrer" target="_blank">
            Verified contract
            <ArrowSquareOut size={17} weight="bold" />
          </a>
        </div>
      </section>

      <section className="passport-identity" aria-label="Wallet identity">
        <div className="passport-avatar" aria-hidden="true">
          <IdentificationCard size={25} weight="duotone" />
        </div>
        <div>
          <span>Wallet</span>
          <strong>{formatAddress(address)}</strong>
          <small>{address}</small>
        </div>
        <span className="passport-source"><CheckCircle size={15} weight="fill" /> Derived from onchain agreements</span>
      </section>

      <section className="passport-metrics" aria-label="Work history metrics">
        <PassportMetric label="Completed agreements" value={completed.length.toString()} />
        <PassportMetric label="USDC settled" value={`${formatCompactUsdc(totalSettled)} USDC`} />
        <PassportMetric label="As client" value={asClient.toString()} />
        <PassportMetric label="As worker" value={asWorker.toString()} />
        <PassportMetric label="As resolver" value={asResolver.toString()} />
        <PassportMetric label="Disputes / resolved" value={`${disputes} / ${resolvedDisputes}`} />
      </section>

      <section className="passport-history">
        <div className="section-heading">
          <div>
            <h2>Completed work</h2>
            <p>Settlements completed by client approval or resolver decision.</p>
          </div>
          {activityApiConfigured && indexedActivity.data ? (
            <span className="indexed-signal">
              <span /> {indexedActivity.data.events.length} indexed events
            </span>
          ) : null}
        </div>
        {completed.length ? (
          <div className="passport-work-list">
            {completed.slice(0, 12).map((agreement) => (
              <a className="passport-work-row" href={`#/receipts/${agreement.id.toString()}`} key={agreement.id.toString()}>
                <div>
                  <span>{agreementRole(agreement, address)} / Agreement #{agreement.id.toString()}</span>
                  <strong>{agreement.title || `Agreement #${agreement.id.toString()}`}</strong>
                  <small>{agreement.proofURI ? "Proof submitted" : "Settled without submitted proof"}</small>
                </div>
                <div>
                  <strong>{formatUsdc(agreement.amount)}</strong>
                  <span>{agreement.completedAt > 0n ? formatDate(agreement.completedAt) : statusLabels[agreement.status]}</span>
                </div>
                <ArrowRight size={17} weight="bold" aria-hidden="true" />
              </a>
            ))}
          </div>
        ) : (
          <EmptyState title="No completed work yet" body="Completed Handsel settlements will appear here automatically." />
        )}
      </section>

      <p className="passport-disclaimer">
        This passport reports Handsel agreement activity only. It is not an identity check, credit score, or subjective rating.
      </p>
    </div>
  );
}

function PassportMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="passport-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function CreateAgreementPage() {
  const { address, isConnected } = useAccount();
  const queryClient = useQueryClient();
  const { run, isPending, txState } = useTxRunner();
  const [title, setTitle] = useState("");
  const [beneficiary, setBeneficiary] = useState("");
  const [arbiter, setArbiter] = useState("");
  const [amount, setAmount] = useState("");
  const [deadline, setDeadline] = useState(defaultDeadlineInput);
  const [criteriaURI, setCriteriaURI] = useState("");
  const [metadataURI, setMetadataURI] = useState("");
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
  const hasSufficientBalance = parsedAmount !== null && parsedAmount <= balance;
  const formError = validateCreateForm({ arbiter, amount: parsedAmount, beneficiary, criteriaURI, deadline, title });
  const formStarted = Boolean(title || amount || beneficiary || arbiter || criteriaURI || metadataURI);
  const workReady = title.trim().length >= 3 && criteriaURI.trim().length >= 10;
  const peopleReady =
    isAddress(beneficiary) &&
    isAddress(arbiter) &&
    beneficiary.toLowerCase() !== arbiter.toLowerCase();
  const deadlineReady = new Date(deadline).getTime() > Date.now();
  const amountReady = parsedAmount !== null && parsedAmount > 0n;
  const settlementReady = amountReady && deadlineReady;
  const walletReady = isConnected && hasSufficientBalance;

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
    <div className="create-page">
      <section className="create-heading create-heading-refined">
        <a className="back-link" href="#/dashboard">
          <ArrowRight size={16} weight="bold" />
          Agreements
        </a>
        <div className="create-title-row">
          <div>
            <span className="page-kicker">New agreement</span>
            <h1>Set the terms.</h1>
          </div>
          <span className="draft-mark">Draft</span>
        </div>
        <p>Describe the result, choose the people, and commit the USDC.</p>
      </section>

      <div className="agreement-composer">
        <section className="agreement-document" aria-label="New work agreement">
          <div className="composer-section composer-opening">
            <div className="composer-section-heading">
              <div className="composer-heading-icon" aria-hidden="true">
                <NotePencil size={19} weight="duotone" />
              </div>
              <div>
                <h2>Work</h2>
                <p>Name the outcome and when it is due.</p>
              </div>
            </div>

            <Field label="What are you hiring for?">
              <input
                autoComplete="off"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="e.g. Build a cafe booking page"
              />
            </Field>

            <div className="terms-grid">
              <Field label="Payment">
                <div className="amount-input composer-amount-input">
                  <CurrencyCircleDollar size={18} weight="duotone" aria-hidden="true" />
                  <input
                    aria-label="Payment amount in USDC"
                    inputMode="decimal"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    placeholder="0.00"
                  />
                  <span>USDC</span>
                </div>
              </Field>
              <Field label="Due date">
                <div className="date-input-wrap">
                  <CalendarBlank size={18} weight="duotone" aria-hidden="true" />
                  <input
                    aria-label="Agreement deadline"
                    type="datetime-local"
                    value={deadline}
                    onChange={(event) => setDeadline(event.target.value)}
                  />
                </div>
              </Field>
            </div>
          </div>

          <div className="composer-section">
            <div className="composer-section-heading">
              <div className="composer-heading-icon" aria-hidden="true">
                <CheckCircle size={19} weight="duotone" />
              </div>
              <div>
                <h2>What counts as done?</h2>
                <p>Write criteria the worker can prove and you can verify.</p>
              </div>
            </div>
            <Field label="Acceptance criteria" helper="Be specific about links, files, screenshots, or handoff materials.">
              <textarea
                value={criteriaURI}
                onChange={(event) => setCriteriaURI(event.target.value)}
                placeholder="The page is live, works on mobile, and includes the source repository and handoff notes."
                rows={4}
              />
            </Field>

            <details className="optional-context">
              <summary>
                <span>
                  <FileText size={17} weight="duotone" aria-hidden="true" />
                  Add brief or reference link
                </span>
                <span className="optional-label">Optional</span>
                <CaretDown size={16} weight="bold" aria-hidden="true" />
              </summary>
              <Field label="Project context" helper="Add a short brief, reference URL, or metadata URI.">
                <textarea
                  value={metadataURI}
                  onChange={(event) => setMetadataURI(event.target.value)}
                  placeholder="Context that will help the worker deliver the right result."
                  rows={3}
                />
              </Field>
            </details>
          </div>

          <div className="composer-section composer-people">
            <div className="composer-section-heading">
              <div className="composer-heading-icon" aria-hidden="true">
                <UserCircle size={19} weight="duotone" />
              </div>
              <div>
                <h2>People</h2>
                <p>Choose the worker and an independent dispute resolver.</p>
              </div>
            </div>
            <div className="people-grid">
              <div className="role-field">
                <div className="role-field-title">
                  <UserCircle size={18} weight="duotone" aria-hidden="true" />
                  <span>Worker</span>
                </div>
                <Field label="Receives payment after approval">
                  <input
                    autoComplete="off"
                    className="address-input"
                    value={beneficiary}
                    onChange={(event) => setBeneficiary(event.target.value)}
                    placeholder="0x worker address"
                  />
                </Field>
              </div>
              <div className="role-field">
                <div className="role-field-title">
                  <Gavel size={18} weight="duotone" aria-hidden="true" />
                  <span>Resolver</span>
                </div>
                <Field label="Can split funds only after a dispute">
                  <input
                    autoComplete="off"
                    className="address-input"
                    value={arbiter}
                    onChange={(event) => setArbiter(event.target.value)}
                    placeholder="0x resolver address"
                  />
                </Field>
              </div>
            </div>
          </div>
        </section>

        <aside className="settlement-rail">
          <div className="agreement-preview">
            <div className="preview-heading">
              <span>Agreement preview</span>
              <span className="status-pill">Created</span>
            </div>
            <strong className={title.trim() ? "preview-title" : "preview-title preview-placeholder"}>
              {title.trim() || "Untitled work agreement"}
            </strong>
            <div className="preview-value" aria-live="polite">
              <strong>{parsedAmount === null ? "0" : formatUnits(parsedAmount, usdcDecimals)}</strong>
              <span>USDC</span>
            </div>
            <div className="preview-facts">
              <div>
                <CalendarBlank size={16} weight="duotone" aria-hidden="true" />
                <span>{deadlineReady ? formatDate(BigInt(Math.floor(new Date(deadline).getTime() / 1000))) : "Set a future deadline"}</span>
              </div>
              <div>
                <UserCircle size={16} weight="duotone" aria-hidden="true" />
                <span>{isAddress(beneficiary) ? `Worker ${formatAddress(beneficiary as Address)}` : "Add worker address"}</span>
              </div>
            </div>
          </div>

          <div className="composer-readiness" aria-label="Agreement readiness">
            <ReadinessItem label="Work terms" ready={workReady} />
            <ReadinessItem label="People" ready={peopleReady} />
            <ReadinessItem label="Payment and deadline" ready={settlementReady} />
            <ReadinessItem label={isConnected ? "Wallet and balance" : "Connect wallet"} ready={walletReady} />
          </div>

          <div className="composer-feedback">
            {formStarted && formError ? <InlineError message={formError} /> : null}
            {isConnected && parsedAmount !== null && !hasSufficientBalance ? (
              <InlineError message="Your USDC balance is below this payment." />
            ) : null}
            <TxStatus state={txState} />
          </div>

          <div className="funding-state">
            <span>Available</span>
            <strong>{isConnected ? formatUsdc(balance) : "Wallet not connected"}</strong>
          </div>

          <div className="composer-actions">
            {!amountReady ? (
              <div className="allowance-pending">
                <ShieldCheck size={18} weight="duotone" aria-hidden="true" />
                <span>Set payment to continue</span>
              </div>
            ) : needsApproval ? (
              <button
                className="secondary-button approval-button"
                disabled={!contractsConfigured || !isConnected || !hasSufficientBalance || Boolean(formError) || isPending}
                type="button"
                onClick={approve}
              >
                <ShieldCheck size={18} weight="duotone" />
                {isPending ? "Confirm in wallet" : isConnected ? "Approve USDC" : "Connect wallet to continue"}
              </button>
            ) : (
              <div className="allowance-ready">
                <CheckCircle size={18} weight="fill" aria-hidden="true" />
                <span>USDC approval ready</span>
              </div>
            )}
            <button
              className="primary-button create-submit"
              disabled={
                !contractsConfigured ||
                !isConnected ||
                needsApproval ||
                !hasSufficientBalance ||
                Boolean(formError) ||
                isPending
              }
              type="button"
              onClick={createAgreement}
            >
              <Plus size={18} weight="bold" />
              {isPending ? "Confirm in wallet" : "Create agreement"}
            </button>
          </div>

          <p className="settlement-note">USDC is held by the Handsel contract. Release requires submitted proof and your approval.</p>
        </aside>
      </div>
    </div>
  );
}

function ReadinessItem({ label, ready }: { label: string; ready: boolean }) {
  return (
    <div className={ready ? "readiness-item ready" : "readiness-item"}>
      <CheckCircle size={17} weight={ready ? "fill" : "regular"} aria-hidden="true" />
      <span>{label}</span>
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
          <DetailItem label="Worker" value={agreement.beneficiary} copy />
          <DetailItem label="Resolver" value={agreement.arbiter} copy />
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
                <strong>Resolve settlement split</strong>
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
                      Worker: {formatSplitAmount(workerBps)} / Client: {formatSplitAmount(preset.clientBps)}
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
  const receipt = buildReceipt({
      id: agreement.id,
      client: agreement.client,
      beneficiary: agreement.beneficiary,
      arbiter: agreement.arbiter,
      amountLabel: formatUsdc(agreement.amount),
      title: agreement.title,
      criteriaURI: agreement.criteriaURI,
      proofURI: agreement.proofURI,
      statusLabel: statusLabels[agreement.status] ?? "Unknown",
    });

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
        <DetailItem label="Proof" value={agreement.proofURI ? "Submitted" : "Not submitted"} />
      </div>
    </section>
  );
}

function ReceiptPage({ agreementId }: { agreementId: bigint }) {
  const agreementRead = useAgreementRead(agreementId);
  const agreement = useMemo(() => normalizeAgreement(agreementRead.data, agreementId), [agreementRead.data, agreementId]);
  const indexedActivity = useQuery({
    queryKey: ["receipt-activity", agreement?.client, agreementId.toString()],
    queryFn: () => getPersonalActivity(agreement!.client),
    enabled: activityApiConfigured && Boolean(agreement),
  });

  if (agreementRead.isLoading) return <DetailSkeleton />;
  if (agreementRead.error) return <InlineError message={agreementRead.error.message} />;
  if (!agreement) return <EmptyState title="Receipt not found" body="Check the id and contract address." />;

  const receipt = buildReceipt({
      id: agreement.id,
      client: agreement.client,
      beneficiary: agreement.beneficiary,
      arbiter: agreement.arbiter,
      amountLabel: formatUsdc(agreement.amount),
      title: agreement.title,
      criteriaURI: agreement.criteriaURI,
      proofURI: agreement.proofURI,
      statusLabel: statusLabels[agreement.status] ?? "Unknown",
    });
  const isSettled = agreement.status === 3 || agreement.status === 5;
  const receiptEvents = (indexedActivity.data?.events ?? []).filter(
    (event) => BigInt(event.agreement_id) === agreement.id,
  );

  return (
    <section className="receipt-panel">
      <a className="back-link" href={`#/agreements/${agreement.id.toString()}`}>
        <ArrowRight size={16} weight="bold" />
        Agreement
      </a>
      <div className="detail-title">
        <div>
          <span className="page-kicker">Public settlement receipt</span>
          <span className={`status-pill status-${receipt.status.toLowerCase()}`}>{receipt.status}</span>
          <h1>{receipt.heading}</h1>
        </div>
        <strong>{formatUsdc(agreement.amount)}</strong>
      </div>
      <p className="muted-copy">
        Verifiable Handsel agreement history derived from the deployed contract on Arc Testnet.
      </p>

      <div className={isSettled ? "receipt-outcome settled" : "receipt-outcome"}>
        {isSettled ? <CheckCircle size={22} weight="fill" /> : <ClockCountdown size={22} weight="duotone" />}
        <div>
          <strong>
            {agreement.status === 3
              ? "Work completed and USDC released"
              : agreement.status === 5
                ? "Dispute resolved and settlement completed"
                : "Agreement settlement is still in progress"}
          </strong>
          <p>
            {agreement.proofURI
              ? "The worker submitted proof before settlement."
              : "No proof submission is recorded for this agreement."}
          </p>
        </div>
      </div>

      <div className="receipt-grid">
        {receipt.parties.map((item) => (
          <DetailItem key={item.label} label={item.label} value={item.value} copy />
        ))}
        {receipt.facts.map((item) => (
          <DetailItem key={item.label} label={item.label} value={item.value} />
        ))}
      </div>

      <section className="receipt-verification">
        <div className="section-heading compact">
          <div>
            <span className="eyebrow">Verification</span>
            <h2>Check the onchain record</h2>
          </div>
          <a className="text-link" href={arcScanContractUrl} rel="noreferrer" target="_blank">
            Verified contract <ArrowSquareOut size={16} weight="bold" />
          </a>
        </div>
        {receiptEvents.length ? (
          <div className="receipt-event-list">
            {receiptEvents.slice(0, 8).map((event) => (
              <a href={`https://testnet.arcscan.app/tx/${event.tx_hash}`} key={event.notification_id} rel="noreferrer" target="_blank">
                <span>{formatEventName(event.event_name)}</span>
                <small>{new Date(event.confirmed_at).toLocaleString()}</small>
                <ArrowSquareOut size={15} weight="bold" />
              </a>
            ))}
          </div>
        ) : (
          <p className="receipt-verification-note">
            Agreement state is read directly from the verified contract. Indexed transaction links appear when the Circle activity service is configured.
          </p>
        )}
      </section>

      <div className="receipt-passport-links">
        <a href={`#/profile/${agreement.client}`}><IdentificationCard size={17} weight="duotone" /> Client Work Passport</a>
        <a href={`#/profile/${agreement.beneficiary}`}><Briefcase size={17} weight="duotone" /> Worker Work Passport</a>
      </div>

      <p className="receipt-legal-note">This public product record is not a regulated escrow receipt or legal settlement document.</p>
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
    <div className="inline-error" role="alert">
      <WarningCircle size={18} weight="duotone" />
      <span>{message}</span>
    </div>
  );
}

function TxStatus({ state }: { state?: TxState }) {
  if (!state) return null;
  if (state.error) return <InlineError message={state.error} />;

  return (
    <div className="tx-status" role="status" aria-live="polite">
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
  const [isConfirming, setIsConfirming] = useState(false);

  async function run(label: string, request: WriteRequest) {
    if (isConfirming) return undefined;

    try {
      setIsConfirming(true);
      setTxState({ label });
      const hash = await writeContractAsync(request);
      setTxState({ label: "Waiting for confirmation", hash });
      await publicClient?.waitForTransactionReceipt({ hash });
      await queryClient.invalidateQueries();
      setTxState({ label, hash, success: "Transaction confirmed" });
      return hash;
    } catch (error) {
      setTxState({ label, error: transactionErrorMessage(error) });
      return undefined;
    } finally {
      setIsConfirming(false);
    }
  }

  return { run, isPending: isPending || isConfirming, txState };
}

function transactionErrorMessage(error: unknown) {
  if (!(error instanceof Error)) return "Transaction failed.";

  const walletError = error as Error & { shortMessage?: unknown; details?: unknown };
  const shortMessage = typeof walletError.shortMessage === "string" ? walletError.shortMessage : "";
  const details = typeof walletError.details === "string" ? walletError.details : "";
  const message = shortMessage || details || error.message;

  return message.split("\nRequest Arguments:")[0].trim() || "Transaction failed.";
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
  if (!isAddress(beneficiary)) return "Enter a valid worker address.";
  if (!isAddress(arbiter)) return "Enter a valid resolver address.";
  if (beneficiary.toLowerCase() === arbiter.toLowerCase()) return "Worker and resolver must be different wallets.";
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
