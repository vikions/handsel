import { createPublicKey, randomUUID, verify } from "node:crypto";
import { env } from "./config.js";

const publicKeys = new Map<string, ReturnType<typeof createPublicKey>>();

export async function verifyCircleWebhook(rawBody: Buffer, keyId: string, signature: string) {
  if (!env.circleApiKey) throw new Error("Circle API key is not configured.");

  let key = publicKeys.get(keyId);
  if (!key) {
    const response = await fetch(`https://api.circle.com/v2/notifications/publicKey/${keyId}`, {
      headers: {
        Authorization: `Bearer ${env.circleApiKey}`,
        "X-Request-Id": randomUUID(),
      },
    });
    const payload = (await response.json().catch(() => ({}))) as {
      data?: { publicKey?: string; algorithm?: string };
      message?: string;
    };
    if (!response.ok || !payload.data?.publicKey) {
      throw new Error(payload.message || `Unable to load Circle webhook key (${response.status}).`);
    }
    if (payload.data.algorithm !== "ECDSA_SHA_256") {
      throw new Error(`Unsupported Circle signature algorithm: ${payload.data.algorithm || "unknown"}.`);
    }
    key = createPublicKey({
      key: Buffer.from(payload.data.publicKey, "base64"),
      format: "der",
      type: "spki",
    });
    publicKeys.set(keyId, key);
  }

  return verify("sha256", rawBody, key, Buffer.from(signature, "base64"));
}
