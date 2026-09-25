import { artifacts, ethers, network } from "hardhat";

export const MAINNET_CHAIN_ID = 5_042n;
export const ARC_USDC = "0x3600000000000000000000000000000000000000";
export const CONTRACT_NAME = "HandselAgreement";
export const CONTRACT_FQN = "contracts/HandselAgreement.sol:HandselAgreement";

export async function checkMainnetNetwork() {
  if (network.name !== "arcMainnet") throw new Error("Use --network arcMainnet; no other network is allowed.");
  const connected = await ethers.provider.getNetwork();
  if (connected.chainId !== MAINNET_CHAIN_ID) throw new Error(`RPC chain ID ${connected.chainId} is not Arc Mainnet 5042.`);
  return connected;
}

export async function checkOfficialUsdc() {
  const configured = process.env.USDC_ADDRESS;
  if (configured && configured.toLowerCase() !== ARC_USDC.toLowerCase()) throw new Error(`USDC_ADDRESS must be ${ARC_USDC}.`);
  const code = await ethers.provider.getCode(ARC_USDC);
  if (code === "0x") throw new Error("No bytecode at the official Arc USDC interface address.");
  const token = new ethers.Contract(ARC_USDC, ["function decimals() view returns (uint8)"], ethers.provider);
  const decimals = await token.decimals();
  if (decimals !== 6n) throw new Error(`Expected six USDC decimals, got ${decimals}.`);
}

export async function checkDeploymentArtifact() {
  const artifact = await artifacts.readArtifact(CONTRACT_FQN);
  const buildInfo = await artifacts.getBuildInfo(CONTRACT_FQN);
  if (!buildInfo || artifact.bytecode === "0x") throw new Error("Compiled HandselAgreement artifact/build info is missing.");
  if (!buildInfo.solcLongVersion.startsWith("0.8.24+")) throw new Error(`Unexpected compiler ${buildInfo.solcLongVersion}; expected Solidity 0.8.24.`);
  const settings = buildInfo.input.settings;
  if (settings.optimizer?.enabled !== true || settings.optimizer.runs !== 200) throw new Error("Expected optimizer enabled with 200 runs.");
  const constructor = artifact.abi.find((item) => item.type === "constructor");
  if (!constructor || constructor.inputs.length !== 1 || constructor.inputs[0].type !== "address") {
    throw new Error("Unexpected constructor: expected one USDC address.");
  }
  const factory = await ethers.getContractFactory(CONTRACT_NAME);
  if (factory.bytecode !== artifact.bytecode) throw new Error("Contract factory bytecode differs from compiled artifact.");
  return buildInfo.solcLongVersion;
}
