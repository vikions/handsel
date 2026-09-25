import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { getAddress } from "viem";
import { verifyCircleWebhook } from "./circle.js";
import { env, integrationStatus } from "./config.js";
import { decodeHandselEvent, readAgreementSnapshot } from "./handsel.js";
import { indexerConfigured, startHandselIndexer, syncHandselEvents } from "./indexer.js";
import { getPersonalActivity, indexedEventId, persistIndexedEvent } from "./repository.js";

type CircleEventNotification = {
  notificationId?: string;
  notificationType?: string;
  timestamp?: string;
  notification?: {
    blockchain?: string;
    contractAddress?: string;
    txHash?: string;
    blockHeight?: number;
    logIndex?: string;
    topics?: string[];
    data?: string;
    firstConfirmDate?: string;
  };
};

const server = createServer(async (request, response) => {
  applyCors(request, response);
  if (request.method === "OPTIONS") return send(response, 204, null);

  try {
    const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
    if (request.method === "GET" && url.pathname === "/health") {
      return send(response, 200, {
        service: "handsel-api",
        status: "ok",
        integrations: integrationStatus,
        contract: env.handselAddress,
        network: env.network,
        chainId: env.chainId,
        blockchain: env.circleBlockchain,
        indexer: indexerConfigured(),
      });
    }

    if (request.method === "GET" && url.pathname.startsWith("/api/activity/")) {
      const walletAddress = decodeURIComponent(url.pathname.slice("/api/activity/".length));
      await syncHandselEvents().catch((error) => {
        console.error("Activity refresh failed; serving the latest indexed state:", error);
      });
      return send(response, 200, await getPersonalActivity(walletAddress));
    }

    if (request.method === "POST" && url.pathname === "/api/webhooks/circle") {
      const rawBody = await readBody(request);
      const keyId = header(request, "x-circle-key-id");
      const signature = header(request, "x-circle-signature");
      if (!keyId || !signature || !(await verifyCircleWebhook(rawBody, keyId, signature))) {
        return send(response, 401, { error: "Invalid Circle webhook signature." });
      }

      const payload = JSON.parse(rawBody.toString("utf8")) as CircleEventNotification;
      const event = payload.notification;
      if (payload.notificationType?.toLowerCase() !== "contracts.eventlog") {
        return send(response, 202, { accepted: false, reason: "Notification type is not used by Handsel." });
      }
      if (
        !payload.notificationId ||
        !event?.contractAddress ||
        getAddress(event.contractAddress) !== env.handselAddress ||
        event.blockchain !== env.circleBlockchain ||
        !event.txHash ||
        event.logIndex === undefined ||
        !event.data ||
        !event.topics?.length
      ) {
        return send(response, 400, { error: "Incomplete or unrelated Circle event notification." });
      }

      const decoded = decodeHandselEvent(event.topics as `0x${string}`[], event.data as `0x${string}`);
      const snapshot = await readAgreementSnapshot(decoded.agreementId);
      await persistIndexedEvent(snapshot, {
        notificationId: indexedEventId(env.chainId, event.txHash, event.logIndex),
        txHash: event.txHash,
        blockHeight: event.blockHeight,
        logIndex: event.logIndex,
        confirmedAt: event.firstConfirmDate || payload.timestamp,
        decoded,
        raw: payload,
      });
      return send(response, 200, { accepted: true, agreementId: decoded.agreementId });
    }

    return send(response, 404, { error: "Not found." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    console.error(message);
    return send(response, message === "Invalid wallet address." ? 400 : 500, { error: message });
  }
});

server.listen(env.port, "0.0.0.0", () => {
  console.log(`Handsel API listening on port ${env.port}.`);
  startHandselIndexer();
});

function applyCors(request: IncomingMessage, response: ServerResponse) {
  const origin = request.headers.origin;
  if (origin && env.allowedOrigins.includes(origin)) response.setHeader("Access-Control-Allow-Origin", origin);
  response.setHeader("Vary", "Origin");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
}

function header(request: IncomingMessage, name: string) {
  const value = request.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

async function readBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 1_000_000) throw new Error("Request body is too large.");
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

function send(response: ServerResponse, status: number, body: unknown) {
  response.statusCode = status;
  if (body === null) return response.end();
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(body));
}
