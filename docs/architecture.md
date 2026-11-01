# CredChain — System Architecture & Technical Specification

## 1. Executive Summary

**CredChain** is a full-stack, enterprise-grade loan lifecycle management application combining the rapid relational capabilities of **PostgreSQL** with the tamper-evident auditing and trustlessness of **Solidity Smart Contracts**.

---

## 2. Core Architectural Principle: The Hybrid Web2 + Web3 Model

### The 5-Step Lifecycle for a ₹5,00,000 Loan:

```
[Borrower (Browser)]
       │ (1) Submit Application
       ▼
[Express REST API] ──(1) Store Form & KYC Docs──► [PostgreSQL Database]
       │                                                 ▲
       │ (2) Send Essential Info (LoanId, Amount, Tenure) │ (4) Store Tx Hash &
       ▼                                                 │     Contract Address
[Smart Contract (EVM)] ──(3) Commit On-Chain State───────┘
                                                         │
[Dashboard Display] ◄────(5) Ultra-fast Read (<20ms)─────┘
```

1. **Step 1 — Off-Chain Storage in PostgreSQL:**
   When a borrower applies for a ₹5,00,000 loan, detailed applicant profiles, address proof, PAN/Aadhaar references, and bank statements are stored safely in PostgreSQL. PII and large files are **never** put on-chain.
2. **Step 2 — Smart Contract Execution:**
   The backend extracts non-sensitive parameters (application hash, principal amount, duration) and dispatches an on-chain transaction.
3. **Step 3 — Blockchain State Commit:**
   The smart contract registers the loan event (`LoanRegistered`) on the blockchain.
4. **Step 4 — Fast Retrieval Indexing:**
   The transaction hash (`0x...`), smart contract address, network, and block timestamp are persisted in PostgreSQL's `blockchain_transactions` table.
5. **Step 5 — High-Performance Dashboard Loading:**
   When the user or lender opens their dashboard, the application queries PostgreSQL directly in under 20ms, rendering verified on-chain proof without waiting for slow Web3 RPC endpoints.

---

## 3. Database Schema Overview (PostgreSQL)

| Table | Purpose |
|---|---|
| `users` | Multi-role user accounts (Applicant, Lender, Admin) with bcrypt password hashes |
| `applicant_profiles` | Financial declarations (income, credit score, existing liabilities) |
| `loan_policy_rules` | Dynamic underwriting thresholds set by Admin / Higher Authority |
| `loan_applications` | Master loan records with dual-stage approval (Admin compliance + Lender decision) |
| `documents` | Uploaded document metadata, MIME types, and per-document verification flags |
| `verification_checks` | Granular KYC and eligibility audit check entries |
| `repayments` | Amortisation schedule installments with payment reference codes |
| `blockchain_transactions` | On-chain receipts (tx hash, contract address, network, status) |
| `audit_logs` | Immutable audit entries capturing every sensitive action in the system |

---

## 4. Smart Contract Architecture (`LoanManagement.sol`)

* **Contract Standard:** Solidity `^0.8.20`
* **Access Control:** Multi-role modifier controls (`onlyOwner`, `onlyLender`, `onlyOperatorOrOwner`)
* **State Machine:**
  `Submitted` (0) → `Approved` (1) / `Rejected` (2) → `Disbursed` (3) → `Active` (4) → `FullyRepaid` (5) / `Defaulted` (6)
* **Events Emitted:**
  * `LoanRegistered(loanId, applicationRef, applicant, principalAmount, tenureMonths, timestamp)`
  * `LoanApproved(loanId, lender, interestRateBps, totalRepayable, timestamp)`
  * `LoanDisbursed(loanId, disbursedBy, amount, timestamp)`
  * `RepaymentRecorded(loanId, repaymentIndex, amountPaid, remainingBalance, paymentRef, timestamp)`
  * `LoanCompleted(loanId, totalRepaid, closedAt)`

---

## 5. Security & Privacy Guarantees

1. **No PII On-Chain:** Identity cards, bank statements, and salary slips are stored in private disk directories, never on the public ledger.
2. **Server-Side Enforcement:** Financial decisions and role transitions are strictly executed through server middleware; clients cannot manipulate loan status.
3. **Prepared SQL Statements:** All queries use parameterized inputs to neutralize SQL injection attacks.
4. **Resilient Offline Mode:** If the blockchain node is unreachable, the system records deterministic receipts and continues serving applicants without interruption.

