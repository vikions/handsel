import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({ path: path.resolve(__dirname, ".env"), override: true });

const accounts = process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [];
const arcMainnet: Record<string, unknown> = {
  url: process.env.ARC_MAINNET_RPC_URL || process.env.ARC_RPC_URL || "https://rpc.drpc.mainnet.arc.io",
  chainId: 5042,
  accounts,
};
const arcTestnet: Record<string, unknown> = {
  url: process.env.ARC_TESTNET_RPC_URL || "https://rpc.drpc.testnet.arc.io",
  chainId: 5042002,
  accounts,
};

if (process.env.ARC_MAINNET_CHAIN_ID && Number(process.env.ARC_MAINNET_CHAIN_ID) !== 5042) {
  throw new Error("ARC_MAINNET_CHAIN_ID must be 5042.");
}
if (process.env.ARC_TESTNET_CHAIN_ID && Number(process.env.ARC_TESTNET_CHAIN_ID) !== 5042002) {
  throw new Error("ARC_TESTNET_CHAIN_ID must be 5042002.");
}

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    arcMainnet,
    arcTestnet,
  },
  etherscan: {
    apiKey: {
      arcMainnet: "blockscout",
      arcTestnet: "blockscout",
    },
    customChains: [
      {
        network: "arcMainnet",
        chainId: 5042,
        urls: {
          apiURL: "https://explorer.arc.io/api",
          browserURL: "https://explorer.arc.io",
        },
      },
      {
        network: "arcTestnet",
        chainId: 5042002,
        urls: {
          apiURL: "https://explorer.testnet.arc.io/api",
          browserURL: "https://explorer.testnet.arc.io",
        },
      },
    ],
  },
  sourcify: {
    enabled: false,
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};

export default config;
