# FULL-STACK BLOCKCHAIN-BASED LOAN MANAGEMENT SYSTEM

## 1. ROLE

Act as a Senior Full-Stack Developer, MERN/React Developer, PostgreSQL Database Architect, UI/UX Designer, Backend Engineer, Application Security Engineer, and Blockchain Smart Contract Developer with 5+ years of practical development experience.

You are responsible for designing, developing, testing, and documenting a complete, functional, responsive, and secure web application—not merely generating a UI prototype.

Work directly inside my existing project folder when development tools allow it. Inspect the existing code before modifying anything, preserve useful components, and fix existing errors without unnecessarily rebuilding the project.

## 2. PROJECT TITLE

**Blockchain-Based Loan Management System with Smart Contracts**

Application name: CredChain.

## 3. PROJECT OBJECTIVE

Develop a full-stack web application that digitizes the loan lifecycle, from applicant registration and document submission to verification, lender decisions, loan tracking, repayments, administrative reporting, and blockchain-based auditability.

The application must have three distinct roles:

1. Applicant
2. Loan Lender
3. Admin

All three roles must use a unified login page with role-based access control.

The frontend must communicate with the backend API. The backend must communicate with PostgreSQL. Do not use mock data as the final data source.

## 4. EXISTING PROJECT CONTEXT

I already have a React + Vite + Tailwind CSS frontend prototype.

The project currently includes or is intended to include:

- `src/App.jsx`
- `src/main.jsx`
- `src/index.css`
- `index.html`
- `package.json`
- `vite.config.js`
- `tailwind.config.js`
- `postcss.config.js`

The project uses React, Tailwind CSS, Vite, and Lucide icons.

Tailwind CSS should remain on a compatible version, preferably Tailwind CSS 3.4.x, unless you deliberately migrate the entire configuration and dependencies.

The frontend currently contains prototype dashboards and demo interactions. Replace demo authentication, sample loan records, in-memory application submissions, and simulated loan decisions with real API integrations.

Before making changes:
1. Inspect the existing project structure and dependencies.
2. Identify errors and incompatible packages.
3. Preserve the existing visual design where practical.
4. Create a clear implementation plan.
5. Implement the application in working stages.
6. Verify each stage before proceeding.

Do not stop after producing a plan or a few code snippets. Implement the complete project.

## 5. REQUIRED TECHNOLOGY STACK

### Frontend
- React.js
- Vite
- Tailwind CSS
- React Router
- Axios or a reusable Fetch API client
- Lucide React icons
- Recharts for administrative analytics
- React Hook Form and Zod, if useful for form validation
- Toast notifications for user feedback

### Backend
- Node.js
- Express.js
- PostgreSQL driver: `pg`
- REST API architecture
- Zod or an equivalent validation library
- bcrypt or bcryptjs for password hashing
- Secure session authentication or JWT-based authentication
- Multer for controlled multipart file uploads
- Helmet for HTTP security headers
- CORS configured for the frontend origin
- Rate limiting for authentication and sensitive endpoints

### Database
- PostgreSQL
- UUID primary keys where appropriate
- Foreign key constraints
- Unique constraints
- Database indexes
- Transactions for operations requiring atomicity
- SQL migrations or a repeatable schema setup

### Blockchain
- Solidity smart contracts
- Hardhat for development and testing
- ethers.js for blockchain integration
- A local development chain or test network
- Backend-controlled transaction execution

Keep the blockchain integration modular so the core loan-management application can work before a blockchain network is configured.

## 6. REQUIRED SYSTEM ARCHITECTURE

Implement this architecture:

Applicant / Loan Lender / Admin
        |
        v
React + Tailwind CSS Frontend
        |
        v
Node.js + Express REST API
        |
        +----------------------+
        |                      |
        v                      v
PostgreSQL Database      Verification Services
                               |
                               +-- Credit verification
                               +-- Income verification
                               +-- KYC/document review
                               +-- Eligibility rules
        |
        v
