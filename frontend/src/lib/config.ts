import { createConfig } from "wagmi";
import { injected } from "wagmi/connectors";
import { defineChain, fallback, http, isAddress, zeroAddress } from "viem";
import { createCirclePasskeyProvider, type CircleWalletMode } from "./circleWallet";

export type ArcNetwork = "mainnet" | "testnet";

const requestedNetwork = import.meta.env.VITE_ARC_NETWORK?.toLowerCase();
export const arcNetwork: ArcNetwork = requestedNetwork === "testnet" ? "testnet" : "mainnet";
export const isArcMainnet = arcNetwork === "mainnet";
export const arcNetworkName = isArcMainnet ? "Arc Mainnet" : "Arc Testnet";
export const arcExplorerUrl = isArcMainnet
  ? "https://explorer.arc.io"
  : "https://explorer.testnet.arc.io";
const expectedChainId = isArcMainnet ? 5_042 : 5_042_002;
const officialUsdc = "0x3600000000000000000000000000000000000000";
const defaultRpcUrl = isArcMainnet ? "https://rpc.drpc.mainnet.arc.io" : "https://rpc.drpc.testnet.arc.io";
const defaultFallbackRpcUrl = isArcMainnet
  ? "https://rpc.quicknode.mainnet.arc.io"
  : "https://rpc.quicknode.testnet.arc.io";
const rawChainId = import.meta.env.VITE_ARC_CHAIN_ID;
const parsedChainId = Number(rawChainId);

export const arcChainId =
  Number.isSafeInteger(parsedChainId) && parsedChainId > 0 ? parsedChainId : expectedChainId;
export const arcRpcUrl = import.meta.env.VITE_ARC_RPC_URL || defaultRpcUrl;
export const arcFallbackRpcUrl = import.meta.env.VITE_ARC_FALLBACK_RPC_URL || defaultFallbackRpcUrl;
const arcRpcUrls = [...new Set([arcRpcUrl, arcFallbackRpcUrl].filter(Boolean))];

function envAddress(value: string | undefined): `0x${string}` {
  return value && isAddress(value) ? value : zeroAddress;
}

export const handselAddress = envAddress(import.meta.env.VITE_HANDSEL_CONTRACT_ADDRESS);
export const usdcAddress = envAddress(import.meta.env.VITE_USDC_ADDRESS);
export const usdcDecimals = 6;

export const configIssues = [
  requestedNetwork && requestedNetwork !== "mainnet" && requestedNetwork !== "testnet"
    ? "Arc network must be mainnet or testnet."
    : null,
  rawChainId && arcChainId !== expectedChainId
    ? `Arc chain id must be ${expectedChainId} for ${arcNetwork}.`
    : null,
  handselAddress === zeroAddress ? "Handsel contract address is missing or invalid." : null,
  usdcAddress === zeroAddress ? "USDC address is missing or invalid." : null,
  usdcAddress !== zeroAddress && usdcAddress.toLowerCase() !== officialUsdc
    ? `USDC address must be the official Arc interface ${officialUsdc}.`
    : null,
].filter(Boolean) as string[];

export const contractsConfigured = configIssues.length === 0;

export const arcChain = defineChain({
  id: arcChainId,
  name: arcNetworkName,
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
  blockExplorers: {
    default: { name: "Arc Explorer", url: arcExplorerUrl },
  },
  contracts: {
    multicall3: {
      address: "0xcA11bde05977b3631167028862bE2a173976CA11",
    },
  },
  testnet: !isArcMainnet,
});

export const circleClientKey = import.meta.env.VITE_CIRCLE_CLIENT_KEY || "";
export const circleClientUrl = import.meta.env.VITE_CIRCLE_CLIENT_URL || "";
export const circleWalletConfigured = Boolean(circleClientKey && circleClientUrl);
export const circlePasskeyProvider = createCirclePasskeyProvider({
  chain: arcChain,
  network: arcNetwork,
  clientKey: circleClientKey,
  clientUrl: circleClientUrl,
});

export function selectCircleWalletMode(mode: CircleWalletMode) {
  circlePasskeyProvider.setMode(mode);
}

export const wagmiConfig = createConfig({
  chains: [arcChain],
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
    [arcChain.id]: fallback(arcRpcUrls.map((url) => http(url))),
  },
});
