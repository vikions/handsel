import { getAddress, isAddress, zeroAddress, type Address } from "viem";

export type ArcNetwork = "mainnet" | "testnet";

const requestedNetwork = process.env.ARC_NETWORK?.toLowerCase();
const network: ArcNetwork = requestedNetwork === "testnet" ? "testnet" : "mainnet";
const isMainnet = network === "mainnet";
const defaultContract = isMainnet
  ? zeroAddress
  : "0x51bfB2A08E7680786eD54a00eE4d915Bab6B3867";
const expectedChainId = isMainnet ? 5_042 : 5_042_002;
const configuredChainId = Number(process.env.ARC_CHAIN_ID || expectedChainId);

if (requestedNetwork && requestedNetwork !== "mainnet" && requestedNetwork !== "testnet") {
  throw new Error("ARC_NETWORK must be mainnet or testnet.");
}
if (configuredChainId !== expectedChainId) {
  throw new Error(`ARC_CHAIN_ID must be ${expectedChainId} for ${network}.`);
}

function address(value: string | undefined, fallback: string): Address {
  const candidate = value || fallback;
  if (!isAddress(candidate)) throw new Error(`Invalid address in server configuration: ${candidate}`);
  return getAddress(candidate);
}

export const env = {
  port: Number(process.env.PORT || 8787),
  allowedOrigins: (process.env.APP_ORIGIN || "http://localhost:5173")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
  network,
  chainId: configuredChainId,
  networkName: isMainnet ? "Arc Mainnet" : "Arc Testnet",
  circleBlockchain: isMainnet ? "ARC" : "ARC-TESTNET",
  arcRpcUrl:
    process.env.ARC_RPC_URL ||
    (!isMainnet ? process.env.ARC_TESTNET_RPC_URL : undefined) ||
    (isMainnet ? "https://rpc.drpc.mainnet.arc.io" : "https://rpc.drpc.testnet.arc.io"),
  handselAddress: address(process.env.HANDSEL_CONTRACT_ADDRESS, defaultContract),
  usdcAddress: address(process.env.USDC_ADDRESS, "0x3600000000000000000000000000000000000000"),
  deploymentBlock: BigInt(process.env.HANDSEL_DEPLOYMENT_BLOCK || "0"),
  indexerIntervalMs: Math.max(Number(process.env.INDEXER_INTERVAL_MS || 15_000), 5_000),
  indexerConfirmations: BigInt(process.env.INDEXER_CONFIRMATIONS || (isMainnet ? "2" : "1")),
  circleApiKey: process.env.CIRCLE_API_KEY || "",
  supabaseUrl: process.env.SUPABASE_URL || "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
};

export const integrationStatus = {
  circleWebhookVerificationConfigured: Boolean(env.circleApiKey),
  supabase: Boolean(env.supabaseUrl && env.supabaseServiceRoleKey),
  contract: env.handselAddress !== zeroAddress,
};