Authorized Loan Workflow
        |
        v
Backend Smart-Contract Service
        |
        v
Blockchain Network

Important architecture requirements:

- React must never connect directly to PostgreSQL.
- Database credentials must remain exclusively on the backend.
- The frontend must not decide whether a loan is approved.
- Only authorized lenders can make loan decisions.
- Eligibility and verification rules must be enforced server-side.
- Smart-contract transactions must be initiated by an authorized backend service.
- Sensitive identity documents and personal information must not be written to a public blockchain.

## 7. UI/UX DESIGN REQUIREMENTS

Create a professional fintech application with a clean, trustworthy, modern interface.

Use:
- Responsive layouts for desktop, tablet, and mobile
- Consistent spacing, typography, and component styles
- A collapsible sidebar for dashboards
- Top navigation with notifications and profile controls
- Cards displaying statistics
- Searchable, sortable, and paginated tables
- Clear status badges
- Loading indicators and skeleton screens
- Empty states and error states
- Confirmation dialogs for important actions
- Toast messages for successful and failed operations
- Accessible labels, keyboard navigation, and sufficient contrast

Use a consistent brand identity for CredChain with a navy/white base, blue primary actions, and restrained green, amber, and red status colors.

Do not introduce unnecessary animations or decorative elements that make financial information difficult to read.

All buttons, forms, tables, menus, and navigation controls must perform real, appropriate actions.

## 8. UNIFIED LOGIN AND REGISTRATION

Create a single authentication entry point for all three roles.

The login screen must include:
- Email address
- Password
- Show/hide password
- Remember-me behavior, if implemented securely
- Forgot-password flow
- Login button
- Registration link
- Role selection for Applicant, Loan Lender, and Admin
- Appropriate validation and error messages

Registration should support applicant self-registration.

Loan Lender and Admin accounts must be created or authorized through a trusted administrative process. Never allow a public user to obtain elevated permissions simply by selecting a role in the frontend.

Authentication requirements:
- Secure password hashing
- Login and logout
- Server-side role-based access control
- Protected frontend routes
- Backend authorization middleware
- Session or token expiration
- Rate limiting and login error handling
- Secure password reset flow
- No plaintext passwords or secrets in logs
- No hardcoded administrator credentials in source code

If cookie-based authentication is used, configure secure, HTTP-only cookies, appropriate SameSite settings, and CSRF protection where required.

## 9. APPLICANT MODULE

Create a complete applicant dashboard.

### 9.1 Applicant dashboard

Display:
- Total applications
- Pending verification
- Approved loans
- Rejected loans
- Active loans
- Outstanding balance
- Next repayment date and amount
- Recent application activity
- Loan status timeline

Retrieve all values from authenticated backend APIs.

### 9.2 Applicant profile and registration

Collect the following fields:

Personal information:
- Full name
- Date of birth
- Age, calculated from date of birth
- Gender, with an appropriate optional/prefer-not-to-say option
- Email
- Phone number
- Address, where required

Financial information:
- Monthly income
- Credit score/CIBIL score, if available
- Existing loan details
- Existing monthly EMI obligations, if applicable
- Employment or income source, if required

The backend must validate all submitted information.

Do not treat a credit score entered by the applicant as an independently verified credit score. Maintain a distinction between declared and verified financial information.

### 9.3 Loan application form

Collect:
- Requested loan amount
- Loan purpose
- Preferred tenure
- Applicant profile details
- Required supporting documents
- Consent to verification
- Declaration that the supplied information is accurate

Show the application reference number and submission timestamp after successful submission.

The application must be stored in PostgreSQL.

### 9.4 Document uploads

Support the following document categories:

1. PAN Card
2. Aadhaar Card
3. Address proof:
   - Aadhaar, where legally appropriate and permitted
   - Electricity bill
   - Water bill
   - Other permitted proof of address
