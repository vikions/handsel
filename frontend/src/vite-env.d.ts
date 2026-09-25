/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ARC_NETWORK?: "mainnet" | "testnet";
  readonly VITE_ARC_RPC_URL?: string;
  readonly VITE_ARC_FALLBACK_RPC_URL?: string;
  readonly VITE_ARC_CHAIN_ID?: string;
  readonly VITE_USDC_ADDRESS?: string;
  readonly VITE_HANDSEL_CONTRACT_ADDRESS?: string;
  readonly VITE_HANDSEL_API_URL?: string;
  readonly VITE_CIRCLE_CLIENT_KEY?: string;
  readonly VITE_CIRCLE_CLIENT_URL?: string;
}
