import { parseAbi } from "viem";

export const arcEscrowAbi = parseAbi([
  "function createEscrow(address beneficiary,address arbiter,uint256 amount,uint256 deadline,string metadataURI) returns (uint256)",
  "function acceptEscrow(uint256 escrowId)",
  "function releaseEscrow(uint256 escrowId)",
  "function openDispute(uint256 escrowId)",
  "function resolveDispute(uint256 escrowId,uint16 clientBps,uint16 beneficiaryBps)",
  "function refundExpired(uint256 escrowId)",
  "function cancelUnaccepted(uint256 escrowId)",
  "function getEscrow(uint256 escrowId) view returns ((address client,address beneficiary,address arbiter,uint256 amount,uint256 deadline,string metadataURI,uint8 status,uint256 createdAt,uint256 acceptedAt,uint256 completedAt))",
  "function getEscrowCount() view returns (uint256)",
  "function getUserEscrowCount(address user) view returns (uint256)",
  "function getUserEscrowIds(address user,uint256 offset,uint256 limit) view returns (uint256[])",
  "function totalVolume() view returns (uint256)",
  "function completedEscrows() view returns (uint256)",
  "function disputedEscrows() view returns (uint256)",
  "event EscrowCreated(uint256 indexed escrowId,address indexed client,address indexed beneficiary,address arbiter,uint256 amount,uint256 deadline,string metadataURI)",
  "event EscrowAccepted(uint256 indexed escrowId,address indexed beneficiary)",
  "event EscrowReleased(uint256 indexed escrowId,address indexed client,address indexed beneficiary,uint256 amount)",
  "event EscrowDisputed(uint256 indexed escrowId,address indexed openedBy)",
  "event EscrowResolved(uint256 indexed escrowId,address indexed arbiter,uint256 clientAmount,uint256 beneficiaryAmount,uint16 clientBps,uint16 beneficiaryBps)",
  "event EscrowRefunded(uint256 indexed escrowId,address indexed requestedBy,uint256 amount)",
  "event EscrowCancelled(uint256 indexed escrowId,address indexed client,uint256 amount)",
]);

export const erc20Abi = parseAbi([
  "function allowance(address owner,address spender) view returns (uint256)",
  "function approve(address spender,uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
]);
