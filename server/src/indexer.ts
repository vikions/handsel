import { zeroAddress, type Hex } from "viem";
import { env, integrationStatus } from "./config.js";
import { decodeHandselEvent, publicClient, readAgreementSnapshot } from "./handsel.js";
import { getIndexerCursor, indexedEventId, persistIndexedEvent, setIndexerCursor } from "./repository.js";

const chunkSize = 1_000n;
let activeSync: Promise<void> | undefined;

export function nextScanWindow(latest: bigint, confirmations: bigint, fromBlock: bigint, size = chunkSize) {
  if (confirmations < 0n || size < 1n) throw new Error("Invalid indexer scan settings.");
  if (latest < confirmations || fromBlock > latest - confirmations) return undefined;
  const confirmedHead = latest - confirmations;
  return { fromBlock, toBlock: min(fromBlock + size - 1n, confirmedHead) };
}

export function indexerConfigured() {
  return integrationStatus.supabase && env.handselAddress !== zeroAddress && env.deploymentBlock > 0n;
}

export function syncHandselEvents() {
  if (!indexerConfigured()) return Promise.resolve();
  activeSync ??= runSync().finally(() => {
    activeSync = undefined;
  });
  return activeSync;
}

export function startHandselIndexer() {
  if (!indexerConfigured()) return;
  void syncHandselEvents().catch(logIndexerError);
  const timer = setInterval(() => void syncHandselEvents().catch(logIndexerError), env.indexerIntervalMs);
  timer.unref();
}

async function runSync() {
  const connectedChainId = await publicClient.getChainId();
  if (connectedChainId !== env.chainId) {
    throw new Error(`Arc RPC chain ID ${connectedChainId} does not match configured ${env.chainId}.`);
  }
  const latest = await publicClient.getBlockNumber();
  let fromBlock = (await getIndexerCursor()) ?? env.deploymentBlock;

  for (let window = nextScanWindow(latest, env.indexerConfirmations, fromBlock); window;
    window = nextScanWindow(latest, env.indexerConfirmations, fromBlock)) {
    const { toBlock } = window;
    const logs = await publicClient.getLogs({
      address: env.handselAddress,
      fromBlock,
      toBlock,
    });

    const decodedLogs = logs.flatMap((log) => {
      try {
        const decoded = decodeHandselEvent(log.topics as [Hex, ...Hex[]], log.data);
        return [{ log, decoded }];
      } catch {
        return [];
      }
    });
    const agreementIds = [...new Set(decodedLogs.map(({ decoded }) => decoded.agreementId))];
    const snapshots = new Map(
      await Promise.all(
        agreementIds.map(async (agreementId) => [agreementId, await readAgreementSnapshot(agreementId)] as const),
      ),
    );
    const blockTimes = new Map<bigint, string>();

    for (const { log, decoded } of decodedLogs) {
      const snapshot = snapshots.get(decoded.agreementId);
      if (!snapshot || !log.transactionHash || log.blockNumber === null || log.logIndex === null) continue;
      let confirmedAt = blockTimes.get(log.blockNumber);
      if (!confirmedAt) {
        const block = await publicClient.getBlock({ blockNumber: log.blockNumber });
        confirmedAt = new Date(Number(block.timestamp) * 1_000).toISOString();
        blockTimes.set(log.blockNumber, confirmedAt);
      }
      await persistIndexedEvent(snapshot, {
        notificationId: indexedEventId(env.chainId, log.transactionHash, log.logIndex),
        txHash: log.transactionHash,
        blockHeight: Number(log.blockNumber),
        logIndex: String(log.logIndex),
        confirmedAt,
        decoded,
        raw: {
          source: "arc-rpc",
          network: env.network,
          chainId: env.chainId,
          contractAddress: env.handselAddress,
          blockNumber: log.blockNumber.toString(),
          transactionHash: log.transactionHash,
          logIndex: log.logIndex,
        },
      });
    }

    fromBlock = toBlock + 1n;
    await setIndexerCursor(fromBlock);
  }
}

function min(left: bigint, right: bigint) {
  return left < right ? left : right;
}

function logIndexerError(error: unknown) {
  console.error("Handsel indexer sync failed:", error instanceof Error ? error.message : error);
}
