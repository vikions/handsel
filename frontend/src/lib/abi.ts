import { parseAbi } from "viem";

export const handselAbi = parseAbi([
  "function createAgreement(address beneficiary,address arbiter,uint256 amount,uint256 deadline,string title,string criteriaURI,string metadataURI) returns (uint256)",
  "function acceptAgreement(uint256 agreementId)",
  "function submitProof(uint256 agreementId,string proofURI)",
  "function approveProof(uint256 agreementId)",
  "function releaseAgreement(uint256 agreementId)",
  "function openDispute(uint256 agreementId)",
  "function resolveDispute(uint256 agreementId,uint16 clientBps,uint16 beneficiaryBps)",
  "function refundExpired(uint256 agreementId)",
  "function cancelUnaccepted(uint256 agreementId)",
  "function getAgreement(uint256 agreementId) view returns ((address client,address beneficiary,address arbiter,uint256 amount,uint256 deadline,string title,string criteriaURI,string metadataURI,string proofURI,uint8 status,uint256 createdAt,uint256 acceptedAt,uint256 submittedAt,uint256 completedAt))",
  "function getAgreementCount() view returns (uint256)",
  "function getUserAgreementCount(address user) view returns (uint256)",
  "function getUserAgreementIds(address user,uint256 offset,uint256 limit) view returns (uint256[])",
  "function totalVolume() view returns (uint256)",
  "function completedAgreements() view returns (uint256)",
  "function disputedAgreements() view returns (uint256)",
  "event AgreementCreated(uint256 indexed agreementId,address indexed client,address indexed beneficiary,address arbiter,uint256 amount,uint256 deadline,string title,string criteriaURI,string metadataURI)",
  "event AgreementAccepted(uint256 indexed agreementId,address indexed beneficiary)",
  "event ProofSubmitted(uint256 indexed agreementId,address indexed beneficiary,string proofURI)",
  "event ProofApprovedAndReleased(uint256 indexed agreementId,address indexed client,address indexed beneficiary,uint256 amount)",
  "event AgreementReleased(uint256 indexed agreementId,address indexed client,address indexed beneficiary,uint256 amount)",
  "event AgreementDisputed(uint256 indexed agreementId,address indexed openedBy)",
  "event AgreementResolved(uint256 indexed agreementId,address indexed arbiter,uint256 clientAmount,uint256 beneficiaryAmount,uint16 clientBps,uint16 beneficiaryBps)",
  "event AgreementRefunded(uint256 indexed agreementId,address indexed requestedBy,uint256 amount)",
  "event AgreementCancelled(uint256 indexed agreementId,address indexed client,uint256 amount)",
]);

export const erc20Abi = parseAbi([
  "function allowance(address owner,address spender) view returns (uint256)",
  "function approve(address spender,uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
]);