4. Original bank statement for the previous six months
5. Photograph
6. Signature
7. Salary slips for the previous three to six months

Accepted formats:
- JPG
- JPEG
- PNG
- PDF

Implement:
- Configurable file-size limits
- File extension and MIME validation
- File-content/signature validation
- Safe server-generated filenames
- Protected document storage
- Document metadata in PostgreSQL
- Upload progress and clear error messages
- Document status: Pending, Verified, Rejected, Needs Review
- Re-upload when a document is rejected

Store actual files in protected local storage for development or private object storage for deployment. Store file metadata and a protected storage key in PostgreSQL.

Never expose private document URLs publicly.

Collect only necessary personal data. Do not retain unnecessary Aadhaar information or documents, and implement applicable privacy, consent, and retention requirements.

### 9.5 Applicant loan functions

Applicants must be able to:
- Submit a loan application
- View their own applications
- Track application status
- View verification progress
- View lender decisions and permitted reasons
- View approved loan terms
- View smart-contract status and transaction references
- View repayment schedules
- Make repayments through an integrated payment provider, when configured
- View repayment history
- Download permitted loan receipts
- Update eligible profile information

Applicants must never be able to approve their own applications or modify lender-only fields.

## 10. LOAN LENDER MODULE

Create a dedicated lender dashboard.

### 10.1 Lender overview

Display live metrics:
- New requests
- Applications under review
- Approved loans
- Rejected loans
- Ongoing loans
- Completed loans
- Pending document verifications

### 10.2 Loan request queue

Display:
- Application number
- Applicant name
- Requested amount
- Loan purpose
- Submission date
- Verification status
- Credit score, only when lawfully available and authorized
- Current application status

Include search, filters, pagination, and sorting.

### 10.3 Applicant detail and verification page

When a lender opens an application, display:
- Relevant applicant profile details
- Declared and verified income
- Declared and verified credit information, where available
- Existing loan obligations
- Requested loan amount and tenure
- Document checklist
- Protected document previews/downloads
- Verification service results
- Eligibility checks
- Review history
- Audit trail for permitted actions

Document access must be authorized on the backend. Do not expose documents belonging to other applicants.

### 10.4 Approval and rejection

Provide:
- Approve loan action
- Reject loan action
- Optional request-for-correction or more-information action
- Required decision confirmation
- Rejection reason where applicable
- Decision timestamp
- Lender identity and audit entry

Before approval, enforce configurable business rules and required verification checks.

A successful decision must update PostgreSQL transactionally and create an audit record.

If blockchain integration is enabled, create a corresponding smart-contract transaction through the backend and track whether it is pending, confirmed, or failed.

Do not display a blockchain transaction as confirmed until the network confirms it.

### 10.5 Completed loans

Provide a view of completed loans, repayment completion, and loan closure information.

## 11. ADMIN MODULE

Create a comprehensive administration dashboard.

### 11.1 Dashboard statistics

Display:
- Total registered applicants
- Total lenders
- Total loan applications
- Requested loans
- Applications under review
- Approved loans
- Rejected loans
- Ongoing loans
- Repaid loans
- Completed loans
- Outstanding loan amount, where data supports the calculation
- Daily application counts
- Daily approval and rejection counts

Statistics must be calculated from real PostgreSQL records, not hardcoded sample values.

### 11.2 Analytics

Create charts for:
- Daily applications
- Approved versus rejected loans
- Loan status distribution
- Monthly application trends
- Repayment performance
- Loan completion trends

Provide date-range filters and appropriate empty states.

### 11.3 Loan monitoring

Allow authorized administrators to:
- View all applications
- Filter by status, lender, date, and application number
- View application and decision history
- Monitor repayments
- Monitor blockchain transactions
- Investigate failed transactions
- Review audit logs

Administrators must not silently alter financial decisions or delete audit history.

### 11.4 Reports

