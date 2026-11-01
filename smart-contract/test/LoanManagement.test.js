const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("LoanManagement Contract", function () {
  let LoanManagement, loanContract;
  let owner, lender, applicant, operator;

  beforeEach(async function () {
    [owner, lender, applicant, operator] = await ethers.getSigners();

    LoanManagement = await ethers.getContractFactory("LoanManagement");
    loanContract = await LoanManagement.deploy(operator.address);
    await loanContract.waitForDeployment();

    // Authorize lender
    await loanContract.authorizeLender(lender.address);
  });

  it("Should initialize with correct owner, operator and authorized lender", async function () {
    expect(await loanContract.owner()).to.equal(owner.address);
    expect(await loanContract.backendOperator()).to.equal(operator.address);
    expect(await loanContract.authorizedLenders(lender.address)).to.be.true;
  });

  it("Should register a loan application", async function () {
    const loanId = ethers.keccak256(ethers.toUtf8Bytes("LOAN-TEST-001"));
    const principal = ethers.parseUnits("50000", 0); // 50,000 units
    const tenureMonths = 12;

    await expect(
      loanContract.connect(applicant).registerLoan(
        loanId,
        "APP-2026-001",
        applicant.address,
        principal,
        tenureMonths
      )
    ).to.emit(loanContract, "LoanRegistered");

    const loan = await loanContract.getLoan(loanId);
    expect(loan.applicationRef).to.equal("APP-2026-001");
    expect(loan.principalAmount).to.equal(principal);
    expect(loan.status).to.equal(0); // Submitted
  });

  it("Should allow authorized lender to approve a loan", async function () {
    const loanId = ethers.keccak256(ethers.toUtf8Bytes("LOAN-TEST-002"));
    const principal = ethers.parseUnits("100000", 0);
    const tenureMonths = 24;

    await loanContract.registerLoan(loanId, "APP-002", applicant.address, principal, tenureMonths);

    const interestRateBps = 950; // 9.5%
    const totalRepayable = ethers.parseUnits("110000", 0);

    await expect(
      loanContract.connect(lender).approveLoan(loanId, interestRateBps, totalRepayable)
    ).to.emit(loanContract, "LoanApproved");

    const loan = await loanContract.getLoan(loanId);
    expect(loan.status).to.equal(1); // Approved
    expect(loan.lender).to.equal(lender.address);
  });

  it("Should allow disbursement and repayment tracking", async function () {
    const loanId = ethers.keccak256(ethers.toUtf8Bytes("LOAN-TEST-003"));
    const principal = ethers.parseUnits("50000", 0);
    const totalRepayable = ethers.parseUnits("55000", 0);

    await loanContract.registerLoan(loanId, "APP-003", applicant.address, principal, 12);
    await loanContract.connect(lender).approveLoan(loanId, 1000, totalRepayable);

    // Disburse
    await expect(loanContract.connect(operator).disburseLoan(loanId))
      .to.emit(loanContract, "LoanDisbursed");

    // Repay installment
    const installment = ethers.parseUnits("25000", 0);
    await expect(
      loanContract.connect(operator).recordRepayment(loanId, installment, "TXN-REP-01")
    ).to.emit(loanContract, "RepaymentRecorded");

    let remaining = await loanContract.getRemainingBalance(loanId);
    expect(remaining).to.equal(ethers.parseUnits("30000", 0));

    // Clear remaining balance
    await expect(
      loanContract.connect(operator).recordRepayment(loanId, ethers.parseUnits("30000", 0), "TXN-REP-02")
    ).to.emit(loanContract, "LoanCompleted");

    const finishedLoan = await loanContract.getLoan(loanId);
    expect(finishedLoan.status).to.equal(5); // FullyRepaid
  });
});

