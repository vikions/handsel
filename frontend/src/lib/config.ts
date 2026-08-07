import { createConfig } from "wagmi";
import { injected } from "wagmi/connectors";
import { defineChain, fallback, http, isAddress, zeroAddress } from "viem";
import { createCirclePasskeyProvider, type CircleWalletMode } from "./circleWallet";

const rawChainId = import.meta.env.VITE_ARC_TESTNET_CHAIN_ID;
const parsedChainId = Number(rawChainId);

export const arcChainId =
  Number.isSafeInteger(parsedChainId) && parsedChainId > 0 ? parsedChainId : 31337;
export const arcRpcUrl = import.meta.env.VITE_ARC_TESTNET_RPC_URL || "https://rpc.drpc.testnet.arc.io";
export const arcFallbackRpcUrl = import.meta.env.VITE_ARC_FALLBACK_RPC_URL || "https://rpc.quicknode.testnet.arc.io";
const arcRpcUrls = [...new Set([arcRpcUrl, arcFallbackRpcUrl].filter(Boolean))];

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
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: arcRpcUrls,
    },
  },
  contracts: {
    multicall3: {
      address: "0xcA11bde05977b3631167028862bE2a173976CA11",
    },
  },
});

export const circleClientKey = import.meta.env.VITE_CIRCLE_CLIENT_KEY || "";
export const circleClientUrl = import.meta.env.VITE_CIRCLE_CLIENT_URL || "";
export const circleWalletConfigured = Boolean(circleClientKey && circleClientUrl);
export const circlePasskeyProvider = createCirclePasskeyProvider({
  chain: arcTestnet,
  clientKey: circleClientKey,
  clientUrl: circleClientUrl,
});

export function selectCircleWalletMode(mode: CircleWalletMode) {
  circlePasskeyProvider.setMode(mode);
}

export const wagmiConfig = createConfig({
  chains: [arcTestnet],
  connectors: [
    injected({ shimDisconnect: true }),
    injected({
      shimDisconnect: true,
      target: {
        id: "circlePasskey",
        name: "Circle Passkey",
        provider: circlePasskeyProvider as never,
      },
    }),
  ],
  transports: {
    [arcTestnet.id]: fallback(arcRpcUrls.map((url) => http(url))),
  },
});