Generate reports using database-backed data.

Support CSV export for authorized users, with appropriate data minimization and protection of personal information.

Do not expose unnecessary identity details in reports.

## 12. POSTGRESQL DATABASE DESIGN

Create a normalized relational schema with migrations or repeatable SQL setup.

Include at least these tables:

### users
- id
- full_name
- email
- phone
- password_hash
- role
- is_active
- created_at
- updated_at

### applicant_profiles
- user_id
- date_of_birth
- gender
- address fields, where needed
- monthly_income
- declared_credit_score
- existing_loan_details
- profile_completed
- created_at
- updated_at

### loan_applications
- id
- application_number
- applicant_id
- assigned_lender_id
- requested_amount
- purpose
- tenure_months
- status
- declared and verified financial information, where appropriate
- lender_decision_reason
- submitted_at
- decided_at
- completed_at
- updated_at

### documents
- id
- applicant_id
- application_id
- document_type
- original_filename
- storage_key
- MIME type
- file size
- verification_status
- reviewer_id
- reviewer_note
- uploaded_at
- reviewed_at

### verification_checks
- id
- application_id
- check_type
- provider
- status
- result_summary
- checked_by
- checked_at
- created_at

### repayments
- id
- application_id
- due_date
- amount_due
- amount_paid
- payment_reference
- status
- paid_at
- created_at

### blockchain_transactions
- id
- application_id
- network
- contract_address
- transaction_hash
- transaction_type
- transaction_status
- created_at
- confirmed_at

### audit_logs
- id
- actor_user_id
- action
- entity_type
- entity_id
- details
- created_at

Add foreign keys, constraints, indexes, appropriate numeric types, timestamps, and unique constraints.

Use database transactions for operations that update multiple related records.

Never store passwords in plaintext.

Do not store sensitive identity documents or full identity numbers on a public blockchain.

## 13. BACKEND REST API

Implement and document a consistent REST API.

### Authentication
- POST `/api/auth/register`
- POST `/api/auth/login`
- POST `/api/auth/logout`
- GET `/api/auth/me`
- POST `/api/auth/forgot-password`
- POST `/api/auth/reset-password`

### Applicant
- GET `/api/applicants/me`
- PATCH `/api/applicants/me`
- GET `/api/applications/me`
- POST `/api/applications`
- GET `/api/applications/:id`
- POST `/api/documents`
- GET `/api/documents/:id`
- GET `/api/documents/:id/download`

### Lender
- GET `/api/loans/requests`
- GET `/api/loans/:id`
- POST `/api/loans/:id/verification`
- PATCH `/api/loans/:id/decision`
- GET `/api/loans/completed`

### Repayments
- GET `/api/repayments/me`
- POST `/api/repayments/checkout`
- POST `/api/payments/webhook`, if using a payment provider
- GET `/api/repayments/:id`

### Admin
- GET `/api/admin/dashboard`
- GET `/api/admin/loans`
- GET `/api/admin/reports`
- GET `/api/admin/audit-logs`
- GET `/api/admin/users`
- PATCH `/api/admin/users/:id/status`

### Blockchain
- POST `/api/blockchain/loans/:id/submit`
- GET `/api/blockchain/transactions/:id`
- GET `/api/blockchain/loans/:id/status`

Protect every route using authentication and role-based authorization.

Validate query parameters, route parameters, request bodies, uploaded files, and state transitions.

Use parameterized SQL queries. Return consistent JSON responses and appropriate HTTP status codes.

Never trust an applicant ID, lender ID, role, approval status, or payment status merely because it was supplied by the client.

## 14. LOAN LIFECYCLE AND BUSINESS RULES

Implement an explicit state machine with valid transitions.

Example lifecycle:

Requested
    |
    v
Under Review
    |
    +------> Rejected
    |
    v
Approved
    |
    v
Ongoing
    |
    v
Repaid / Completed

