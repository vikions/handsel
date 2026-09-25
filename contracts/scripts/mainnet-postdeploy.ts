import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ethers } from "hardhat";
import { ARC_USDC, checkMainnetNetwork } from "./mainnet-checks";

function argument(name: string) {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
}

async function main() {
  await checkMainnetNetwork();
  const addressInput = process.env.HANDSEL_POSTDEPLOY_ADDRESS || argument("--address");
  const blockInput = process.env.HANDSEL_POSTDEPLOY_BLOCK || argument("--block");
  const txHash = process.env.HANDSEL_POSTDEPLOY_TX || argument("--tx");
  const record = process.env.HANDSEL_POSTDEPLOY_RECORD === "true" || process.argv.includes("--record");
  if (!addressInput || !ethers.isAddress(addressInput)) throw new Error("Set HANDSEL_POSTDEPLOY_ADDRESS to the mainnet contract address.");
  if (!blockInput || !/^\d+$/.test(blockInput)) throw new Error("Set HANDSEL_POSTDEPLOY_BLOCK to the deployment block number.");
  const address = ethers.getAddress(addressInput);
  const block = BigInt(blockInput);
  const head = await ethers.provider.getBlockNumber();
  if (block > BigInt(head)) throw new Error("Deployment block is ahead of the current chain head.");
  if (await ethers.provider.getCode(address) === "0x") throw new Error("No contract code at this address on Arc Mainnet.");
  const contract = await ethers.getContractAt("HandselAgreement", address);
  const actualUsdc = await contract.usdc();
  if (actualUsdc.toLowerCase() !== ARC_USDC.toLowerCase()) throw new Error(`Contract points to unexpected USDC ${actualUsdc}.`);
  const count = await contract.getAgreementCount();
  const volume = await contract.totalVolume();
  if (txHash) {
    if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) throw new Error("Invalid HANDSEL_POSTDEPLOY_TX hash.");
    const receipt = await ethers.provider.getTransactionReceipt(txHash);
    if (!receipt || receipt.status !== 1 || receipt.contractAddress?.toLowerCase() !== address.toLowerCase()) {
      throw new Error("Deployment transaction does not successfully create this contract.");
    }
    if (receipt.blockNumber !== Number(block)) throw new Error("Deployment block does not match transaction receipt.");
  }

  const metadata = {
    network: "arc-mainnet",
    chainId: 5042,
    contract: "HandselAgreement",
    address,
    deploymentBlock: Number(block),
    deploymentTx: txHash || null,
    usdc: ARC_USDC,
    explorer: `https://explorer.arc.io/address/${address}`,
  };
  console.log("PASS Arc Mainnet chain 5042, contract code, official USDC, read methods.");
  console.log(`Onchain agreements: ${count}; total volume (six-decimal units): ${volume}`);
  console.log(`Explorer: ${metadata.explorer}`);
  console.log("Vercel: VITE_ARC_NETWORK=mainnet VITE_ARC_CHAIN_ID=5042");
  console.log(`Vercel: VITE_HANDSEL_CONTRACT_ADDRESS=${address}`);
  console.log("Railway: ARC_NETWORK=mainnet ARC_CHAIN_ID=5042");
  console.log(`Railway: HANDSEL_CONTRACT_ADDRESS=${address}`);
  console.log(`Railway: HANDSEL_DEPLOYMENT_BLOCK=${block}`);
  console.log(`Verify: pnpm --filter @handsel/contracts verify:arc:mainnet -- ${address} ${ARC_USDC}`);
  for (const [name, expected] of [
    ["HANDSEL_CONTRACT_ADDRESS", address],
    ["VITE_HANDSEL_CONTRACT_ADDRESS", address],
  ]) {
    const current = process.env[name];
    if (current && current.toLowerCase() !== expected.toLowerCase()) console.log(`WARNING local ${name} differs from deployed mainnet address.`);
  }
  if (!record) return console.log("No file written. Set HANDSEL_POSTDEPLOY_RECORD=true after reviewing address, block and tx.");
  if (!txHash) throw new Error("HANDSEL_POSTDEPLOY_RECORD=true requires HANDSEL_POSTDEPLOY_TX.");
  const file = path.resolve(__dirname, "../../deployments/arc-mainnet.json");
  if (existsSync(file)) throw new Error("Deployment metadata already exists; refusing to overwrite it.");
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(metadata, null, 2)}\n`, { flag: "wx" });
  console.log(`Recorded ${file}. Review and commit this public metadata separately.`);
}

main().catch((error) => {
  console.error(`FAIL ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
});
