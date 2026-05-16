import { ethers } from "hardhat";

async function main() {
  const usdcAddress = process.env.USDC_ADDRESS;
  if (!usdcAddress) {
    throw new Error("USDC_ADDRESS is required. Use the official Arc testnet USDC token address.");
  }

  const [deployer] = await ethers.getSigners();
  const ArcEscrow = await ethers.getContractFactory("ArcEscrow");
  const arcEscrow = await ArcEscrow.deploy(usdcAddress);

  await arcEscrow.waitForDeployment();

  const escrowAddress = await arcEscrow.getAddress();
  console.log(`Deployer: ${deployer.address}`);
  console.log(`USDC: ${usdcAddress}`);
  console.log(`ArcEscrow: ${escrowAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
