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

export const arcEscrowAddress = envAddress(import.meta.env.VITE_ARC_ESCROW_ADDRESS);
export const usdcAddress = envAddress(import.meta.env.VITE_USDC_ADDRESS);
export const usdcDecimals = 6;

export const configIssues = [
  !rawChainId ? "VITE_ARC_TESTNET_CHAIN_ID is not set." : null,
  rawChainId && arcChainId === 31337 ? "VITE_ARC_TESTNET_CHAIN_ID is not a valid positive integer." : null,
  !import.meta.env.VITE_ARC_TESTNET_RPC_URL ? "VITE_ARC_TESTNET_RPC_URL is not set." : null,
  arcEscrowAddress === zeroAddress ? "VITE_ARC_ESCROW_ADDRESS is not set to a valid address." : null,
  usdcAddress === zeroAddress ? "VITE_USDC_ADDRESS is not set to a valid address." : null,
].filter(Boolean) as string[];

export const contractsConfigured = configIssues.length === 0;

export const arcTestnet = defineChain({
  id: arcChainId,
  name: "Arc Testnet",
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
