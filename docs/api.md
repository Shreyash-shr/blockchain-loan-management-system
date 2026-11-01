# CredChain — REST API Documentation

Base URL: `http://localhost:5000/api`

---

## Authentication Endpoints (`/api/auth`)

### 1. Register User
* **POST** `/api/auth/register`
* **Access:** Public (Registers as `applicant`)
* **Body:**
  ```json
  {
    "full_name": "Aarav Sharma",
    "email": "aarav@example.com",
    "password": "password123",
    "phone": "+91 98765 43210"
  }
  ```
* **Response (201):**
  ```json
  {
    "message": "User registered successfully",
    "token": "eyJhbGciOi...",
    "user": { "id": "...", "full_name": "...", "email": "...", "role": "applicant" }
  }
  ```

### 2. Login
* **POST** `/api/auth/login`
* **Access:** Public
* **Body:**
  ```json
  {
    "email": "admin@credchain.io",
    "password": "password123",
    "role": "admin"
  }
  ```
* **Response (200):** Returns JWT token and authenticated user profile.

---

## Loan Applications Endpoints (`/api/applications`)

### 1. Submit Application
* **POST** `/api/applications`
* **Access:** Authenticated `applicant`
* **Body:**
  ```json
  {
    "requested_amount": 500000,
    "purpose": "Commercial expansion",
    "tenure_months": 24
  }
  ```
* **Response (201):**
  ```json
  {
    "message": "Loan application submitted successfully and registered on blockchain.",
    "application": {
      "id": "...",
      "requested_amount": "500000.00",
      "status": "requested",
      "transaction_hash": "0x7c4f39b1a20d436ef482fa816913e2bb978453ef671d182283ad56c703b44b82",
      "contract_address": "0x3A2cE7495B5B84Ac544A30B48007C38B13dB5725"
    }
  }
  ```

### 2. Get My Applications
* **GET** `/api/applications/me`
* **Access:** Authenticated `applicant`
* **Response (200):** Array of all applications with attached `transaction_hash`, `contract_address`, and `blockchain_status`.

---

## Lender Underwriting Endpoints (`/api/loans`)

### 1. Get Application Queue
* **GET** `/api/loans/requests`
* **Access:** Authenticated `lender`
* **Query Params:** `status`, `search`, `page`, `limit`
* **Response (200):** List of verified applications with document counts and on-chain verification tags.

### 2. Loan Decision (Approve / Reject)
* **PATCH** `/api/loans/:id/decision`
* **Access:** Authenticated `lender`
* **Body:**
  ```json
  {
    "status": "approved",
    "reason": "Satisfies CIBIL and monthly income thresholds",
    "verified_credit_score": 780,
    "verified_monthly_income": 75000
  }
  ```
* **Response (200):**
  ```json
  {
    "message": "Loan approved successfully and recorded on blockchain.",
    "new_status": "approved",
    "blockchain_tx": {
      "transaction_hash": "0x...",
      "transaction_type": "loan_approved",
      "tx_status": "confirmed"
    }
  }
  ```

---

## Repayment Endpoints (`/api/repayments`)

### 1. Get Applicant Schedule
* **GET** `/api/repayments/me`
* **Access:** Authenticated `applicant`
* **Response (200):** Full amortisation schedule with `due_date`, `amount_due`, `status`, and payment references.

### 2. Pay Installment
* **POST** `/api/repayments/checkout`
* **Access:** Authenticated `applicant`
* **Body:**
  ```json
  {
    "repayment_id": "..."
  }
  ```
* **Response (200):**
  ```json
  {
    "message": "Payment processed successfully and recorded on blockchain.",
    "payment_reference": "PAY-179291...",
    "blockchain_tx": { "transaction_hash": "0x..." }
  }
  ```

---

## Admin Endpoints (`/api/admin`)

* **GET** `/api/admin/dashboard` — Global counts, daily trend metrics, and audit log stream.
* **GET** `/api/admin/verification` — Applications awaiting initial KYC and compliance certification.
* **PATCH** `/api/admin/verification/:id` — Certifies compliance (`verified` / `rejected`).
* **GET** `/api/admin/loans` — Surveillance grid across all loans including live on-chain status.
* **GET** `/api/admin/reports` — Summary and monthly performance breakdowns.

