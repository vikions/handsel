// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title ArcEscrow
/// @notice Programmable USDC escrow primitive for Arc testnet service agreements.
/// @dev No admin role can move escrowed funds. Settlement paths are controlled by participants.
contract ArcEscrow is ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Escrow lifecycle states.
    enum Status {
        Created,
        Active,
        Completed,
        Disputed,
        Resolved,
        Refunded,
        Cancelled
    }

    /// @notice Escrow agreement state.
    struct Escrow {
        address client;
        address beneficiary;
        address arbiter;
        uint256 amount;
        uint256 deadline;
        string metadataURI;
        Status status;
        uint256 createdAt;
        uint256 acceptedAt;
        uint256 completedAt;
    }

    /// @notice ERC20 USDC token used for escrow deposits and settlement.
    IERC20 public immutable usdc;

    /// @notice Sum of all escrow deposits created through the contract.
    uint256 public totalVolume;

    /// @notice Number of escrows completed by client release.
    uint256 public completedEscrows;

    /// @notice Number of escrows that have entered dispute.
    uint256 public disputedEscrows;

    Escrow[] private _escrows;
    mapping(address => uint256[]) private _userEscrowIds;

    error ZeroAddress();
    error ZeroAmount();
    error InvalidDeadline();
    error EscrowNotFound();
    error Unauthorized();
    error InvalidStatus(Status expected, Status actual);
    error InvalidRefundStatus(Status actual);
    error DeadlineNotReached();
    error InvalidSplit();

    event EscrowCreated(
        uint256 indexed escrowId,
        address indexed client,
        address indexed beneficiary,
        address arbiter,
        uint256 amount,
        uint256 deadline,
        string metadataURI
    );
    event EscrowAccepted(uint256 indexed escrowId, address indexed beneficiary);
    event EscrowReleased(uint256 indexed escrowId, address indexed client, address indexed beneficiary, uint256 amount);
    event EscrowDisputed(uint256 indexed escrowId, address indexed openedBy);
    event EscrowResolved(
        uint256 indexed escrowId,
        address indexed arbiter,
        uint256 clientAmount,
        uint256 beneficiaryAmount,
        uint16 clientBps,
        uint16 beneficiaryBps
    );
    event EscrowRefunded(uint256 indexed escrowId, address indexed requestedBy, uint256 amount);
    event EscrowCancelled(uint256 indexed escrowId, address indexed client, uint256 amount);

    /// @param usdc_ USDC ERC20 token address for deposits and settlement.
    constructor(IERC20 usdc_) {
        if (address(usdc_) == address(0)) revert ZeroAddress();
        usdc = usdc_;
    }

    /// @notice Create an escrow and lock USDC in the contract.
    /// @param beneficiary Address that can accept and receive released funds.
    /// @param arbiter Address that can resolve disputes with a split settlement.
    /// @param amount USDC amount in token base units.
    /// @param deadline Unix timestamp after which either party can request refund.
    /// @param metadataURI Offchain metadata URI or short agreement reference.
    /// @return escrowId Newly created escrow id.
    function createEscrow(
        address beneficiary,
        address arbiter,
        uint256 amount,
        uint256 deadline,
        string calldata metadataURI
    ) external nonReentrant returns (uint256 escrowId) {
        if (beneficiary == address(0) || arbiter == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (deadline <= block.timestamp) revert InvalidDeadline();

        escrowId = _escrows.length;
        _escrows.push(
            Escrow({
                client: msg.sender,
                beneficiary: beneficiary,
                arbiter: arbiter,
                amount: amount,
                deadline: deadline,
                metadataURI: metadataURI,
                status: Status.Created,
                createdAt: block.timestamp,
                acceptedAt: 0,
                completedAt: 0
            })
        );

        totalVolume += amount;
        _trackParticipants(escrowId, msg.sender, beneficiary, arbiter);

        usdc.safeTransferFrom(msg.sender, address(this), amount);

        emit EscrowCreated(escrowId, msg.sender, beneficiary, arbiter, amount, deadline, metadataURI);
    }

    /// @notice Accept a created escrow as the beneficiary.
    /// @param escrowId Escrow id.
    function acceptEscrow(uint256 escrowId) external {
        Escrow storage escrow = _escrowAt(escrowId);
        if (msg.sender != escrow.beneficiary) revert Unauthorized();
        if (escrow.status != Status.Created) revert InvalidStatus(Status.Created, escrow.status);

        escrow.status = Status.Active;
        escrow.acceptedAt = block.timestamp;

        emit EscrowAccepted(escrowId, msg.sender);
    }

    /// @notice Release the full escrowed amount to the beneficiary.
    /// @param escrowId Escrow id.
    function releaseEscrow(uint256 escrowId) external nonReentrant {
        Escrow storage escrow = _escrowAt(escrowId);
        if (msg.sender != escrow.client) revert Unauthorized();
        if (escrow.status != Status.Active) revert InvalidStatus(Status.Active, escrow.status);

        escrow.status = Status.Completed;
        escrow.completedAt = block.timestamp;
        completedEscrows += 1;

        usdc.safeTransfer(escrow.beneficiary, escrow.amount);

        emit EscrowReleased(escrowId, msg.sender, escrow.beneficiary, escrow.amount);
    }

    /// @notice Open a dispute for an active escrow.
    /// @param escrowId Escrow id.
    function openDispute(uint256 escrowId) external {
        Escrow storage escrow = _escrowAt(escrowId);
        if (msg.sender != escrow.client && msg.sender != escrow.beneficiary) revert Unauthorized();
        if (escrow.status != Status.Active) revert InvalidStatus(Status.Active, escrow.status);

        escrow.status = Status.Disputed;
        disputedEscrows += 1;

        emit EscrowDisputed(escrowId, msg.sender);
    }

    /// @notice Resolve a disputed escrow by splitting funds between client and beneficiary.
    /// @param escrowId Escrow id.
    /// @param clientBps Client share in basis points.
    /// @param beneficiaryBps Beneficiary share in basis points.
    function resolveDispute(uint256 escrowId, uint16 clientBps, uint16 beneficiaryBps) external nonReentrant {
        Escrow storage escrow = _escrowAt(escrowId);
        if (msg.sender != escrow.arbiter) revert Unauthorized();
        if (escrow.status != Status.Disputed) revert InvalidStatus(Status.Disputed, escrow.status);
        if (uint256(clientBps) + uint256(beneficiaryBps) != 10_000) revert InvalidSplit();

        uint256 clientAmount = (escrow.amount * clientBps) / 10_000;
        uint256 beneficiaryAmount = escrow.amount - clientAmount;

        escrow.status = Status.Resolved;
        escrow.completedAt = block.timestamp;

        if (clientAmount > 0) {
            usdc.safeTransfer(escrow.client, clientAmount);
        }
        if (beneficiaryAmount > 0) {
            usdc.safeTransfer(escrow.beneficiary, beneficiaryAmount);
        }

        emit EscrowResolved(escrowId, msg.sender, clientAmount, beneficiaryAmount, clientBps, beneficiaryBps);
    }

    /// @notice Refund an expired created or active escrow back to the client.
    /// @param escrowId Escrow id.
    function refundExpired(uint256 escrowId) external nonReentrant {
        Escrow storage escrow = _escrowAt(escrowId);
        if (msg.sender != escrow.client && msg.sender != escrow.beneficiary) revert Unauthorized();
        if (escrow.status != Status.Created && escrow.status != Status.Active) {
            revert InvalidRefundStatus(escrow.status);
        }
        if (block.timestamp <= escrow.deadline) revert DeadlineNotReached();

        escrow.status = Status.Refunded;
        escrow.completedAt = block.timestamp;

        usdc.safeTransfer(escrow.client, escrow.amount);

        emit EscrowRefunded(escrowId, msg.sender, escrow.amount);
    }

    /// @notice Cancel an escrow that has not been accepted by the beneficiary.
    /// @param escrowId Escrow id.
    function cancelUnaccepted(uint256 escrowId) external nonReentrant {
        Escrow storage escrow = _escrowAt(escrowId);
        if (msg.sender != escrow.client) revert Unauthorized();
        if (escrow.status != Status.Created) revert InvalidStatus(Status.Created, escrow.status);

        escrow.status = Status.Cancelled;
        escrow.completedAt = block.timestamp;

        usdc.safeTransfer(escrow.client, escrow.amount);

        emit EscrowCancelled(escrowId, msg.sender, escrow.amount);
    }

    /// @notice Return a full escrow record.
    /// @param escrowId Escrow id.
    function getEscrow(uint256 escrowId) external view returns (Escrow memory) {
        return _escrowAt(escrowId);
    }

    /// @notice Return the number of escrows created.
    function getEscrowCount() external view returns (uint256) {
        return _escrows.length;
    }

    /// @notice Return the number of escrows associated with a user in any role.
    /// @param user User address.
    function getUserEscrowCount(address user) external view returns (uint256) {
        return _userEscrowIds[user].length;
    }

    /// @notice Return a paginated set of escrow ids for a user.
    /// @param user User address.
    /// @param offset Starting index in the user's escrow id list.
    /// @param limit Maximum ids to return.
    function getUserEscrowIds(address user, uint256 offset, uint256 limit) external view returns (uint256[] memory ids) {
        uint256 total = _userEscrowIds[user].length;
        if (offset >= total || limit == 0) {
            return new uint256[](0);
        }

        uint256 end = offset + limit;
        if (end > total) {
            end = total;
        }

        ids = new uint256[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            ids[i - offset] = _userEscrowIds[user][i];
        }
    }

    function _escrowAt(uint256 escrowId) private view returns (Escrow storage escrow) {
        if (escrowId >= _escrows.length) revert EscrowNotFound();
        escrow = _escrows[escrowId];
    }

    function _trackParticipants(uint256 escrowId, address client, address beneficiary, address arbiter) private {
        _userEscrowIds[client].push(escrowId);
        if (beneficiary != client) {
            _userEscrowIds[beneficiary].push(escrowId);
        }
        if (arbiter != client && arbiter != beneficiary) {
            _userEscrowIds[arbiter].push(escrowId);
        }
    }
}
