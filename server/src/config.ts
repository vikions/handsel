import { getAddress, isAddress, type Address } from "viem";

const defaultContract = "0x51bfB2A08E7680786eD54a00eE4d915Bab6B3867";

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
  arcRpcUrl: process.env.ARC_TESTNET_RPC_URL || "https://rpc.drpc.testnet.arc.io",
  handselAddress: address(process.env.HANDSEL_CONTRACT_ADDRESS, defaultContract),
  circleApiKey: process.env.CIRCLE_API_KEY || "",
  supabaseUrl: process.env.SUPABASE_URL || "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
};

export const integrationStatus = {
  circle: Boolean(env.circleApiKey),
  supabase: Boolean(env.supabaseUrl && env.supabaseServiceRoleKey),
};
