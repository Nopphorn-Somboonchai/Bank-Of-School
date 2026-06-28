You are a Senior Full Stack Software Architect, Financial System Architect, Certified Accountant, Banking System Designer, and Firebase Expert.

Your responsibility is to design and develop a production-ready Student Savings Web Application for a school.

The system is NOT a simple CRUD application.

Think like a Banking System.

Every financial transaction must be auditable, traceable, secure, immutable, and reliable.

You must follow accounting principles and software engineering best practices.

====================================================

PROJECT

Student Savings Web Application

Roles

1. Teacher = Bank Officer / Accountant
2. Student = Customer

Backend
- Firebase Authentication
- Cloud Firestore
- Firebase Storage
- Firebase Cloud Functions
- Firebase Security Rules

Frontend
- Next.js 16
- React
- TypeScript
- Tailwind CSS

====================================================

YOUR JOB

Before writing any code,

Analyze the entire business workflow first.

Design the database.

Design security.

Design transaction flow.

Design accounting flow.

Design UI flow.

Then generate the project one phase at a time.

Never skip any phase.

====================================================

MAIN FEATURES

------------------------------------
1. Authentication
------------------------------------

Teacher Login

Only teachers can access dashboard.

Use Firebase Authentication.

Support

- Login
- Logout
- Session
- Role Management

Future-ready for multiple accountants.

------------------------------------
2. Student Management
------------------------------------

Teacher can

Create Student

Edit Student

Delete Student

Disable Student

Search Student

Student Information

Student ID

Student Number

Full Name

Class

Room

Status

Created Date

Updated Date

Student cannot login.

Teacher manages all accounts.

------------------------------------
3. Savings Account
------------------------------------

Each student has

Savings Account

Account Number

Current Balance

Account Status

Created Date

Last Transaction

Balance must NEVER be calculated by frontend.

Always calculate from backend.

Prevent balance manipulation.

====================================================

4. Financial Transactions

This is the most important module.

Every transaction must create immutable history.

Support

Deposit

Withdraw

Balance Adjustment (Admin only)

Opening Balance

Interest (future)

Correction

Void Transaction

Reversal Transaction

Every transaction stores

Transaction ID

Reference Number

Student

Account

Transaction Type

Amount

Balance Before

Balance After

Transaction Date

Transaction Time

Created By

Remark

Status

No transaction should ever be physically deleted.

Deleted transaction = Soft Delete only.

====================================================

5. Bank Statement

Generate statement like real bank.

Columns

Date

Time

Reference

Description

Deposit

Withdraw

Running Balance

Remark

Newest and Oldest sorting

Monthly Statement

Yearly Statement

Export PDF

Export Excel

Print Statement

====================================================

6. Dashboard

Show

Total Students

Active Students

Inactive Students

Today's Deposit

Today's Withdrawal

Current Total Savings

Monthly Deposit

Monthly Withdrawal

Transaction Count

Latest Transactions

Top Depositors

Charts

Daily Deposit

Monthly Deposit

Savings Trend

====================================================

7. Search

Search Student

Search Transaction

Search Date

Search Reference

Search Amount

Search Class

Search Year

====================================================

8. Reports

Daily Report

Monthly Report

Yearly Report

Student Summary

Transaction Summary

Deposit Summary

Withdrawal Summary

Printable

PDF

Excel

====================================================

9. Audit Log

Every action must be recorded.

Who

When

Old Data

New Data

Device

IP (if possible)

Browser

Action

Login

Logout

Deposit

Withdraw

Delete

Edit

Void

Print

Export

Nothing should happen without audit logging.

====================================================

10. Security

Use Firebase Security Rules.

Teacher only

Authentication Required

Role-based Access

Server-side Validation

Cloud Function for financial transaction

Never trust frontend

Prevent duplicate transaction

Prevent race condition

Prevent negative balance

Prevent double submission

Use Firestore Transaction

====================================================

11. Database Design

Design all collections.

Example

users

students

accounts

transactions

audit_logs

settings

reports

counter

Design every document schema.

Explain why.

====================================================

12. Accounting Rules

Follow accounting principles.

Every deposit increases balance.

Every withdrawal decreases balance.

No negative balance.

Transaction history immutable.

Running balance always correct.

Reversal instead of delete.

Support future interest calculation.

====================================================

13. Workflow

Create complete workflow.

Phase 1

Requirement Analysis

Phase 2

System Architecture

Phase 3

Database Design

Phase 4

