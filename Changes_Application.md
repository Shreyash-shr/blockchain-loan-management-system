There are changes in the application; this file/document states these changes and as supporting material, you can use the Folder named Screenshots in the Main directory (blockchain-loan), which includes screenshots as supporting files for the changes you can refer to.

##Issues:

# Screenshots 1 And 2

     The screen shot 1 shows the new login and new application submission for the applicant "Shreyash Madgundi" with email "shreemadgundi0111@gmail.com". The applicant has never taken a loan before; this is the first time, as shown in screenshot 2, which shows that there are periodic repayments for an applicant who has just applied for a first-time loan.

This is the logical error: an applicant who just created an account gets repayments in the system, so fix this.

# Screenshots 3

    Screenshot 3 shows the admin portal for document verification and loan condition checks like cibil/credit score, income, etc. As a new applicant, "Shreyash Madgundi" applied for a loan; it should show in the admin portal for document verification and loan condition checks. The applied loan is not reflected in the admin portal for document verification, and screenshot 3 shows it.

# Screenshots 4 and 5

    Screenshot 4 shows that the loan is requested from the applicant, but when I click on the details, there are no loan details available, as shown in screenshot 5, such as (Principal, Monthly income, Credit Score, Documents, etc.).

# Screenshots 6

    Screenshot 6 shows that there is no sign-out button visible on the screen, so make it visible.

# Screenshot 7

    Screenshot 7 shows the lender portal with the loan requests. After the loan details are verified by the admin it should be sent to the lender with the message as eligible, valid, or not eligible, invalid, or a custom message from the admin. Since the conditions and documents are already checked by the admin, the lender should have permission to only view documents and details before approving. If there is any mistake or document mismatch, the lender should send the request back to the admin with a proper message. The lender should have buttons to approve and reject the loan request. After approval of the loan, the smart contracts should execute, and the loan should be placed on the blockchain.

# Screenshots 8 and 9

    Screenshot 8 shows the applicant "Meera Joshi" with a rejected status by the lender because the cibil/credit score is low than the threshold. Screenshot 9 shows the same loan status of the rejected applicant, as verified by the admin message: "All documents are verified, and conditions are met successfully," with remarks. So this is not right. If any one condition fails, it should be indicated by a different color, like red, and the message should be according to it.

## Some other changes in the application

# The flow of data ot loan details should be as follows:

    Applicant logs in through the portal and applies for a loan by submitting the documents and other details.

The loan application status goes directly to the admin for verification, where the admin can check the documents, mark them as valid or invalid, check that the conditions are fulfilled, and then send this verified application to the lender. If the admin marks the application as invalid for reasons like (document missing, credit score is not up to the threshold, etc.), the application is sent back to the applicant with a proper and appropriate message (why the loan was rejected).
Now, for the lender, checks the loan requests from the applicant and only views the conditions and documents and approves the loan. If any mistakes that are unseen by the admin is caught by the lender, the application is sent back to the admin for reverification with a proper message and then, if it is not valid, it is sent to the applicant. If the application is valid and the lender approves it, the smart contracts work immediately, and the loan is kept on the blockchain.

# And all the details should be updated to the database in Postgres.

# The blockchain is non-for security, tamper-proof, and transparency, so once the loan is on the blockchain, the loan details like lender details (only permitted info), applicant, repayments, completed, ongoing etc details should be visible for the applicant so that he could track the loan status or updates and also admin should also able to view these details (only permitted) to monitor the loan send messages is any instalment is missed to the applicant and other messages like (congratulations for completion of loan, etc.) and also for lender messages like todays target and other messages.

## The calculations must me definite and once the loan is approved and it is in the blockchain the calculations must be done correctly. The dashboards for each role should show correct calculations such as :

1. Applicants repayments: When applicant clicks the repayment option, there should be reduce in Outstanding principal and other calculations and the system should generate receipt for every repayment.
2. Same for lender calculation.
3. Same for admin calculations.

## Example

1. Example with a real applicant
   Imagine:

Applicant: Rahul

Requested loan: ₹5 lakh

Your system collects:
Check Result
KYC Verified
Credit verification Passed
Existing loan check Passed
Income verification Passed
Requested amount Within limit

Backend sends the relevant verified results:
KYC = true
CreditCheck = true
ExistingLoanCheck = true
IncomeCheck = true

Smart contract receives:
true
true
true
true

Then:
IF all conditions == TRUE
↓
Loan can move to APPROVED/ELIGIBLE state

The important point is that the smart contract isn't calling CIBIL directly.

2. What if the credit check fails?
   Suppose:
   KYC = true
   CreditCheck = false
   ExistingLoanCheck = true
   IncomeCheck = true

Then:
CreditCheck = FALSE
↓
Loan eligibility = FALSE
↓
Loan remains REJECTED / NOT ELIGIBLE

The smart contract can enforce that a loan cannot be activated unless the required verification flags are satisfied.
