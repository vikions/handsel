import assert from "node:assert/strict";
import test from "node:test";
import { nextScanWindow } from "../src/indexer.js";
import { compareIndexedEvents, indexedEventId } from "../src/repository.js";

test("indexer waits for confirmations and advances in bounded chunks", () => {
  assert.equal(nextScanWindow(101n, 2n, 100n), undefined);
  assert.deepEqual(nextScanWindow(102n, 2n, 100n), { fromBlock: 100n, toBlock: 100n });
  assert.deepEqual(nextScanWindow(5000n, 2n, 100n), { fromBlock: 100n, toBlock: 1099n });
  assert.deepEqual(nextScanWindow(5000n, 2n, 1100n), { fromBlock: 1100n, toBlock: 2099n });
  assert.throws(() => nextScanWindow(5n, -1n, 0n));
});

test("RPC and Circle log representations produce the same indexed event ID", () => {
  const hash = `0x${"ab".repeat(32)}`;
  assert.equal(indexedEventId(5042, hash.toUpperCase(), "0xA"), indexedEventId(5042, hash, 10));
  assert.notEqual(indexedEventId(5042, hash, 10), indexedEventId(5042002, hash, 10));
});

test("event history orders by block and numeric log index, not shared timestamps", () => {
  const events = [
    { block_height: 10, log_index: "9", confirmed_at: "2026-09-25T00:00:00Z" },
    { block_height: 10, log_index: "10", confirmed_at: "2026-09-25T00:00:00Z" },
    { block_height: 11, log_index: "0", confirmed_at: "2026-09-25T00:00:00Z" },
  ];
  assert.deepEqual(events.sort(compareIndexedEvents).map((event) => event.log_index), ["0", "10", "9"]);
});
