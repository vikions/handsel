import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getAddress, isAddress } from "viem";
import WebSocket from "ws";
import { env } from "./config.js";
import type { AgreementSnapshot, DecodedHandselEvent } from "./handsel.js";

export type IndexedEventInput = {
  notificationId: string;
  txHash: string;
  blockHeight?: number;
  logIndex?: string;
  confirmedAt?: string;
  decoded: DecodedHandselEvent;
  raw: unknown;
};

export function indexedEventId(chainId: number, txHash: string, logIndex: string | number) {
  return `${chainId}:${txHash.toLowerCase()}:${BigInt(logIndex)}`;
}

let client: SupabaseClient | undefined;

function database() {
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    throw new Error("Supabase server configuration is missing.");
  }
  client ??= createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket as unknown as typeof globalThis.WebSocket },
  });
  return client;
}

export async function persistIndexedEvent(snapshot: AgreementSnapshot, event: IndexedEventInput) {
  const db = database();
  const { error: agreementError } = await db
    .from("agreements_index")
    .upsert(snapshot, { onConflict: "chain_id,contract_address,agreement_id" });
  if (agreementError) throw agreementError;

  const { error: eventError } = await db.from("agreement_events").upsert(
    {
      notification_id: event.notificationId,
      network: env.network,
      chain_id: env.chainId,
      contract_address: env.handselAddress.toLowerCase(),
      agreement_id: event.decoded.agreementId,
      event_name: event.decoded.eventName,
      tx_hash: event.txHash.toLowerCase(),
      block_height: event.blockHeight ?? null,
      log_index: event.logIndex === undefined ? null : BigInt(event.logIndex).toString(),
      event_args: event.decoded.args,
      raw_notification: event.raw,
      confirmed_at: event.confirmedAt || new Date().toISOString(),
    },
    { onConflict: "notification_id" },
  );
  if (eventError) {
    // Legacy Circle rows may retain UUID notification IDs but already own this chain log.
    if (eventError.code === "23505" && event.logIndex !== undefined) {
      const { data, error } = await db
        .from("agreement_events")
        .select("notification_id")
        .eq("chain_id", env.chainId)
        .eq("contract_address", env.handselAddress.toLowerCase())
        .eq("tx_hash", event.txHash.toLowerCase())
        .eq("log_index", BigInt(event.logIndex).toString())
        .maybeSingle();
      if (!error && data) return;
    }
    throw eventError;
  }
}

export async function getPersonalActivity(rawAddress: string) {
  if (!isAddress(rawAddress)) throw new Error("Invalid wallet address.");
  const address = getAddress(rawAddress).toLowerCase();
  const db = database();

  const { data: agreements, error: agreementError } = await db
    .from("agreements_index")
    .select("*")
    .eq("chain_id", env.chainId)
    .eq("contract_address", env.handselAddress.toLowerCase())
    .or(`client.eq.${address},beneficiary.eq.${address},arbiter.eq.${address}`)
    .order("updated_at", { ascending: false });
  if (agreementError) throw agreementError;

  const ids = (agreements || []).map((agreement) => agreement.agreement_id);
  if (ids.length === 0) {
    return { address, network: env.network, chainId: env.chainId, agreements: [], events: [] };
  }

  const { data: events, error: eventError } = await db
    .from("agreement_events")
    .select("notification_id,agreement_id,event_name,tx_hash,block_height,log_index,event_args,confirmed_at")
    .in("agreement_id", ids)
    .eq("chain_id", env.chainId)
    .eq("contract_address", env.handselAddress.toLowerCase())
    .order("block_height", { ascending: false, nullsFirst: false })
    .limit(200);
  if (eventError) throw eventError;

  return {
    address,
    network: env.network,
    chainId: env.chainId,
    agreements,
    events: (events || []).sort(compareIndexedEvents),
  };
}

export function compareIndexedEvents(
  left: { block_height?: number | null; log_index?: string | null; confirmed_at?: string },
  right: { block_height?: number | null; log_index?: string | null; confirmed_at?: string },
) {
  const blockDifference = (right.block_height ?? -1) - (left.block_height ?? -1);
  if (blockDifference !== 0) return blockDifference;
  const logDifference = numericLogIndex(right.log_index) - numericLogIndex(left.log_index);
  if (logDifference !== 0n) return logDifference > 0n ? 1 : -1;
  return (right.confirmed_at || "").localeCompare(left.confirmed_at || "");
}

function numericLogIndex(value?: string | null) {
  try {
    return value ? BigInt(value) : 0n;
  } catch {
    return 0n;
  }
}

export async function getIndexerCursor(): Promise<bigint | undefined> {
  const db = database();
  const { data, error } = await db
    .from("indexer_cursors")
    .select("next_block")
    .eq("chain_id", env.chainId)
    .eq("contract_address", env.handselAddress.toLowerCase())
    .maybeSingle();
  if (error) throw error;
  return data ? BigInt(data.next_block) : undefined;
}

export async function setIndexerCursor(nextBlock: bigint) {
  const db = database();
  const { error } = await db.from("indexer_cursors").upsert(
    {
      network: env.network,
      chain_id: env.chainId,
      contract_address: env.handselAddress.toLowerCase(),
      next_block: nextBlock.toString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "chain_id,contract_address" },
  );
  if (error) throw error;
}
