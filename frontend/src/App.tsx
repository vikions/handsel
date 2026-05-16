import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle,
  ClockCountdown,
  Copy,
  Handshake,
  Plus,
  Scales,
  ShieldCheck,
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
import {
  formatUnits,
  isAddress,
  parseUnits,
  zeroAddress,
  type Address,
  type Hash,
} from "viem";
import { arcEscrowAddress, configIssues, contractsConfigured, usdcAddress, usdcDecimals } from "./lib/config";
import { arcEscrowAbi, erc20Abi } from "./lib/abi";

const statusLabels = ["Created", "Active", "Completed", "Disputed", "Resolved", "Refunded", "Cancelled"] as const;

type Route =
  | { page: "dashboard" }
  | { page: "create" }
  | { page: "detail"; escrowId: bigint };

type EscrowRecord = {
  id: bigint;
  client: Address;
  beneficiary: Address;
  arbiter: Address;
  amount: bigint;
  deadline: bigint;
  metadataURI: string;
  status: number;
  createdAt: bigint;
  acceptedAt: bigint;
  completedAt: bigint;
};

type ReadRow = {
  status?: string;
  result?: unknown;
  error?: Error;
};

type TxState = {
  label: string;
  hash?: Hash;
  error?: string;
  success?: string;
};

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
        {route.page === "create" ? <CreateEscrowPage /> : null}
        {route.page === "detail" ? <EscrowDetailPage escrowId={route.escrowId} /> : null}
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
  if (normalized === "/create") {
    return { page: "create" };
  }
  if (normalized.startsWith("/escrow/")) {
    try {
      return { page: "detail", escrowId: BigInt(normalized.replace("/escrow/", "")) };
    } catch {
      return { page: "dashboard" };
    }
  }
  return { page: "dashboard" };
}

function Header({ route }: { route: Route }) {
  return (
    <header className="topbar">
      <a className="brand" href="#/">
        <span className="brand-mark">
          <ShieldCheck size={20} weight="duotone" />
        </span>
        <span>ArcEscrow</span>
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
        if (connector) {
          connect({ connector });
        }
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
      <span>Arc testnet MVP</span>
      <span>USDC escrow deposits and Arc gas fees are shown in USDC terms where the network exposes them.</span>
    </div>
  );
}