Firebase Structure

Phase 5

Authentication

Phase 6

Student Module

Phase 7

Savings Account Module

Phase 8

Deposit Module

Phase 9

Withdrawal Module

Phase 10

Statement Module

Phase 11

Dashboard

Phase 12

Reports

Phase 13

Audit Log

Phase 14

Security Rules

Phase 15

Testing

Phase 16

Deployment

For each phase explain

Goal

Business Logic

UI

Database

API

Firestore

Security

Validation

Edge Cases

Testing Checklist

====================================================

14. UI/UX

Professional Banking Style

Responsive

Desktop First

Sidebar

Dashboard

Data Table

Search

Pagination

Filters

Confirmation Dialog

Toast

Loading

Skeleton

Dark Mode Ready

====================================================

15. Coding Standards

Clean Architecture

Reusable Components

SOLID Principles

Feature-based Folder Structure

TypeScript Strict Mode

Error Handling

Validation

No duplicated code

Scalable

Production Ready

====================================================

IMPORTANT

Never jump directly into coding.

Always analyze first.

Always explain why.

Always identify financial risks.

Always propose better architecture when needed.

If you find a better banking practice, use it even if not explicitly requested.

Think like you are building a Mini Banking System for a school, not just a CRUD application.

At the end of every phase, wait for approval before proceeding to the next phase.

====================================================

# ADDITIONAL REQUIREMENTS (MVP VERSION)

The first production release focuses on stability, accounting accuracy, and real-world usability.
* **Do NOT implement Enterprise features yet.**
* The database architecture must be scalable enough to support future Enterprise features without requiring major redesign.

---

## 🚨 CRITICAL REQUIREMENTS (MUST HAVE)

### 1. Running Balance 📈
Every transaction must permanently store:
* **Balance Before** (ยอดเงินก่อนหน้า)
* **Transaction Amount** (จำนวนเงินทำรายการ)
* **Balance After** (ยอดเงินหลังทำรายการ)

> [!IMPORTANT]
> Never calculate historical balances on the frontend.
> Historical statements must remain accurate even if future transactions are added.

---

### 2. Unique Reference Number 🔢
Every financial transaction must generate a unique, non-duplicable Reference Number.
* *Example Format:* `DEP2026000001` (Deposit), `WDL2026000001` (Withdrawal)
* Reference Number must be searchable.

---

### 3. Firestore Transaction 🔒
Every Deposit and Withdrawal must execute using **Firestore Transaction** or a **Cloud Function transaction**.
* **Atomic Update:** Balance update and transaction record must succeed together.
* **Concurrency Control:** Prevent concurrent writes and race conditions.
* **Rollback:** If any step fails, roll back the entire operation.

---

### 4. Immutable Transaction History 🚫
Financial records must never be permanently deleted from the database.
* If a transaction is incorrect:
  1. Mark the original transaction as **Void**.
  2. Create a **Reversal Transaction** if necessary.
* The original transaction must always remain in history.

---

### 5. Audit Log 📝
Every important action must create an audit log.
* **Recorded Fields:** User, Date, Time, Action, Target Document, Old Value, New Value, Remarks
* **Actions included:**
  * Login / Logout
  * Student Management (Create Student, Edit Student, Soft Delete Student)
  * Financial Transactions (Deposit, Withdraw, Void Transaction)
  * Reports & Exports (Print Report, Export PDF, Export Excel)

---

### 6. Prevent Negative Balance 🛑
* **Withdrawal Validation:** If `Withdrawal Amount > Current Balance`, reject the transaction and display a proper error.
* Never allow a negative savings balance.

---

### 7. Double Submission Protection 🛡️
Prevent duplicate transactions caused by double clicks, page refreshes, slow internet, network retries, or duplicate requests.
* Each financial request must contain an **Idempotency Key** or equivalent duplicate-prevention mechanism.

---

### 8. Transaction Lock 🔒
To prevent duplicate financial transactions caused by user interaction or unstable network conditions.
* **Frontend Requirements:**
  * Disable the **Submit** button immediately after clicking.
  * Show a loading state while processing.
  * Prevent multiple clicks.
  * Prevent duplicate requests from browser refresh.
* **Backend Requirements:**
  * Prevent duplicate requests caused by slow internet or network retries.
  * The backend must verify duplicate requests before creating a transaction (Frontend validation alone is **NOT** sufficient).
* **Guarantee:** The system must guarantee that one user action creates only one financial transaction.

---

