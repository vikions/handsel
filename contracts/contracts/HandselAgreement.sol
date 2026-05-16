// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title HandselAgreement
/// @notice Proof-based USDC agreement layer for service agreements on Arc testnet.
/// @dev Funds can only move through participant-controlled agreement flows. There is no admin custody path.
contract HandselAgreement is ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Agreement lifecycle states.
    enum Status {
        Created,
        Active,
        Submitted,
        Completed,
        Disputed,
        Resolved,
        Refunded,
        Cancelled
    }

    /// @notice Handsel service agreement state.
    struct Agreement {
        address client;
        address beneficiary;
        address arbiter;
        uint256 amount;
        uint256 deadline;
        string title;
        string criteriaURI;
        string metadataURI;
        string proofURI;
        Status status;
        uint256 createdAt;
        uint256 acceptedAt;
        uint256 submittedAt;
        uint256 completedAt;
    }

    /// @notice ERC20 USDC token used for agreement deposits and settlement.
    IERC20 public immutable usdc;

    /// @notice Sum of all USDC deposits created through the contract.
    uint256 public totalVolume;

    /// @notice Number of agreements completed by client release or proof approval.
    uint256 public completedAgreements;

    /// @notice Number of agreements that have entered dispute.
    uint256 public disputedAgreements;

    Agreement[] private _agreements;
    mapping(address => uint256[]) private _userAgreementIds;

    error ZeroAddress();
    error ZeroAmount();
    error InvalidDeadline();
    error AgreementNotFound();
    error Unauthorized();
    error InvalidStatus(Status expected, Status actual);
    error InvalidDisputeStatus(Status actual);
    error InvalidRefundStatus(Status actual);
    error DeadlineNotReached();
    error InvalidSplit();

    event AgreementCreated(
        uint256 indexed agreementId,
        address indexed client,
        address indexed beneficiary,
        address arbiter,
        uint256 amount,
        uint256 deadline,
        string title,
        string criteriaURI,
        string metadataURI
    );
    event AgreementAccepted(uint256 indexed agreementId, address indexed beneficiary);
    event ProofSubmitted(uint256 indexed agreementId, address indexed beneficiary, string proofURI);
    event ProofApprovedAndReleased(
        uint256 indexed agreementId,
        address indexed client,
        address indexed beneficiary,
        uint256 amount
    );
    event AgreementReleased(uint256 indexed agreementId, address indexed client, address indexed beneficiary, uint256 amount);
    event AgreementDisputed(uint256 indexed agreementId, address indexed openedBy);
    event AgreementResolved(
        uint256 indexed agreementId,
        address indexed arbiter,
        uint256 clientAmount,
        uint256 beneficiaryAmount,
        uint16 clientBps,
        uint16 beneficiaryBps
    );
    event AgreementRefunded(uint256 indexed agreementId, address indexed requestedBy, uint256 amount);
    event AgreementCancelled(uint256 indexed agreementId, address indexed client, uint256 amount);

    /// @param usdc_ USDC ERC20 token address for deposits and settlement.
    constructor(IERC20 usdc_) {
        if (address(usdc_) == address(0)) revert ZeroAddress();
        usdc = usdc_;
    }

    /// @notice Create a proof-based service agreement and lock USDC in the contract.
    /// @param beneficiary Address that can accept, submit proof, and receive released funds.
    /// @param arbiter Address that can resolve a dispute with a split settlement.
    /// @param amount USDC amount in token base units.
    /// @param deadline Unix timestamp after which an uncompleted created or active agreement can be refunded.
    /// @param title Human-readable agreement title.
    /// @param criteriaURI Acceptance criteria, criteria hash, or offchain URI.
    /// @param metadataURI Extra offchain metadata URI or description.
    /// @return agreementId Newly created agreement id.
    function createAgreement(
        address beneficiary,
        address arbiter,
        uint256 amount,
        uint256 deadline,
        string calldata title,
        string calldata criteriaURI,
        string calldata metadataURI
    ) external nonReentrant returns (uint256 agreementId) {
        if (beneficiary == address(0) || arbiter == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (deadline <= block.timestamp) revert InvalidDeadline();

        agreementId = _agreements.length;
        _agreements.push(
            Agreement({
                client: msg.sender,
                beneficiary: beneficiary,
                arbiter: arbiter,
                amount: amount,
                deadline: deadline,
                title: title,
                criteriaURI: criteriaURI,
                metadataURI: metadataURI,
                proofURI: "",
                status: Status.Created,
                createdAt: block.timestamp,
                acceptedAt: 0,
                submittedAt: 0,
                completedAt: 0
            })
        );

        totalVolume += amount;
        _trackParticipants(agreementId, msg.sender, beneficiary, arbiter);

        usdc.safeTransferFrom(msg.sender, address(this), amount);

        emit AgreementCreated(
            agreementId,
            msg.sender,
            beneficiary,
            arbiter,
            amount,
            deadline,
            title,
            criteriaURI,
            metadataURI
        );
    }

    /// @notice Accept a created agreement as the beneficiary.
    /// @param agreementId Agreement id.
    function acceptAgreement(uint256 agreementId) external {
        Agreement storage agreement = _agreementAt(agreementId);
        if (msg.sender != agreement.beneficiary) revert Unauthorized();
        if (agreement.status != Status.Created) revert InvalidStatus(Status.Created, agreement.status);

        agreement.status = Status.Active;
        agreement.acceptedAt = block.timestamp;

        emit AgreementAccepted(agreementId, msg.sender);
    }

    /// @notice Submit proof of work as the beneficiary.
    /// @param agreementId Agreement id.
    /// @param proofURI Proof text, proof hash, or URI pointing to proof materials.
    function submitProof(uint256 agreementId, string calldata proofURI) external {
        Agreement storage agreement = _agreementAt(agreementId);
        if (msg.sender != agreement.beneficiary) revert Unauthorized();
        if (agreement.status != Status.Active) revert InvalidStatus(Status.Active, agreement.status);

        agreement.status = Status.Submitted;
        agreement.proofURI = proofURI;
        agreement.submittedAt = block.timestamp;

        emit ProofSubmitted(agreementId, msg.sender, proofURI);
    }

    /// @notice Approve submitted proof and release the full amount to the beneficiary.
    /// @param agreementId Agreement id.
    function approveProof(uint256 agreementId) external nonReentrant {
        Agreement storage agreement = _agreementAt(agreementId);
        if (msg.sender != agreement.client) revert Unauthorized();
        if (agreement.status != Status.Submitted) revert InvalidStatus(Status.Submitted, agreement.status);

        _completeAndPay(agreement);

        emit ProofApprovedAndReleased(agreementId, msg.sender, agreement.beneficiary, agreement.amount);
    }

    /// @notice Manual client release path for active agreements when proof review is handled offchain.
    /// @param agreementId Agreement id.
    function releaseAgreement(uint256 agreementId) external nonReentrant {
        Agreement storage agreement = _agreementAt(agreementId);
        if (msg.sender != agreement.client) revert Unauthorized();
        if (agreement.status != Status.Active) revert InvalidStatus(Status.Active, agreement.status);

        _completeAndPay(agreement);

        emit AgreementReleased(agreementId, msg.sender, agreement.beneficiary, agreement.amount);
    }

    /// @notice Open a dispute for an active or proof-submitted agreement.
    /// @param agreementId Agreement id.
    function openDispute(uint256 agreementId) external {
        Agreement storage agreement = _agreementAt(agreementId);
        if (msg.sender != agreement.client && msg.sender != agreement.beneficiary) revert Unauthorized();
        if (agreement.status != Status.Active && agreement.status != Status.Submitted) {
            revert InvalidDisputeStatus(agreement.status);
        }

        agreement.status = Status.Disputed;
        disputedAgreements += 1;

        emit AgreementDisputed(agreementId, msg.sender);
    }

    /// @notice Resolve a disputed agreement by splitting funds between client and beneficiary.
    /// @param agreementId Agreement id.
    /// @param clientBps Client share in basis points.
    /// @param beneficiaryBps Beneficiary share in basis points.
    function resolveDispute(uint256 agreementId, uint16 clientBps, uint16 beneficiaryBps) external nonReentrant {
        Agreement storage agreement = _agreementAt(agreementId);
        if (msg.sender != agreement.arbiter) revert Unauthorized();
        if (agreement.status != Status.Disputed) revert InvalidStatus(Status.Disputed, agreement.status);
        if (uint256(clientBps) + uint256(beneficiaryBps) != 10_000) revert InvalidSplit();

        uint256 clientAmount = (agreement.amount * clientBps) / 10_000;
        uint256 beneficiaryAmount = agreement.amount - clientAmount;

        agreement.status = Status.Resolved;
        agreement.completedAt = block.timestamp;

        if (clientAmount > 0) {
            usdc.safeTransfer(agreement.client, clientAmount);
        }
        if (beneficiaryAmount > 0) {
            usdc.safeTransfer(agreement.beneficiary, beneficiaryAmount);
        }

        emit AgreementResolved(agreementId, msg.sender, clientAmount, beneficiaryAmount, clientBps, beneficiaryBps);
    }

    /// @notice Refund an expired created or active agreement back to the client.
    /// @param agreementId Agreement id.
    function refundExpired(uint256 agreementId) external nonReentrant {
        Agreement storage agreement = _agreementAt(agreementId);
        if (msg.sender != agreement.client && msg.sender != agreement.beneficiary) revert Unauthorized();
        if (agreement.status != Status.Created && agreement.status != Status.Active) {
            revert InvalidRefundStatus(agreement.status);
        }
        if (block.timestamp <= agreement.deadline) revert DeadlineNotReached();

        agreement.status = Status.Refunded;
        agreement.completedAt = block.timestamp;

        usdc.safeTransfer(agreement.client, agreement.amount);

        emit AgreementRefunded(agreementId, msg.sender, agreement.amount);
    }

    /// @notice Cancel an agreement that has not been accepted by the beneficiary.
    /// @param agreementId Agreement id.
    function cancelUnaccepted(uint256 agreementId) external nonReentrant {
        Agreement storage agreement = _agreementAt(agreementId);
        if (msg.sender != agreement.client) revert Unauthorized();
        if (agreement.status != Status.Created) revert InvalidStatus(Status.Created, agreement.status);

        agreement.status = Status.Cancelled;
        agreement.completedAt = block.timestamp;

        usdc.safeTransfer(agreement.client, agreement.amount);

        emit AgreementCancelled(agreementId, msg.sender, agreement.amount);
    }

    /// @notice Return a full agreement record.
    /// @param agreementId Agreement id.
    function getAgreement(uint256 agreementId) external view returns (Agreement memory) {
        return _agreementAt(agreementId);
    }

    /// @notice Return the number of agreements created.
    function getAgreementCount() external view returns (uint256) {
        return _agreements.length;
    }

    /// @notice Return the number of agreements associated with a user in any role.
    /// @param user User address.
    function getUserAgreementCount(address user) external view returns (uint256) {
        return _userAgreementIds[user].length;
    }

    /// @notice Return a paginated set of agreement ids for a user.
    /// @param user User address.
    /// @param offset Starting index in the user's agreement id list.
    /// @param limit Maximum ids to return.
    function getUserAgreementIds(address user, uint256 offset, uint256 limit) external view returns (uint256[] memory ids) {
        uint256 total = _userAgreementIds[user].length;
        if (offset >= total || limit == 0) {
            return new uint256[](0);
        }

        uint256 end = offset + limit;
        if (end > total) {
            end = total;
        }

        ids = new uint256[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            ids[i - offset] = _userAgreementIds[user][i];
        }
    }

    function _agreementAt(uint256 agreementId) private view returns (Agreement storage agreement) {
        if (agreementId >= _agreements.length) revert AgreementNotFound();
        agreement = _agreements[agreementId];
    }

    function _completeAndPay(Agreement storage agreement) private {
        agreement.status = Status.Completed;
        agreement.completedAt = block.timestamp;
        completedAgreements += 1;

        usdc.safeTransfer(agreement.beneficiary, agreement.amount);
    }

    function _trackParticipants(uint256 agreementId, address client, address beneficiary, address arbiter) private {
        _userAgreementIds[client].push(agreementId);
        if (beneficiary != client) {
            _userAgreementIds[beneficiary].push(agreementId);
        }
        if (arbiter != client && arbiter != beneficiary) {
            _userAgreementIds[arbiter].push(agreementId);
        }
    }
}
