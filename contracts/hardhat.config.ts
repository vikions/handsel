import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({ path: path.resolve(__dirname, ".env"), override: true });

const arcChainId = process.env.ARC_TESTNET_CHAIN_ID
  ? Number(process.env.ARC_TESTNET_CHAIN_ID)
  : undefined;

const arcTestnet: Record<string, unknown> = {
  url: process.env.ARC_TESTNET_RPC_URL || "http://127.0.0.1:8545",
  accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
};

if (arcChainId) {
  arcTestnet.chainId = arcChainId;
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
    arcTestnet,
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};

export default config;
