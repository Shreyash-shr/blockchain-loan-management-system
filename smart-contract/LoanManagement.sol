// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title LoanManagement
 * @author CredChain Team
 * @notice Production-ready smart contract for decentralized loan lifecycle management.
 * @dev Enforces multi-role authorization (Admin, Lender, Operator), state transitions,
 *      repayment auditing, and lifecycle event tracking for CredChain loan applications.
 */
contract LoanManagement {
    // -------------------------------------------------------------------------
    // Enums & Structs
    // -------------------------------------------------------------------------

    enum LoanStatus {
        Submitted,   // 0: Application submitted, awaiting lender decision
        Approved,    // 1: Approved by authorized lender, pending disbursement
        Rejected,    // 2: Rejected by authorized lender
        Disbursed,   // 3: Disbursed to applicant, active repayment schedule
        Active,      // 4: Active ongoing loan
        FullyRepaid, // 5: Completed and all installments cleared
        Defaulted    // 6: Delinquent or defaulted
    }

    struct RepaymentRecord {
        uint256 repaymentIndex;
        uint256 amountPaid;
        uint256 remainingBalance;
        string paymentReference; // Off-chain payment txn/receipt identifier
        uint256 timestamp;
        address recordedBy;
    }

    struct Loan {
        bytes32 loanId;             // Unique loan hash identifier
        string applicationRef;      // Off-chain UUID/human reference (e.g. APP-001)
        address applicant;          // Applicant wallet (or zero address if unlinked)
        address lender;             // Deciding lender address
        uint256 principalAmount;    // Principal loan amount (in currency units/cents)
        uint256 interestRateBps;    // Annual interest rate in Basis Points (e.g., 850 = 8.5%)
        uint256 durationMonths;     // Tenure in months
        uint256 totalRepayable;     // Principal + calculated interest
        uint256 totalRepaid;        // Running sum of all recorded repayments
        LoanStatus status;          // Current status in the loan lifecycle
        uint256 createdAt;          // Submission block timestamp
        uint256 decidedAt;          // Lender decision block timestamp
        uint256 disbursedAt;        // Disbursement block timestamp
        uint256 closedAt;           // Completion block timestamp
        string rejectionReason;     // Stored if rejected
        bool exists;                // Existence guard
    }

    // -------------------------------------------------------------------------
    // State Variables
    // -------------------------------------------------------------------------

    address public owner;
    address public backendOperator;
    bool public paused;

    mapping(address => bool) public authorizedLenders;
    mapping(bytes32 => Loan) private loans;
    mapping(bytes32 => RepaymentRecord[]) private loanRepayments;
    mapping(address => bytes32[]) private applicantLoans;

    bytes32[] private allLoanIds;

    // -------------------------------------------------------------------------
    // Custom Errors (Gas-efficient)
    // -------------------------------------------------------------------------

    error NotOwner();
    error NotAuthorizedLender();
    error NotOperatorOrOwner();
    error ContractIsPaused();
    error LoanAlreadyExists(bytes32 loanId);
    error LoanNotFound(bytes32 loanId);
    error InvalidStatusTransition(LoanStatus current, LoanStatus required);
    error InvalidAmount();
    error InvalidTenure();
    error ZeroAddress();
    error RepaymentExceedsBalance(uint256 attempted, uint256 remaining);

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event LenderAuthorized(address indexed lender, address indexed authorizedBy);
    event LenderRevoked(address indexed lender, address indexed revokedBy);
    event OperatorUpdated(address indexed previousOperator, address indexed newOperator);
    event ContractPaused(address indexed account);
    event ContractUnpaused(address indexed account);

    event LoanRegistered(
        bytes32 indexed loanId,
        string applicationRef,
        address indexed applicant,
        uint256 principalAmount,
        uint256 tenureMonths,
        uint256 timestamp
    );

    event LoanApproved(
        bytes32 indexed loanId,
        address indexed lender,
        uint256 interestRateBps,
        uint256 totalRepayable,
        uint256 timestamp
    );

    event LoanRejected(
        bytes32 indexed loanId,
        address indexed lender,
        string reason,
        uint256 timestamp
    );

    event LoanDisbursed(
        bytes32 indexed loanId,
        address indexed disbursedBy,
        uint256 amount,
        uint256 timestamp
    );

    event RepaymentRecorded(
        bytes32 indexed loanId,
        uint256 repaymentIndex,
        uint256 amountPaid,
        uint256 remainingBalance,
        string paymentReference,
        uint256 timestamp
    );

    event LoanCompleted(
        bytes32 indexed loanId,
        uint256 totalRepaid,
        uint256 closedAt
    );

    event LoanDefaulted(
        bytes32 indexed loanId,
        uint256 outstandingBalance,
        uint256 timestamp
    );

    // -------------------------------------------------------------------------
    // Modifiers
    // -------------------------------------------------------------------------

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyLender() {
        if (!authorizedLenders[msg.sender] && msg.sender != owner) {
            revert NotAuthorizedLender();
        }
        _;
    }

    modifier onlyOperatorOrOwner() {
        if (msg.sender != backendOperator && msg.sender != owner) {
            revert NotOperatorOrOwner();
        }
        _;
    }

    modifier whenNotPaused() {
        if (paused) revert ContractIsPaused();
        _;
    }

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    /**
     * @notice Initializes the CredChain LoanManagement contract.
     * @param _operator Address of the backend server operator authorized to relay off-chain events.
     */
    constructor(address _operator) {
        owner = msg.sender;
        backendOperator = _operator == address(0) ? msg.sender : _operator;
        authorizedLenders[msg.sender] = true;

        emit LenderAuthorized(msg.sender, msg.sender);
        if (backendOperator != msg.sender) {
            emit OperatorUpdated(address(0), backendOperator);
        }
    }

    // -------------------------------------------------------------------------
    // Administrative Functions
    // -------------------------------------------------------------------------

    function setBackendOperator(address _newOperator) external onlyOwner {
        if (_newOperator == address(0)) revert ZeroAddress();
        address oldOperator = backendOperator;
        backendOperator = _newOperator;
        emit OperatorUpdated(oldOperator, _newOperator);
    }

    function authorizeLender(address _lender) external onlyOwner {
        if (_lender == address(0)) revert ZeroAddress();
        authorizedLenders[_lender] = true;
        emit LenderAuthorized(_lender, msg.sender);
    }

    function revokeLender(address _lender) external onlyOwner {
        authorizedLenders[_lender] = false;
        emit LenderRevoked(_lender, msg.sender);
    }

    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        if (_paused) {
            emit ContractPaused(msg.sender);
        } else {
            emit ContractUnpaused(msg.sender);
        }
    }

    function transferOwnership(address _newOwner) external onlyOwner {
        if (_newOwner == address(0)) revert ZeroAddress();
        owner = _newOwner;
    }

    // -------------------------------------------------------------------------
    // Loan Lifecycle Functions
    // -------------------------------------------------------------------------

    /**
     * @notice Registers a new loan application on-chain.
     * @param _loanId Unique hash representing this loan (e.g. keccak256(uuid))
     * @param _applicationRef Off-chain human-readable reference or application UUID
     * @param _applicant Wallet address of applicant (can be address(0) if managed off-chain)
     * @param _principalAmount Requested loan principal amount
     * @param _durationMonths Requested loan duration in months
     */
    function registerLoan(
        bytes32 _loanId,
        string calldata _applicationRef,
        address _applicant,
        uint256 _principalAmount,
        uint256 _durationMonths
    ) external whenNotPaused {
        if (_principalAmount == 0) revert InvalidAmount();
        if (_durationMonths == 0 || _durationMonths > 360) revert InvalidTenure();
        if (loans[_loanId].exists) revert LoanAlreadyExists(_loanId);

        Loan storage newLoan = loans[_loanId];
        newLoan.loanId = _loanId;
        newLoan.applicationRef = _applicationRef;
        newLoan.applicant = _applicant;
        newLoan.principalAmount = _principalAmount;
        newLoan.durationMonths = _durationMonths;
        newLoan.status = LoanStatus.Submitted;
        newLoan.createdAt = block.timestamp;
        newLoan.exists = true;

        allLoanIds.push(_loanId);
        if (_applicant != address(0)) {
            applicantLoans[_applicant].push(_loanId);
        }

        emit LoanRegistered(
            _loanId,
            _applicationRef,
            _applicant,
            _principalAmount,
            _durationMonths,
            block.timestamp
        );
    }

    /**
     * @notice Approves a submitted loan application with sanctioned interest rate and terms.
     * @param _loanId Unique loan identifier
     * @param _interestRateBps Annual interest rate in Basis Points (e.g., 850 = 8.5%)
     * @param _totalRepayable Calculated total repayable amount (principal + interest)
     */
    function approveLoan(
        bytes32 _loanId,
        uint256 _interestRateBps,
        uint256 _totalRepayable
    ) external onlyLender whenNotPaused {
        Loan storage loan = loans[_loanId];
        if (!loan.exists) revert LoanNotFound(_loanId);
        if (loan.status != LoanStatus.Submitted) {
            revert InvalidStatusTransition(loan.status, LoanStatus.Submitted);
        }
        if (_totalRepayable < loan.principalAmount) revert InvalidAmount();

        loan.lender = msg.sender;
        loan.interestRateBps = _interestRateBps;
        loan.totalRepayable = _totalRepayable;
        loan.status = LoanStatus.Approved;
        loan.decidedAt = block.timestamp;

        emit LoanApproved(
            _loanId,
            msg.sender,
            _interestRateBps,
            _totalRepayable,
            block.timestamp
        );
    }

    /**
     * @notice Rejects a submitted loan application with a recorded reason.
     * @param _loanId Unique loan identifier
     * @param _reason Explanation for denial
     */
    function rejectLoan(
        bytes32 _loanId,
        string calldata _reason
    ) external onlyLender whenNotPaused {
        Loan storage loan = loans[_loanId];
        if (!loan.exists) revert LoanNotFound(_loanId);
        if (loan.status != LoanStatus.Submitted) {
            revert InvalidStatusTransition(loan.status, LoanStatus.Submitted);
        }

        loan.lender = msg.sender;
        loan.status = LoanStatus.Rejected;
        loan.decidedAt = block.timestamp;
        loan.rejectionReason = _reason;

        emit LoanRejected(_loanId, msg.sender, _reason, block.timestamp);
    }

    /**
     * @notice Records disbursement of approved funds to the applicant.
     * @param _loanId Unique loan identifier
     */
    function disburseLoan(bytes32 _loanId) external whenNotPaused {
        if (!authorizedLenders[msg.sender] && msg.sender != backendOperator && msg.sender != owner) {
            revert NotAuthorizedLender();
        }

        Loan storage loan = loans[_loanId];
        if (!loan.exists) revert LoanNotFound(_loanId);
        if (loan.status != LoanStatus.Approved) {
            revert InvalidStatusTransition(loan.status, LoanStatus.Approved);
        }

        loan.status = LoanStatus.Disbursed;
        loan.disbursedAt = block.timestamp;

        emit LoanDisbursed(_loanId, msg.sender, loan.principalAmount, block.timestamp);
    }

    /**
     * @notice Records an installment or full repayment against an active or disbursed loan.
     * @param _loanId Unique loan identifier
     * @param _amountPaid Amount paid in this transaction
     * @param _paymentReference External payment reference or receipt hash
     */
    function recordRepayment(
        bytes32 _loanId,
        uint256 _amountPaid,
        string calldata _paymentReference
    ) external whenNotPaused {
        if (!authorizedLenders[msg.sender] && msg.sender != backendOperator && msg.sender != owner) {
            revert NotAuthorizedLender();
        }
        if (_amountPaid == 0) revert InvalidAmount();

        Loan storage loan = loans[_loanId];
        if (!loan.exists) revert LoanNotFound(_loanId);
        if (loan.status != LoanStatus.Disbursed && loan.status != LoanStatus.Active) {
            revert InvalidStatusTransition(loan.status, LoanStatus.Active);
        }

        uint256 currentBalance = loan.totalRepayable > loan.totalRepaid
            ? loan.totalRepayable - loan.totalRepaid
            : 0;

        if (_amountPaid > currentBalance) {
            revert RepaymentExceedsBalance(_amountPaid, currentBalance);
        }

        loan.totalRepaid += _amountPaid;
        uint256 remaining = loan.totalRepayable - loan.totalRepaid;

        // Transition from Disbursed to Active once payments begin
        if (loan.status == LoanStatus.Disbursed) {
            loan.status = LoanStatus.Active;
        }

        uint256 repIndex = loanRepayments[_loanId].length;
        loanRepayments[_loanId].push(
            RepaymentRecord({
                repaymentIndex: repIndex,
                amountPaid: _amountPaid,
                remainingBalance: remaining,
                paymentReference: _paymentReference,
                timestamp: block.timestamp,
                recordedBy: msg.sender
            })
        );

        emit RepaymentRecorded(
            _loanId,
            repIndex,
            _amountPaid,
            remaining,
            _paymentReference,
            block.timestamp
        );

        // Check for full repayment
        if (remaining == 0) {
            loan.status = LoanStatus.FullyRepaid;
            loan.closedAt = block.timestamp;
            emit LoanCompleted(_loanId, loan.totalRepaid, block.timestamp);
        }
    }

    /**
     * @notice Flags a delinquent loan as defaulted.
     * @param _loanId Unique loan identifier
     */
    function markDefaulted(bytes32 _loanId) external onlyLender whenNotPaused {
        Loan storage loan = loans[_loanId];
        if (!loan.exists) revert LoanNotFound(_loanId);
        if (loan.status != LoanStatus.Disbursed && loan.status != LoanStatus.Active) {
            revert InvalidStatusTransition(loan.status, LoanStatus.Active);
        }

        loan.status = LoanStatus.Defaulted;
        loan.closedAt = block.timestamp;

        uint256 outstanding = loan.totalRepayable > loan.totalRepaid
            ? loan.totalRepayable - loan.totalRepaid
            : 0;

        emit LoanDefaulted(_loanId, outstanding, block.timestamp);
    }

    // -------------------------------------------------------------------------
    // View Functions
    // -------------------------------------------------------------------------

    /**
     * @notice Retrieves the full loan record details.
     */
    function getLoan(bytes32 _loanId) external view returns (Loan memory) {
        if (!loans[_loanId].exists) revert LoanNotFound(_loanId);
        return loans[_loanId];
    }

    /**
     * @notice Retrieves all repayment records for a given loan.
     */
    function getLoanRepayments(bytes32 _loanId)
        external
        view
        returns (RepaymentRecord[] memory)
    {
        if (!loans[_loanId].exists) revert LoanNotFound(_loanId);
        return loanRepayments[_loanId];
    }

    /**
     * @notice Retrieves all loan IDs associated with a specific applicant wallet address.
     */
    function getApplicantLoans(address _applicant)
        external
        view
        returns (bytes32[] memory)
    {
        return applicantLoans[_applicant];
    }

    /**
     * @notice Returns total number of registered loans.
     */
    function getTotalLoansCount() external view returns (uint256) {
        return allLoanIds.length;
    }

    /**
     * @notice Returns the loanId at a specific index.
     */
    function getLoanIdAtIndex(uint256 _index) external view returns (bytes32) {
        require(_index < allLoanIds.length, "Index out of bounds");
        return allLoanIds[_index];
    }

    /**
     * @notice Calculates the remaining balance on an existing loan.
     */
    function getRemainingBalance(bytes32 _loanId) external view returns (uint256) {
        Loan storage loan = loans[_loanId];
        if (!loan.exists) revert LoanNotFound(_loanId);
        if (loan.totalRepaid >= loan.totalRepayable) return 0;
        return loan.totalRepayable - loan.totalRepaid;
    }
}
