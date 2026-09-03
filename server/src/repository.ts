import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getAddress, isAddress } from "viem";
import WebSocket from "ws";
import { env } from "./config.js";
import type { AgreementSnapshot, DecodedHandselEvent } from "./handsel.js";

type CircleEventInput = {
  notificationId: string;
  txHash: string;
  blockHeight?: number;
  logIndex?: string;
  confirmedAt?: string;
  decoded: DecodedHandselEvent;
  raw: unknown;
};

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

export async function persistCircleEvent(snapshot: AgreementSnapshot, event: CircleEventInput) {
  const db = database();
  const { error: agreementError } = await db.from("agreements_index").upsert(snapshot, { onConflict: "agreement_id" });
  if (agreementError) throw agreementError;

  const { error: eventError } = await db.from("agreement_events").upsert(
    {
      notification_id: event.notificationId,
      agreement_id: event.decoded.agreementId,
      event_name: event.decoded.eventName,
      tx_hash: event.txHash.toLowerCase(),
      block_height: event.blockHeight ?? null,
      log_index: event.logIndex ?? null,
      event_args: event.decoded.args,
      raw_notification: event.raw,
      confirmed_at: event.confirmedAt || new Date().toISOString(),
    },
    { onConflict: "notification_id" },
  );
  if (eventError) throw eventError;
}

export async function getPersonalActivity(rawAddress: string) {
  if (!isAddress(rawAddress)) throw new Error("Invalid wallet address.");
  const address = getAddress(rawAddress).toLowerCase();
  const db = database();

  const { data: agreements, error: agreementError } = await db
    .from("agreements_index")
    .select("*")
    .or(`client.eq.${address},beneficiary.eq.${address},arbiter.eq.${address}`)
    .order("updated_at", { ascending: false });
  if (agreementError) throw agreementError;

  const ids = (agreements || []).map((agreement) => agreement.agreement_id);
  if (ids.length === 0) return { address, agreements: [], events: [] };

  const { data: events, error: eventError } = await db
    .from("agreement_events")
    .select("notification_id,agreement_id,event_name,tx_hash,block_height,event_args,confirmed_at")
    .in("agreement_id", ids)
    .order("confirmed_at", { ascending: false })
    .limit(200);
  if (eventError) throw eventError;

  return { address, agreements, events: events || [] };
}
