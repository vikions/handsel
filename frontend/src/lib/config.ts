import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { defineChain, isAddress, zeroAddress } from "viem";

const rawChainId = import.meta.env.VITE_ARC_TESTNET_CHAIN_ID;
const parsedChainId = Number(rawChainId);

export const arcChainId =
  Number.isSafeInteger(parsedChainId) && parsedChainId > 0 ? parsedChainId : 31337;
export const arcRpcUrl = import.meta.env.VITE_ARC_TESTNET_RPC_URL || "http://127.0.0.1:8545";

function envAddress(value: string | undefined): `0x${string}` {
  return value && isAddress(value) ? value : zeroAddress;
}

export const handselAddress = envAddress(import.meta.env.VITE_HANDSEL_CONTRACT_ADDRESS);
export const usdcAddress = envAddress(import.meta.env.VITE_USDC_ADDRESS);
export const usdcDecimals = 6;

export const configIssues = [
  !rawChainId ? "Arc chain id is missing." : null,
  rawChainId && arcChainId === 31337 ? "Arc chain id is not valid." : null,
  !import.meta.env.VITE_ARC_TESTNET_RPC_URL ? "Arc RPC URL is missing." : null,
  handselAddress === zeroAddress ? "Handsel contract address is missing or invalid." : null,
  usdcAddress === zeroAddress ? "USDC address is missing or invalid." : null,
].filter(Boolean) as string[];

export const contractsConfigured = configIssues.length === 0;

export const arcTestnet = defineChain({
  id: arcChainId,
  name: "Arc",
  nativeCurrency: {
    name: "USDC",
    symbol: "USDC",
    decimals: 6,
  },
  rpcUrls: {
    default: {
      http: [arcRpcUrl],
    },
  },
});

export const wagmiConfig = createConfig({
  chains: [arcTestnet],
  connectors: [injected({ shimDisconnect: true })],
  transports: {
    [arcTestnet.id]: http(arcRpcUrl),
  },
});