Support a Needs Information or Needs Correction state if needed.

Define which roles may trigger each transition.

The backend must reject invalid transitions, duplicate decisions, unauthorized updates, and inconsistent repayment operations.

Make loan eligibility rules configurable. Do not invent a claim that a score, income, or document is independently verified when it has only been entered by an applicant.

If an external credit bureau, KYC provider, income-verification service, or payment gateway is not configured, clearly mark the service as unavailable or awaiting manual verification. Never fabricate verification results.

## 15. SMART CONTRACT REQUIREMENTS

Implement a modular Solidity smart contract using a suitable version of Solidity and a supported Hardhat setup.

The contract may track:
- Application or loan reference
- Authorized lender decision
- Approved principal
- Interest or repayment terms, when finalized
- Loan lifecycle status
- Repayment events or payment references
- Completion status

Requirements:
- Role-based authorization on-chain where appropriate
- State-transition validation
- Events for important lifecycle actions
- Unit tests
- Deployment script
- Environment-based network configuration
- Transaction receipt and confirmation handling
- Clear separation between database state and blockchain state

Do not store PAN, Aadhaar, bank statements, salary slips, passwords, or sensitive personal information on-chain.

Use a non-sensitive reference or cryptographic commitment if on-chain linkage is required.

Never put private keys or seed phrases in React code, public environment variables, source control, or logs.

Do not claim that a smart contract legally approves a loan or independently verifies identity. Those responsibilities depend on the authorized off-chain workflow and applicable regulations.

If blockchain credentials or a network are unavailable, the rest of the application must still run, and blockchain actions must clearly show that integration is not configured.

## 16. SECURITY AND PRIVACY

Implement:
- Authentication and authorization middleware
- Secure password hashing
- Rate limiting
- Request validation
- Parameterized database queries
- Helmet security headers
- Restricted CORS
- Secure session or token management
- CSRF protection when required by the authentication strategy
- File upload validation
- Private document access
- Secrets through backend environment variables
- Audit logs for important actions
- Safe error messages
- Input length and numeric range validation
- Data minimization and retention controls

Never log passwords, authentication tokens, private keys, full identity numbers, or document contents.

Use HTTPS in deployment.

Treat financial, identity, and credit data as sensitive. Build appropriate consent, access, retention, and deletion workflows subject to applicable law.

## 17. REQUIRED PROJECT STRUCTURE

Organize the repository clearly, for example:

project-root/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── layouts/
│   │   ├── pages/
│   │   │   ├── auth/
│   │   │   ├── applicant/
│   │   │   ├── lender/
│   │   │   └── admin/
│   │   ├── services/
│   │   ├── hooks/
│   │   ├── routes/
│   │   ├── schemas/
│   │   ├── utils/
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   └── .env.example
├── server/
│   ├── src/
│   │   ├── config/
│   │   ├── db/
│   │   ├── middleware/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── routes/
│   │   ├── validators/
│   │   ├── utils/
│   │   └── app.js
│   ├── migrations/
│   ├── tests/
│   ├── package.json
│   └── .env.example
├── blockchain/
│   ├── contracts/
│   ├── scripts/
│   ├── test/
│   └── hardhat.config.js
├── docs/
│   ├── architecture.md
│   └── api.md
├── .gitignore
└── README.md

You may adapt this structure to the existing repository, but keep frontend, backend, and blockchain responsibilities clearly separated.

## 18. ENVIRONMENT CONFIGURATION

Create `.env.example` files without real secrets.

Backend configuration should include placeholders for:
- Server port
- PostgreSQL connection URL
- Authentication secret or session configuration
- Frontend origin
- Private document storage path
- File-size limit
- Optional payment-provider credentials
- Optional blockchain RPC URL
- Optional blockchain signer configuration

Frontend configuration may include the public backend API base URL only.

Never place database passwords, signing keys, private keys, or server-only secrets in variables prefixed with `VITE_`.