function ConfigWarning() {
  if (contractsConfigured) {
    return null;
  }

  return (
    <section className="notice-panel">
      <WarningCircle size={20} weight="duotone" />
      <div>
        <strong>Configuration needed</strong>
        <p>Set the Arc testnet RPC, chain id, ArcEscrow address, and USDC token address before using live reads or writes.</p>
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
      { address: arcEscrowAddress, abi: arcEscrowAbi, functionName: "getEscrowCount" },
      { address: arcEscrowAddress, abi: arcEscrowAbi, functionName: "totalVolume" },
      { address: arcEscrowAddress, abi: arcEscrowAbi, functionName: "completedEscrows" },
      { address: arcEscrowAddress, abi: arcEscrowAbi, functionName: "disputedEscrows" },
    ],
    query: { enabled: contractsConfigured },
  });

  const totalEscrows = readBigInt(stats.data, 0);
  const totalVolume = readBigInt(stats.data, 1);
  const completed = readBigInt(stats.data, 2);
  const disputed = readBigInt(stats.data, 3);

  return (
    <div className="dashboard-grid">
      <section className="hero-panel">
        <div className="eyebrow">Programmable payment guarantee primitive</div>
        <h1>Lock USDC into a programmable escrow on Arc testnet.</h1>
        <p>
          Beneficiary sees guaranteed funds before starting work. Release or resolve with transparent onchain settlement.
        </p>
        <div className="hero-actions">
          <a className="primary-link" href="#/create">
            <Plus size={18} weight="bold" />
            Create escrow
          </a>
          <a className="secondary-link" href="#user-escrows">
            View activity
            <ArrowRight size={18} weight="bold" />
          </a>
        </div>
      </section>

      <section className="stats-panel" aria-label="Protocol stats">
        <Metric label="Total escrows" value={totalEscrows.toString()} loading={stats.isLoading} />
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
          <h2>Agent Escrow Demo</h2>
          <p>AI agents can create, accept, and settle task-based payments using the same escrow primitive.</p>
        </div>
      </section>

      <section className="activity-panel" id="user-escrows">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Wallet activity</span>
            <h2>Your escrows</h2>
          </div>
          <a className="text-link" href="#/create">
            New escrow
            <ArrowRight size={16} weight="bold" />
          </a>
        </div>
        <UserEscrows />
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

function UserEscrows() {
  const { address, isConnected } = useAccount();

  const userIdsRead = useReadContract({
    address: arcEscrowAddress,
    abi: arcEscrowAbi,
    functionName: "getUserEscrowIds",
    args: [address ?? zeroAddress, 0n, 25n],
    query: { enabled: contractsConfigured && isConnected && Boolean(address) },
  });

  const ids = useMemo(() => (Array.isArray(userIdsRead.data) ? userIdsRead.data : []), [userIdsRead.data]);

  const escrowsRead = useReadContracts({
    contracts: ids.map((id) => ({
      address: arcEscrowAddress,
      abi: arcEscrowAbi,
      functionName: "getEscrow",
      args: [id],
    })),
    query: { enabled: contractsConfigured && ids.length > 0 },
  });

  const escrows = useMemo(
    () =>
      (escrowsRead.data ?? [])
        .map((row, index) => normalizeEscrow((row as ReadRow).result, ids[index]))
        .filter((escrow): escrow is EscrowRecord => Boolean(escrow)),
    [escrowsRead.data, ids],
  );

  if (!isConnected) {
    return <EmptyState title="Connect a wallet" body="Your client, beneficiary, and arbiter escrows will appear here." />;
  }

  if (userIdsRead.isLoading || escrowsRead.isLoading) {
    return <EscrowListSkeleton />;
  }

  if (userIdsRead.error || escrowsRead.error) {
    return <InlineError message={(userIdsRead.error ?? escrowsRead.error)?.message ?? "Unable to load escrows."} />;
  }

  if (escrows.length === 0) {
    return <EmptyState title="No escrows yet" body="Create a testnet agreement or connect a participant wallet." />;
  }

  return (
    <div className="escrow-list">
      {escrows.map((escrow) => (
        <a className="escrow-row" href={`#/escrow/${escrow.id.toString()}`} key={escrow.id.toString()}>
          <div>
            <span className={`status-pill status-${statusLabels[escrow.status]?.toLowerCase() ?? "unknown"}`}>
              {statusLabels[escrow.status] ?? "Unknown"}
            </span>
            <strong>Escrow #{escrow.id.toString()}</strong>
            <p>{escrow.metadataURI || "No metadata supplied"}</p>
          </div>
          <div className="row-amount">
            <strong>{formatUsdc(escrow.amount)}</strong>
            <span>Deadline {formatDate(escrow.deadline)}</span>
          </div>
        </a>
      ))}
    </div>
  );
}

function CreateEscrowPage() {
  const { address, isConnected } = useAccount();
  const queryClient = useQueryClient();
  const { run, isPending, txState } = useTxRunner();
  const [beneficiary, setBeneficiary] = useState("");
  const [arbiter, setArbiter] = useState("");
  const [amount, setAmount] = useState("100");
  const [deadline, setDeadline] = useState(defaultDeadlineInput);
  const [metadataURI, setMetadataURI] = useState("ipfs://agreement/service-delivery");
  const parsedAmount = parseUsdcAmount(amount);

  const allowanceRead = useReadContract({
    address: usdcAddress,
    abi: erc20Abi,
    functionName: "allowance",
    args: [address ?? zeroAddress, arcEscrowAddress],
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
  const formError = validateCreateForm({ beneficiary, arbiter, amount: parsedAmount, deadline });

  async function approve() {
    if (parsedAmount === null) return;
    await run("Approving USDC", {
      address: usdcAddress,
      abi: erc20Abi,
      functionName: "approve",
      args: [arcEscrowAddress, parsedAmount],
    });
    await queryClient.invalidateQueries();
  }

  async function createEscrow() {
    if (parsedAmount === null || formError) return;
    const deadlineSeconds = BigInt(Math.floor(new Date(deadline).getTime() / 1000));
    const hash = await run("Creating escrow", {
      address: arcEscrowAddress,
      abi: arcEscrowAbi,
      functionName: "createEscrow",
      args: [beneficiary as Address, arbiter as Address, parsedAmount, deadlineSeconds, metadataURI.trim()],
    });
    if (hash) {
      window.location.hash = "#/";
    }
  }

  return (
    <div className="form-layout">
      <section className="form-copy">
        <span className="eyebrow">Create escrow</span>
        <h1>Fund a testnet service agreement with USDC.</h1>
        <p>
          Approve USDC, lock funds into ArcEscrow, and let the beneficiary accept before work begins. Network gas is
          denominated in USDC on Arc testnet.
        </p>
        <div className="balance-strip">
          <span>Wallet balance</span>
          <strong>{formatUsdc(balance)}</strong>
        </div>
      </section>

      <section className="form-panel">
        <Field label="Beneficiary address" helper="The wallet that accepts work and receives released funds.">
          <input value={beneficiary} onChange={(event) => setBeneficiary(event.target.value)} placeholder="0x..." />
        </Field>
        <Field label="Arbiter address" helper="The wallet allowed to resolve disputes with a basis-point split.">
          <input value={arbiter} onChange={(event) => setArbiter(event.target.value)} placeholder="0x..." />
        </Field>
        <div className="form-grid">
          <Field label="Amount" helper="USDC amount, using 6 decimals.">
            <input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
          </Field>
          <Field label="Deadline" helper="Refunds open after this time if unresolved.">
            <input type="datetime-local" value={deadline} onChange={(event) => setDeadline(event.target.value)} />
          </Field>
        </div>
        <Field label="Metadata URI or description" helper="Use IPFS, HTTPS, or a concise offchain reference.">
          <textarea value={metadataURI} onChange={(event) => setMetadataURI(event.target.value)} rows={4} />
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
            onClick={createEscrow}
          >
            <Plus size={18} weight="bold" />
            Create escrow
          </button>
        </div>
      </section>
    </div>
  );
}

function EscrowDetailPage({ escrowId }: { escrowId: bigint }) {
  const { address, isConnected } = useAccount();
  const { run, isPending, txState } = useTxRunner();
  const [clientBps, setClientBps] = useState("5000");

  const escrowRead = useReadContract({
    address: arcEscrowAddress,
    abi: arcEscrowAbi,
    functionName: "getEscrow",
    args: [escrowId],
    query: { enabled: contractsConfigured },
  });

  const escrow = useMemo(() => normalizeEscrow(escrowRead.data, escrowId), [escrowRead.data, escrowId]);
  const beneficiaryBps = 10_000 - Number(clientBps || 0);

  if (escrowRead.isLoading) {
    return <DetailSkeleton />;
  }

  if (escrowRead.error) {
    return <InlineError message={escrowRead.error.message} />;
  }

  if (!escrow) {
    return <EmptyState title="Escrow not found" body="Check the id and contract address." />;
  }

  const connected = (address ?? "").toLowerCase();
  const isClient = connected === escrow.client.toLowerCase();
  const isBeneficiary = connected === escrow.beneficiary.toLowerCase();
  const isArbiter = connected === escrow.arbiter.toLowerCase();
  const isParty = isClient || isBeneficiary;
  const expired = Number(escrow.deadline) * 1000 < Date.now();

  async function callEscrow(label: string, functionName: string, args: readonly unknown[]) {
    await run(label, {
      address: arcEscrowAddress,
      abi: arcEscrowAbi,
      functionName,
      args,
    });
  }

  async function resolveDispute() {
    const clientShare = Number(clientBps);
    if (!Number.isInteger(clientShare) || clientShare < 0 || clientShare > 10_000 || beneficiaryBps < 0) {
      return;
    }
    await callEscrow("Resolving dispute", "resolveDispute", [escrow.id, clientShare, beneficiaryBps]);
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
            <span className={`status-pill status-${statusLabels[escrow.status]?.toLowerCase() ?? "unknown"}`}>
              {statusLabels[escrow.status] ?? "Unknown"}
            </span>
            <h1>Escrow #{escrow.id.toString()}</h1>
          </div>
          <strong>{formatUsdc(escrow.amount)}</strong>
        </div>

        <div className="timeline">
          {statusLabels.map((status, index) => (
            <div className={index === escrow.status ? "timeline-step current" : "timeline-step"} key={status}>
              <span />
              <p>{status}</p>
            </div>
          ))}
        </div>

        <div className="detail-grid">
          <DetailItem label="Client" value={escrow.client} copy />
          <DetailItem label="Beneficiary" value={escrow.beneficiary} copy />
          <DetailItem label="Arbiter" value={escrow.arbiter} copy />
          <DetailItem label="Deadline" value={formatDate(escrow.deadline)} />
          <DetailItem label="Created" value={formatDate(escrow.createdAt)} />
          <DetailItem label="Accepted" value={escrow.acceptedAt > 0n ? formatDate(escrow.acceptedAt) : "Not accepted"} />
        </div>

        <section className="metadata-panel">
          <span className="eyebrow">Metadata</span>
          <p>{escrow.metadataURI || "No metadata supplied."}</p>
        </section>
      </section>

      <aside className="actions-panel">
        <div className="section-heading compact">
          <div>
            <span className="eyebrow">Actions</span>
            <h2>Role-aware settlement</h2>
          </div>
        </div>
        {!isConnected ? <InlineError message="Connect a wallet to perform escrow actions." /> : null}
        {escrow.status === 0 && isBeneficiary ? (
          <ActionButton icon={<CheckCircle size={18} weight="duotone" />} disabled={isPending} onClick={() => callEscrow("Accepting escrow", "acceptEscrow", [escrow.id])}>
            Accept escrow
          </ActionButton>
        ) : null}
        {escrow.status === 1 && isClient ? (
          <ActionButton icon={<CheckCircle size={18} weight="duotone" />} disabled={isPending} onClick={() => callEscrow("Releasing escrow", "releaseEscrow", [escrow.id])}>
            Release funds
          </ActionButton>
        ) : null}
        {escrow.status === 0 && isClient ? (
          <ActionButton icon={<XCircle size={18} weight="duotone" />} disabled={isPending} onClick={() => callEscrow("Cancelling escrow", "cancelUnaccepted", [escrow.id])}>
            Cancel unaccepted
          </ActionButton>
        ) : null}
        {escrow.status === 1 && isParty ? (
          <ActionButton icon={<Scales size={18} weight="duotone" />} disabled={isPending} onClick={() => callEscrow("Opening dispute", "openDispute", [escrow.id])}>
            Open dispute
          </ActionButton>
        ) : null}
        {(escrow.status === 0 || escrow.status === 1) && isParty ? (
          <ActionButton
            icon={<ClockCountdown size={18} weight="duotone" />}
            disabled={isPending || !expired}
            onClick={() => callEscrow("Refunding expired escrow", "refundExpired", [escrow.id])}
          >
            Refund expired
          </ActionButton>
        ) : null}
        {escrow.status === 3 && isArbiter ? (
          <div className="resolve-panel">
            <Field label="Client bps" helper={`Beneficiary receives ${beneficiaryBps.toLocaleString()} bps.`}>
              <input value={clientBps} inputMode="numeric" onChange={(event) => setClientBps(event.target.value)} />
            </Field>
            <ActionButton icon={<Scales size={18} weight="duotone" />} disabled={isPending || beneficiaryBps < 0} onClick={resolveDispute}>
              Resolve dispute
            </ActionButton>
          </div>
        ) : null}
        <TxStatus state={txState} />
      </aside>
    </div>
  );
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
        <ShieldCheck size={22} weight="duotone" />
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
  if (state.error) {
    return <InlineError message={state.error} />;
  }
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

function EscrowListSkeleton() {
  return (
    <div className="escrow-list">
      {[0, 1, 2].map((item) => (
        <div className="escrow-row skeleton-row" key={item}>
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

  async function run(label: string, request: Parameters<typeof writeContractAsync>[0]) {
    try {
      setTxState({ label });
      const hash = await writeContractAsync(request);
      setTxState({ label: "Waiting for confirmation", hash });
      await publicClient?.waitForTransactionReceipt({ hash });
      await queryClient.invalidateQueries();
      setTxState({ label, hash, success: "Transaction confirmed" });
      return hash;
    } catch (error) {
      setTxState({
        label,
        error: error instanceof Error ? error.message : "Transaction failed.",
      });
      return undefined;
    }
  }

  return { run, isPending, txState };
}

function normalizeEscrow(raw: unknown, id: bigint): EscrowRecord | null {
  if (!raw) return null;
  const record = raw as Partial<EscrowRecord> & readonly unknown[];

  return {
    id,
    client: (record.client ?? record[0]) as Address,
    beneficiary: (record.beneficiary ?? record[1]) as Address,
    arbiter: (record.arbiter ?? record[2]) as Address,
    amount: (record.amount ?? record[3]) as bigint,
    deadline: (record.deadline ?? record[4]) as bigint,
    metadataURI: (record.metadataURI ?? record[5]) as string,
    status: Number(record.status ?? record[6] ?? 0),
    createdAt: (record.createdAt ?? record[7]) as bigint,
    acceptedAt: (record.acceptedAt ?? record[8]) as bigint,
    completedAt: (record.completedAt ?? record[9]) as bigint,
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
  deadline,
}: {
  arbiter: string;
  amount: bigint | null;
  beneficiary: string;
  deadline: string;
}) {
  if (!isAddress(beneficiary)) return "Enter a valid beneficiary address.";
  if (!isAddress(arbiter)) return "Enter a valid arbiter address.";
  if (beneficiary.toLowerCase() === arbiter.toLowerCase()) return "Beneficiary and arbiter must be different wallets.";
  if (amount === null || amount <= 0n) return "Enter a positive USDC amount.";
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
