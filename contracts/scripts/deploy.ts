import { ethers } from "hardhat";

async function main() {
  const rpcUrl = process.env.ARC_TESTNET_RPC_URL;
  const chainId = process.env.ARC_TESTNET_CHAIN_ID;
  const usdcAddress = process.env.USDC_ADDRESS;
  if (!rpcUrl) {
    throw new Error("ARC_TESTNET_RPC_URL is required for Arc testnet deployment.");
  }
  if (!chainId) {
    throw new Error("ARC_TESTNET_CHAIN_ID is required for Arc testnet deployment.");
  }
  if (!usdcAddress) {
    throw new Error("USDC_ADDRESS is required. Use the official Arc testnet USDC token address.");
  }

  const [deployer] = await ethers.getSigners();
  const HandselAgreement = await ethers.getContractFactory("HandselAgreement");
  const handselAgreement = await HandselAgreement.deploy(usdcAddress);

  await handselAgreement.waitForDeployment();

  const agreementAddress = await handselAgreement.getAddress();
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Arc chain id: ${chainId}`);
  console.log(`USDC: ${usdcAddress}`);
  console.log(`HandselAgreement: ${agreementAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