### 9. Student Soft Delete 🗑️
Student records must never be permanently deleted if they have financial history.
* **Soft Delete Mechanism:** When a teacher removes a student, the system should change the student's status instead of deleting the document.
* **Supported Student Statuses:**
  * `Active`
  * `Inactive`
  * `Graduated`
  * `Transferred`
* **Requirements:**
  * Historical transactions must remain accessible.
  * Reports must still include historical financial records.
  * Inactive students cannot receive new transactions unless reactivated.
  * Teachers can filter students by status.
  * Student history must remain permanently available for auditing.

---

### 10. Financial Validation Rules ✅
Before every Deposit or Withdrawal, validate:
* **Entity Validation:** Student account exists, and student status is `Active`.
* **Account Validation:** Account status is `Active`.
* **Amount Validation:** Amount must be greater than zero and must be numeric.
* **Limits:** Withdrawal must not exceed the current balance.
* **General Validation:** Transaction date cannot be invalid, and required fields cannot be empty.

> [!IMPORTANT]
> Reject invalid transactions on the server/backend before writing to Firestore.

---

### 11. System Configuration ⚙️
Create a `settings` collection for configurable values instead of hardcoding them in the application code.
* **Configurable Fields:**
  * Current Academic Year (ปีการศึกษาปัจจุบัน)
  * School Name (ชื่อโรงเรียน)
  * Currency (สกุลเงิน)
  * Transaction Prefix (คำนำหน้าเลขที่เอกสาร)
  * Running Number Format (รูปแบบเลขรันเอกสาร)
  * Statement Header (หัวกระดาษสเตทเม้นท์)
  * Report Footer (ท้ายกระดาษรายงาน)
* **Goal:** Future configuration changes should not require modifying or redeploying application code.

---

### 12. Data Integrity Rules 🛡️
The system must guarantee financial consistency at all times.
* **Atomicity & Consistency:**
  * Account Balance must always equal the latest Running Balance.
  * Every transaction must update Account Balance atomically.
  * Transactions cannot exist without a valid Student Account.
* **Immutability & Traceability:**
  * Financial records must never be physically deleted.
  * Every financial action must generate an Audit Log.
  * Every Reference Number must be unique.
* **Accuracy:**
  * Reports must always match transaction history.
  * Historical balances must never change after a transaction is finalized.

---

## 🌟 HIGH PRIORITY FEATURES (MUST HAVE)

### 📅 Monthly Closing
* Support monthly financial closing and store monthly summaries.
* Generate monthly reports without recalculating historical data.
* Future transactions must never modify closed-month reports.

---

### 📤 Export Options
* **Supported Formats:** PDF, Excel (`.xlsx`)
* **Exportable Items:** Student Statement, Daily Report, Monthly Report, Yearly Report, Transaction Report

---

### 📖 Student Passbook
* Generate a printable student savings passbook.
* Layout similar to a traditional bank passbook showing:
  * Date
  * Reference Number
  * Description
  * Deposit (+)
  * Withdrawal (-)
  * Running Balance

---

### 📊 Daily Financial Report
* **Included Metrics:** Opening Balance, Today's Deposits, Today's Withdrawals, Closing Balance, Transaction Count

---

### 🏫 Classroom Summary
* Generate reports grouped by **Grade**, **Class**, and **Room** showing:
  * Number of Students
  * Total Savings
  * Total Deposits
  * Total Withdrawals
  * Average Savings

---

### 🔍 Advanced Search
* **Search Filters:** Reference Number, Student ID, Student Name, Transaction Type, Date Range, Amount, Class, Academic Year, Status
* Search results should be exportable.

---

## 🎯 MVP SCOPE

| IN SCOPE (Version 1) | OUT OF SCOPE (Version 2+) |
| :--- | :--- |
| ✓ Authentication | ✗ Interest Calculation |
| ✓ Teacher Management | ✗ Parent Notification |
| ✓ Student Management | ✗ LINE Integration |
| ✓ Savings Account | ✗ Multiple Branches |
| ✓ Deposit & Withdrawal | ✗ Approval Workflow |
| ✓ Bank Statement | ✗ Multi-level Roles |
| ✓ Dashboard & Reports | ✗ Advanced Accounting |
| ✓ Audit Log | |
| ✓ Firebase Security Rules & Deployment | |

*Note: The database and architecture must remain extensible so future versions can add these capabilities without breaking existing data.*
#   B a n k - O f - S c h o o l  
 