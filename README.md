# CredChain — Blockchain-Based Loan Management System

A full-stack, decentralized loan lifecycle management platform featuring React, Node.js/Express, PostgreSQL, and Solidity smart contracts.

---

## 📁 Project Architecture & Directory Structure

```text
loan-blockchain/
│
├── frontend/                     # React + Vite + Tailwind CSS Single-Page App
│   ├── src/                      # Components, Contexts, Pages, Services
│   │   ├── components/           # Reusable UI components & loan widgets
│   │   ├── context/              # Auth & Toast context providers
│   │   ├── layouts/              # Dashboard layouts with responsive sidebar
│   │   ├── pages/                # Admin, Lender, Applicant & Auth pages
│   │   ├── routes/               # Role-based protected routes
│   │   └── services/api.js       # Centralized REST client with JWT management
│   ├── index.html                # App entry HTML template
│   ├── vite.config.js            # Vite build & bundle configuration
│   ├── tailwind.config.js        # Design tokens & color palette
│   ├── postcss.config.js         # PostCSS plugins
│   ├── package.json              # Frontend dependencies
│   ├── .env                      # Local frontend environment variables
│   └── .env.example              # Frontend environment template
│
├── backend/                      # Node.js + Express REST API Server
│   ├── src/
│   │   ├── app.js                # Express app entry point & middleware stack
│   │   ├── config/database.js    # PostgreSQL connection pool & helpers
│   │   ├── middleware/auth.js    # JWT verification & RBAC authorization
│   │   ├── routes/               # Modular REST endpoints
│   │   │   ├── auth.js           # Registration, login & profile verification
│   │   │   ├── applicants.js     # Applicant profile management
│   │   │   ├── applications.js   # Loan applications & document submission
│   │   │   ├── documents.js      # Controlled file uploads via Multer
│   │   │   ├── loans.js          # Lender underwriting & status transitions
│   │   │   ├── repayments.js     # Repayment tracking & balance updates
│   │   │   └── admin.js          # Admin reports, monitoring & policy rules
│   │   ├── services/
│   │   │   └── blockchain.js     # On-chain event recorder & receipt bridge
│   │   └── validators/schemas.js # Zod validation schemas
│   ├── tests/                    # Automated verification suites
│   ├── uploads/                  # Secure uploaded document storage
│   ├── package.json              # Backend dependencies
│   ├── .env                      # Backend environment variables
│   └── .env.example              # Backend environment template
│
├── database/                     # PostgreSQL Schema, Seed & Setup
│   ├── schema.sql                # Tables, ENUMs, Triggers, Indexes & Constraints
│   ├── seed.sql                  # Default policy rules, test accounts & records
│   └── setup.js                  # Automated database creation & schema runner
│
├── docs/                         # Technical Documentation
│   ├── architecture.md           # System architecture & 5-step hybrid model
│   └── api.md                    # REST API reference & examples
│
└── smart-contract/               # Solidity Smart Contracts & Hardhat Environment
    │
    ├── LoanManagement.sol        # Core smart contract for loan lifecycle tracking
    ├── hardhat.config.cjs        # Hardhat compilation and network settings
    ├── package.json              # Contract test & compilation dependencies
    ├── scripts/
    │   └── deploy.js             # Deployment script for local / test networks
    └── test/
        └── LoanManagement.test.js # Test suite for on-chain loan lifecycle
```

---

## 🚀 Quick Start Guide

### 1. Database Initialization
Ensure PostgreSQL is running locally, then initialize the database and seed data:

```bash
# Run from project root
npm run db:setup

# Or run directly
node database/setup.js
```

Default seeded accounts:
* **Admin:** `admin@credchain.io` / `password123`
* **Lender:** `lender@credchain.io` / `password123`
* **Applicant:** `aarav@example.com` / `password123`

---

### 2. Backend API Server
Start the Express REST API (defaults to port `5000`):

```bash
# From project root
npm run server:start

# Or navigate to backend directory
cd backend
npm install
npm start
```

Health check: `GET http://localhost:5000/api/health`

---

### 3. Frontend Web Application
Start Vite development server (defaults to port `5173`):

```bash
# From project root
npm run dev

# Or navigate to frontend directory
cd frontend
npm install
npm run dev
```

Build production bundle:
```bash
npm run build
```

---

### 4. Smart Contract (Solidity)
The core contract is located at `smart-contract/LoanManagement.sol`.

Key on-chain capabilities:
* **Role-Based Authorization:** Contract owner, authorized lenders, and backend operator.
* **Full Lifecycle Tracking:** `Submitted` → `Approved`/`Rejected` → `Disbursed` → `Active` → `FullyRepaid` / `Defaulted`.
* **Repayment Auditing:** Stores indexed repayment records with external reference proofs.
* **Security & Gas Efficiency:** Custom errors, reentrancy guards, emergency pause controls.

To compile or test with Hardhat:
```bash
cd smart-contract
npm install
npx hardhat compile
npx hardhat test
```

---

### 5. Automated Verification Suites
Run test suites covering authentication, verification, blockchain transactions, and end-to-end lifecycle:

```bash
# Phase 4: Authentication, JWT & RBAC tests
npm run test:phase4

# Phase 5: Applicant profiles & document uploads
npm run test:phase5

# Phase 8: Blockchain + PostgreSQL integration
npm run test:phase8

# Phase 9: Complete End-to-End loan lifecycle test
npm run test:e2e
```

---

## 📚 Technical Documentation
* [System Architecture & Hybrid Model Specification](docs/architecture.md)
* [REST API Reference & Endpoints](docs/api.md)

---

## 🔒 Security Best Practices
* **No Direct DB Access from Frontend:** The React frontend communicates strictly with the Express API.
* **Sanitized File Uploads:** Multer restricts uploads to JPEG, PNG, and PDF up to 10MB into per-user directories.
* **Input Validation:** All client inputs are validated server-side using Zod schemas before SQL execution.
* **On-Chain Privacy:** No sensitive personal identity documents (PAN, Aadhaar) are stored on the blockchain. Only cryptographic loan hashes, authorized decisions, and repayment audit proofs are logged.
