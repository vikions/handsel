import { randomUUID } from "node:crypto";

const apiKey = process.env.CIRCLE_API_KEY;
const contractAddress = process.env.HANDSEL_CONTRACT_ADDRESS;
const blockchain = process.env.CIRCLE_BLOCKCHAIN;
const apiBaseUrl = "https://api.circle.com";
const webhookUrl = process.env.HANDSEL_WEBHOOK_URL;

const eventSignatures = [
  "AgreementCreated(uint256,address,address,address,uint256,uint256,string,string,string)",
  "AgreementAccepted(uint256,address)",
  "ProofSubmitted(uint256,address,string)",
  "ProofApprovedAndReleased(uint256,address,address,uint256)",
  "AgreementReleased(uint256,address,address,uint256)",
  "AgreementDisputed(uint256,address)",
  "AgreementResolved(uint256,address,uint256,uint256,uint16,uint16)",
  "AgreementRefunded(uint256,address,uint256)",
  "AgreementCancelled(uint256,address,uint256)",
];

if (!apiKey) {
  throw new Error("CIRCLE_API_KEY is required. Add it to the local root .env file only.");
}
if (!contractAddress) {
  throw new Error("HANDSEL_CONTRACT_ADDRESS is required.");
}
if (!/^0x[a-fA-F0-9]{40}$/.test(contractAddress)) {
  throw new Error("HANDSEL_CONTRACT_ADDRESS must be an EVM address.");
}
if (blockchain !== "ARC" && blockchain !== "ARC-TESTNET") {
  throw new Error("Set CIRCLE_BLOCKCHAIN explicitly to ARC or ARC-TESTNET.");
}
if (blockchain === "ARC") {
  if (process.env.ARC_NETWORK !== "mainnet") throw new Error("ARC_NETWORK must be mainnet for ARC monitors.");
  if (apiKey.startsWith("TEST_")) throw new Error("A testnet Circle API key cannot configure ARC mainnet monitors.");
  if (process.env.CONFIRM_CIRCLE_MAINNET_MONITORS !== "HANDSEL_ARC_MAINNET_5042") {
    throw new Error("Circle mainnet monitor creation is locked. Set CONFIRM_CIRCLE_MAINNET_MONITORS only after separate approval.");
  }
  if (!webhookUrl) throw new Error("HANDSEL_WEBHOOK_URL is required for mainnet monitors.");
} else if (process.env.ARC_NETWORK === "mainnet") {
  throw new Error("Refusing to create ARC-TESTNET monitors while ARC_NETWORK is mainnet.");
}
if (webhookUrl && new URL(webhookUrl).protocol !== "https:") {
  throw new Error("HANDSEL_WEBHOOK_URL must use HTTPS.");
}

const existing = await circleRequest(
  `/v1/w3s/contracts/monitors?blockchain=${blockchain}&contractAddress=${contractAddress}`,
);
const monitors = existing.data?.eventMonitors ?? [];
const monitoredEvents = new Set(monitors.map((monitor) => eventName(monitor.eventSignature)));

for (const eventSignature of eventSignatures) {
  const name = eventName(eventSignature);
  if (monitoredEvents.has(name)) {
    console.log(`Existing: ${name}`);
    continue;
  }

  const result = await circleRequest("/v1/w3s/contracts/monitors", {
    method: "POST",
    body: JSON.stringify({
      blockchain,
      contractAddress,
      eventSignature,
      idempotencyKey: randomUUID(),
    }),
  });
  const monitor = result.data?.eventMonitor;
  console.log(`Created: ${name}${monitor?.id ? ` (${monitor.id})` : ""}`);
}

console.log(`Circle Contracts event monitors configured for ${contractAddress} on ${blockchain}. Verify webhook delivery separately.`);

if (webhookUrl) {
  const existingSubscriptions = await circleRequest("/v2/notifications/subscriptions");
  const subscriptions = Array.isArray(existingSubscriptions.data)
    ? existingSubscriptions.data
    : (existingSubscriptions.data?.subscriptions ?? []);
  const existingSubscription = subscriptions.find(
    (subscription) => subscription.endpoint === webhookUrl && subscription.enabled !== false,
  );

  if (existingSubscription) {
    console.log(`Existing webhook: ${webhookUrl}`);
  } else {
    const created = await circleRequest("/v2/notifications/subscriptions", {
      method: "POST",
      body: JSON.stringify({ endpoint: webhookUrl, notificationTypes: ["contracts.eventLog"] }),
    });
    const subscription = created.data?.subscription;
    console.log(`Created webhook: ${webhookUrl}${subscription?.id ? ` (${subscription.id})` : ""}`);
  }
} else {
  console.log("Webhook not configured: set HANDSEL_WEBHOOK_URL after the API is live.");
}

async function circleRequest(path, options = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "X-Request-Id": randomUUID(),
      ...options.headers,
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = payload.message || payload.code || response.statusText;
    throw new Error(`Circle API request failed (${response.status}): ${detail}`);
  }
  return payload;
}

function eventName(signature) {
  return signature.slice(0, signature.indexOf("("));
}
