import { ethers } from "hardhat";
import { ARC_USDC, CONTRACT_NAME, checkDeploymentArtifact, checkMainnetNetwork, checkOfficialUsdc } from "./mainnet-checks";

async function main() {
  console.log("READ-ONLY HANDSEL ARC MAINNET PREFLIGHT. No transaction will be sent.");
  await checkMainnetNetwork();
  console.log("PASS RPC reachable; chain ID 5042.");
  await checkOfficialUsdc();
  console.log(`PASS official USDC ${ARC_USDC}, bytecode present, six decimals.`);
  const compiler = await checkDeploymentArtifact();
  console.log(`PASS fresh Hardhat artifact, Solidity ${compiler}, optimizer 200, one address constructor.`);
  console.log(`PASS constructor argument: ${ARC_USDC}.`);

  let pending = false;
  const signers = await ethers.getSigners();
  if (signers.length === 0) {
    console.log("PENDING deployment signer: no local PRIVATE_KEY configured. Public checks passed.");
    pending = true;
  } else {
    const signer = signers[0];
    const balance = await ethers.provider.getBalance(signer.address);
    console.log(`DEPLOYER ${signer.address}`);
    console.log(`NATIVE USDC GAS BALANCE ${ethers.formatEther(balance)} USDC (18-decimal native units).`);
    const expected = process.env.EXPECTED_MAINNET_DEPLOYER;
    if (!expected) {
      console.log("PENDING EXPECTED_MAINNET_DEPLOYER guard is not configured.");
      pending = true;
    }
    else if (expected.toLowerCase() !== signer.address.toLowerCase()) throw new Error("Unexpected deployment signer.");
    else console.log("PASS expected deployer guard.");
    const factory = await ethers.getContractFactory(CONTRACT_NAME);
    const deployment = await factory.getDeployTransaction(ARC_USDC);
    const fee = await ethers.provider.getFeeData();
    try {
      const gas = await ethers.provider.estimateGas({ from: signer.address, data: deployment.data });
      const upperBound = gas * (fee.maxFeePerGas || fee.gasPrice || 0n);
      console.log(`Estimated deployment gas ceiling: ${ethers.formatEther(upperBound)} native USDC.`);
      if (balance <= upperBound) {
        console.log("PENDING deployer lacks native USDC for estimated deployment gas.");
        pending = true;
      }
    } catch (error) {
      console.log(`PENDING deployment gas estimate unavailable: ${error instanceof Error ? error.message : error}`);
      pending = true;
    }
  }
  console.log(
    process.env.CONFIRM_ARC_MAINNET_DEPLOYMENT === "HANDSEL_ARC_MAINNET_5042"
      ? "NOTICE mainnet deployment confirmation phrase is set. Remove it after deployment."
      : "PASS deployment lock remains closed; confirmation phrase not set.",
  );
  if (pending) throw new Error("Preflight public checks passed, but deployment signer/gas guard is not ready.");
  console.log("Preflight passed. Deployment still requires explicit confirmation and separate approval.");
}

main().catch((error) => {
  console.error(`FAIL ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
});
