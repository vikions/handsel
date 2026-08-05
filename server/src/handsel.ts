import {
  createPublicClient,
  decodeEventLog,
  defineChain,
  getAddress,
  http,
  parseAbi,
  type Address,
  type Hex,
} from "viem";
import { env } from "./config.js";

export const handselAbi = parseAbi([
  "event AgreementCreated(uint256 indexed agreementId,address indexed client,address indexed beneficiary,address arbiter,uint256 amount,uint256 deadline,string title,string criteriaURI,string metadataURI)",
  "event AgreementAccepted(uint256 indexed agreementId,address indexed beneficiary)",
  "event ProofSubmitted(uint256 indexed agreementId,address indexed beneficiary,string proofURI)",
  "event ProofApprovedAndReleased(uint256 indexed agreementId,address indexed client,address indexed beneficiary,uint256 amount)",
  "event AgreementReleased(uint256 indexed agreementId,address indexed client,address indexed beneficiary,uint256 amount)",
  "event AgreementDisputed(uint256 indexed agreementId,address indexed openedBy)",
  "event AgreementResolved(uint256 indexed agreementId,address indexed arbiter,uint256 clientAmount,uint256 beneficiaryAmount,uint16 clientBps,uint16 beneficiaryBps)",
  "event AgreementRefunded(uint256 indexed agreementId,address indexed requestedBy,uint256 amount)",
  "event AgreementCancelled(uint256 indexed agreementId,address indexed client,uint256 amount)",
  "function getAgreement(uint256 agreementId) view returns ((address client,address beneficiary,address arbiter,uint256 amount,uint256 deadline,string title,string criteriaURI,string metadataURI,string proofURI,uint8 status,uint256 createdAt,uint256 acceptedAt,uint256 submittedAt,uint256 completedAt))",
]);

const arcTestnet = defineChain({
  id: 5_042_002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: [env.arcRpcUrl] } },
});

const publicClient = createPublicClient({ chain: arcTestnet, transport: http(env.arcRpcUrl) });

export type DecodedHandselEvent = {
  agreementId: string;
  eventName: string;
  args: Record<string, unknown>;
};

export type AgreementSnapshot = {
  agreement_id: string;
  client: string;
  beneficiary: string;
  arbiter: string;
  amount: string;
  deadline: string;
  title: string;
  criteria_uri: string;
  metadata_uri: string;
  proof_uri: string;
  status: number;
  created_at_chain: string;
  accepted_at_chain: string;
  submitted_at_chain: string;
  completed_at_chain: string;
  updated_at: string;
};

export function decodeHandselEvent(topics: Hex[], data: Hex): DecodedHandselEvent {
  const decoded = decodeEventLog({ abi: handselAbi, topics: topics as [Hex, ...Hex[]], data });
  const args = decoded.args as unknown as Record<string, unknown>;
  const agreementId = args.agreementId;
  if (typeof agreementId !== "bigint") throw new Error("Circle event is missing agreementId.");

  return {
    agreementId: agreementId.toString(),
    eventName: decoded.eventName,
    args: jsonSafe(args) as Record<string, unknown>,
  };
}

export async function readAgreementSnapshot(agreementId: string): Promise<AgreementSnapshot> {
  const agreement = await publicClient.readContract({
    address: env.handselAddress,
    abi: handselAbi,
    functionName: "getAgreement",
    args: [BigInt(agreementId)],
  });

  return {
    agreement_id: agreementId,
    client: normalizeAddress(agreement.client),
    beneficiary: normalizeAddress(agreement.beneficiary),
    arbiter: normalizeAddress(agreement.arbiter),
    amount: agreement.amount.toString(),
    deadline: agreement.deadline.toString(),
    title: agreement.title,
    criteria_uri: agreement.criteriaURI,
    metadata_uri: agreement.metadataURI,
    proof_uri: agreement.proofURI,
    status: agreement.status,
    created_at_chain: agreement.createdAt.toString(),
    accepted_at_chain: agreement.acceptedAt.toString(),
    submitted_at_chain: agreement.submittedAt.toString(),
    completed_at_chain: agreement.completedAt.toString(),
    updated_at: new Date().toISOString(),
  };
}

function normalizeAddress(value: Address) {
  return getAddress(value).toLowerCase();
}

function jsonSafe(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, jsonSafe(item)]));
  }
  return value;
}
