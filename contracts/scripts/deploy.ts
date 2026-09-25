import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ethers, network } from "hardhat";
import { ARC_USDC, CONTRACT_NAME, checkDeploymentArtifact, checkMainnetNetwork, checkOfficialUsdc } from "./mainnet-checks";

async function main() {
  if (network.name !== "arcMainnet" && network.name !== "arcTestnet") {
    throw new Error("Deployment is supported only on explicitly selected Arc networks.");
  }
  const isMainnet = network.name === "arcMainnet";
  const connected = isMainnet ? await checkMainnetNetwork() : await ethers.provider.getNetwork();
  if (!isMainnet && connected.chainId !== 5_042_002n) throw new Error("Expected Arc Testnet chain ID 5042002.");
  await checkOfficialUsdc();
  const compiler = await checkDeploymentArtifact();
  const [deployer] = await ethers.getSigners();
  if (!deployer) throw new Error("No deployment signer is configured.");

  const factory = await ethers.getContractFactory(CONTRACT_NAME);
  const deployment = await factory.getDeployTransaction(ARC_USDC);
  const gasEstimate = await ethers.provider.estimateGas({ from: deployer.address, data: deployment.data });
  const gasBalance = await ethers.provider.getBalance(deployer.address);
  const feeData = await ethers.provider.getFeeData();
  const estimatedGasCost = gasEstimate * (feeData.maxFeePerGas || feeData.gasPrice || 0n);

  console.log("NETWORK:", network.name);
  console.log("CHAIN ID:", connected.chainId.toString());
  console.log("DEPLOYER:", deployer.address);
  console.log("USDC:", ARC_USDC);
  console.log("CONTRACT:", CONTRACT_NAME);
  console.log("CONSTRUCTOR ARGUMENTS:", [ARC_USDC]);
  console.log("COMPILER:", compiler, "optimizer enabled / 200 runs");
  console.log("ESTIMATED GAS:", gasEstimate.toString());
  console.log("NATIVE USDC BALANCE:", ethers.formatEther(gasBalance));
  console.log("EXPECTED ACTION: broadcast one immutable HandselAgreement deployment transaction.");

  if (isMainnet) {
    const expected = process.env.EXPECTED_MAINNET_DEPLOYER;
    if (!expected || expected.toLowerCase() !== deployer.address.toLowerCase()) {
      throw new Error("Set EXPECTED_MAINNET_DEPLOYER to the reviewed signer address before mainnet deployment.");
    }
    if (existsSync(path.resolve(__dirname, "../../deployments/arc-mainnet.json"))) {
      throw new Error("A mainnet deployment is already recorded in deployments/arc-mainnet.json. Aborting duplicate deployment.");
    }
    if (process.env.HANDSEL_MAINNET_DEPLOYMENT_ADDRESS) {
      throw new Error("HANDSEL_MAINNET_DEPLOYMENT_ADDRESS is already set. Aborting duplicate deployment.");
    }
    if (gasBalance <= estimatedGasCost) throw new Error("Insufficient native USDC for estimated deployment gas.");
    if (process.env.CONFIRM_ARC_MAINNET_DEPLOYMENT !== "HANDSEL_ARC_MAINNET_5042") {
      throw new Error("Mainnet deployment locked. Explicitly set CONFIRM_ARC_MAINNET_DEPLOYMENT=HANDSEL_ARC_MAINNET_5042.");
    }
  }

  const contract = await factory.deploy(ARC_USDC);
  const transaction = contract.deploymentTransaction();
  await contract.waitForDeployment();
  const receipt = await transaction?.wait();
  console.log("HANDSEL AGREEMENT:", await contract.getAddress());
  console.log("DEPLOYMENT TX:", transaction?.hash);
  console.log("DEPLOYMENT BLOCK:", receipt?.blockNumber);
  if (isMainnet && receipt?.status === 1 && transaction?.hash) {
    const file = path.resolve(__dirname, "../../deployments/arc-mainnet.json");
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, `${JSON.stringify({
      network: "arc-mainnet",
      chainId: 5042,
      contract: CONTRACT_NAME,
      address: await contract.getAddress(),
      deploymentBlock: receipt.blockNumber,
      deploymentTx: transaction.hash,
      usdc: ARC_USDC,
      explorer: `https://explorer.arc.io/address/${await contract.getAddress()}`,
    }, null, 2)}\n`, { flag: "wx" });
    console.log(`RECORDED: ${file}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
