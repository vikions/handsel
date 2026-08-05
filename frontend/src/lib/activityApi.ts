import { isAddress } from "viem";

export type IndexedAgreement = {
  agreement_id: number;
  title: string;
  status: number;
};

export type IndexedEvent = {
  notification_id: string;
  agreement_id: number;
  event_name: string;
  tx_hash: string;
  block_height: number | null;
  confirmed_at: string;
};

export type PersonalActivity = {
  address: string;
  agreements: IndexedAgreement[];
  events: IndexedEvent[];
};

export const activityApiUrl = (import.meta.env.VITE_HANDSEL_API_URL || "").replace(/\/$/, "");
export const activityApiConfigured = Boolean(activityApiUrl);

export async function getPersonalActivity(address: string): Promise<PersonalActivity> {
  if (!activityApiConfigured || !isAddress(address)) throw new Error("Activity service is unavailable.");
  const response = await fetch(`${activityApiUrl}/api/activity/${address}`);
  const body = (await response.json().catch(() => ({}))) as PersonalActivity & { error?: string };
  if (!response.ok) throw new Error(body.error || `Activity service returned ${response.status}.`);
  return body;
}