## 19. TESTING REQUIREMENTS

Write and run tests for:
- Applicant registration and login
- Invalid credentials
- Role-based access restrictions
- Applicant profile updates
- Loan application submission
- Required-field validation
- Document type and file-size validation
- Document access permissions
- Lender approval and rejection
- Invalid loan status transitions
- Repayment processing
- Admin dashboard calculations
- SQL transaction handling
- Smart-contract access control and state transitions

Include test instructions and example test data.

Do not use real personal or financial documents as test fixtures.

Run the frontend production build, backend tests, and smart-contract tests where supported.

Fix errors caused by your implementation before declaring the application complete.

## 20. IMPLEMENTATION WORKFLOW

Work in the following order:

Phase 1: Inspect the existing project and establish a working frontend build.

Phase 2: Complete frontend routing, shared components, forms, applicant dashboard, lender dashboard, and admin dashboard.

Phase 3: Create PostgreSQL schema and repeatable migrations.

Phase 4: Implement Express server, database connection, health endpoint, authentication, and authorization.

Phase 5: Connect applicant registration, profiles, loan applications, and secure document uploads.

Phase 6: Implement lender review, verification, approval/rejection, and audit logs.

Phase 7: Implement repayments and admin reporting.

Phase 8: Implement and test the optional smart-contract integration.

Phase 9: Add automated tests, fix defects, and verify the end-to-end workflows.

Phase 10: Produce complete setup and troubleshooting documentation.

After each phase, run the relevant checks and fix failures before proceeding.

Do not replace working project files blindly. Do not leave critical functionality as TODO comments, static mock arrays, or fake success messages.

If a third-party service requires credentials, implement a clear integration boundary and document how to configure it. Do not pretend that an unconfigured external service is working.

## 21. REQUIRED DELIVERABLES

At completion, provide:

1. Complete React + Tailwind CSS frontend source code.
2. Complete Node.js + Express backend source code.
3. PostgreSQL schema and migration files.
4. Functional authentication and role-based access control.
5. Applicant, lender, and admin workflows connected to real APIs.
6. Secure document upload and access handling.
7. Admin dashboard with database-backed statistics.
8. Repayment workflow with a clear distinction between demo and real payment processing.
9. Solidity smart contract, tests, and deployment instructions.
10. `.env.example` files for all components.
11. API documentation with request/response examples.
12. Database setup and troubleshooting instructions.
13. A root README explaining installation, configuration, development, testing, and deployment.
14. A list of features implemented and any remaining external configuration requirements.

## 22. DEFINITION OF DONE

The application is complete only when:

- The frontend runs without build errors.
- The backend starts and connects to PostgreSQL.
- Applicant registration and login work against the database.
- User roles are enforced by the backend.
- Applicants can submit applications and view persisted records.
- Documents are uploaded and retrieved through protected endpoints.
- Lenders can review requests and make authorized decisions.
- Admin dashboards show actual database-backed figures.
- Loan status changes and audit logs persist.
- Invalid operations are rejected securely.
- The smart-contract integration is tested or explicitly marked unconfigured.
- Setup instructions work on a clean development environment.
- No secret credentials or real personal data are committed to source control.

## 23. FINAL INSTRUCTIONS

Start by inspecting the existing project files and identifying the current framework versions.

Then create an implementation plan and immediately proceed with development.

Prioritize a fully functional database-backed loan management workflow over unnecessary visual effects.

Use maintainable code, reusable components, consistent naming, secure defaults, and meaningful error handling.

Do not only explain how I could build the project. Build the actual application files, run the available checks, fix errors, and explain exactly how to start the frontend, backend, PostgreSQL database, and optional blockchain service.

If you encounter a technical issue, diagnose and fix it instead of silently skipping the feature.

At the end, summarize what works, provide the exact commands to run each service, explain how to create the first administrator securely, and clearly list anything that still requires external credentials or manual setup.