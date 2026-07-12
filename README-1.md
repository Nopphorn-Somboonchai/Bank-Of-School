# Bank of School 🏦
### Student Savings Web Application

A production-ready, secure, and auditable student savings web application designed for school environments. Built with a banking mindset, prioritizing immutability, data consistency, and strict transaction controls.

---

## 🛠️ Project Overview

### 👥 Roles & Actor Model
* **ระบบมีผู้ใช้งานฝั่งเจ้าหน้าที่ 3 ระดับ ลำดับความสำคัญและการเข้าถึงสิทธิ์อย่างเคร่งครัดดังนี้:**
  1. **Super admin (ผู้ดูแลสูงสุด):** มีสิทธิ์สูงสุดในการควบคุมระบบทั้งหมด สามารถจัดการสิทธิ์และสร้างบัญชีผู้ใช้งานได้ทุกระดับ (Super admin / admin / user), ตรวจสอบและจัดการ Audit Logs ได้ทุกประเภท, แก้ไขการตั้งค่าระบบส่วนกลาง (Global Settings) และข้อมูลทางการเงินทั้งหมด
  2. **admin (ครูผู้ดูแลระบบ):** มีสิทธิ์จัดการสิทธิ์และบัญชีผู้ใช้ในระดับครู (user) ลงไปได้, จัดการข้อมูลนักเรียนและบัญชีเงินฝาก, ตรวจสอบ Audit Logs, และแก้ไขการตั้งค่าทั่วไปของระบบ
  3. **user (ครูผู้ใช้):** มีสิทธิ์ทำรายการฝาก-ถอนเงินให้นักเรียน, เรียกดู Statement, และเข้าดูรายงานทั่วไปได้เท่านั้น **ไม่มีสิทธิ์** เข้าถึงหรือทำรายการในหน้าควบคุมระบบ (Admin Control Panel) หรือกำหนดสิทธิ์การใช้งานของผู้ใช้งานอื่น
* **🎓 Student (Customer):** นักเรียนเป็นเพียงผู้รับบริการ (ลูกค้า) **ไม่สามารถ** เข้าสู่ระบบได้ บัญชีทั้งหมดของนักเรียนจะได้รับการจัดการโดยผู้ใช้งานระบบฝั่งเจ้าหน้าที่ (Super admin, admin, user)

### 💻 Technology Stack
| Layer | Technologies |
| :--- | :--- |
| **Frontend** | Next.js 16 (App Router), React, TypeScript, Tailwind CSS |
| **Backend** | Firebase Authentication, Cloud Firestore, Firebase Storage, Firebase Cloud Functions |
| **Security** | Firebase Security Rules, Server-side validation via Cloud Functions |

---

## 📌 Main Features

### 1. Authentication
* **Teacher Login:** Only teachers can access the administration dashboard.
* **Security:** Powered by Firebase Authentication.
* **Features:** Secure login, logout, session tracking, and role management.
* **Extensibility:** Future-ready for multiple accountants.

### 2. Student Management
* **Teacher Capabilities:** Create Student, Edit Student, Soft Delete Student, Disable Student, Search Student.
* **Student Profile Fields:**
  * Student ID
  * Student Number
  * Full Name
  * Class / Room
  * Status (Active / Inactive / Graduated / Transferred)
  * Created & Updated Timestamps

### 3. Savings Account Ledger
* Each student has a corresponding savings account with:
  * Account Number
  * Current Balance
  * Account Status
  * Created Date
  * Last Transaction Timestamp
* > [!IMPORTANT]
  * **Balance calculation rule:** Balance must **never** be calculated or modified by the frontend. It is calculated and verified securely from the backend to prevent balance manipulation.

### 4. Financial Transactions
* Every transaction creates a permanent ledger record:
  * Transaction ID & Unique Reference Number
  * Student & Account Association
  * Transaction Type (Deposit, Withdrawal, Balance Adjustment - Admin Only, Opening Balance, Correction, Void Transaction, Reversal Transaction)
  * Amount, Balance Before, Balance After
  * Transaction Date & Time
  * Created By (Teacher ID)
  * Remark & Status
* **Immutability:** No transaction record is ever physically deleted. Deletion is soft-delete only.

### 5. Bank Statement
* Generate statements resembling standard bank statements.
* **Columns:** Date, Time, Reference, Description, Deposit (+), Withdraw (-), Running Balance, Remark.
* **Features:** Newest/Oldest sorting, Monthly/Yearly statement filters, Print Statement, and export functions.

### 6. Dashboard Metrics
* **General Statistics:** Total Students (Active/Inactive), Today's/Monthly Deposits and Withdrawals, Current Total Savings, Transaction Count, Top Depositors.
* **Charts:** Daily Deposits, Monthly Trends, and Savings Trends.

### 7. Search & Filtering
* Multi-criteria search by: Reference Number, Student ID, Student Name, Transaction Type, Date Range, Amount, Class, Academic Year, and Status.

### 8. Audit Log
* Every important action is logged for accountability.
* **Logged Actions:** Login, Logout, Create/Edit/Delete (Soft Delete) Student, Deposit, Withdraw, Void Transaction, Print Report, Export PDF, Export Excel.
* **Audit Metadata:** User ID, Timestamp, Action Type, Target Document, Old Value, New Value, Remarks, Device, Browser Agent, and IP (if available).

### 9. Security & Access Control
* Protected using Firebase Security Rules.
* Requires user authentication and teacher role-based access.
* Implements server-side validation using Cloud Functions for financial transactions.
* Uses Firestore Transactions to prevent race conditions and double submissions.

---

## 🚨 CRITICAL REQUIREMENTS (MVP VERSION)

The first production release focuses entirely on stability, accounting accuracy, and real-world usability.
> [!WARNING]
> Do NOT implement Enterprise features yet. However, the database architecture must be scalable enough to support future Enterprise features without requiring major database redesign.

### 1. Running Balance 📈
Every transaction must permanently store:
* **Balance Before** (ยอดเงินก่อนหน้า)
* **Transaction Amount** (จำนวนเงินทำรายการ)
* **Balance After** (ยอดเงินหลังทำรายการ)
* *Never calculate historical balances dynamically on the frontend. Historical statements must remain accurate even if future transactions are added.*

### 2. Unique Reference Number 🔢
Every financial transaction must generate a unique, non-duplicable Reference Number.
* *Example Formats:* `DEP2026000001` (Deposit), `WDL2026000001` (Withdrawal).
* Reference Numbers must be searchable.

### 3. Firestore Transaction 🔒
All Deposit and Withdrawal actions must execute within a **Firestore Transaction** or **Cloud Function transaction** to guarantee:
* **Atomic Updates:** Account balance update and ledger creation must succeed together.
* **Concurrency Protection:** Prevent concurrent writes and race conditions.
* **Rollbacks:** Any failure triggers an immediate rollback of all modified documents.

### 4. Immutable Transaction History 🚫
Financial records must never be permanently deleted from the database.
* If a transaction is incorrect:
  1. Mark the original transaction as **Void**.
  2. Create a **Reversal Transaction** to offset the balance.
* The original transaction record remains in history for auditing.

### 5. Prevent Negative Balance 🛑
* **Validation Rule:** If `Withdrawal Amount > Current Balance`, reject the transaction and display a user-friendly error message.
* A savings balance must never fall below zero.

### 6. Double Submission & Lock Protection 🛡️
* **Frontend:** Disable the submit button immediately upon click, display a loading spinner, and prevent multiple clicks or refresh-based re-submissions.
* **Backend:** Validate requests using an **Idempotency Key** or equivalent duplicate-prevention mechanism. Frontend validation alone is **NOT** sufficient.

### 7. Student Soft Delete 🗑️
* Students with financial history cannot be permanently deleted.
* When a teacher removes a student, the system changes their status to `Inactive`, `Graduated`, or `Transferred`.
* Inactive students cannot receive new transactions, but their history must remain accessible in reports.

### 8. Financial Validation Rules ✅
Before executing any transaction, validate:
1. Student profile exists and status is `Active`.
2. Savings account status is `Active`.
3. Amount is a positive number (`Amount > 0`) and is numeric.
4. Withdrawal amount does not exceed the current balance.
5. Transaction date and required fields are valid and not empty.
* *Reject invalid transactions on the server/backend before writing to Firestore.*

### 9. System Configuration ⚙️
Create a `settings` collection to store configurable values:
* Current Academic Year, School Name, Currency, Transaction Prefix, Running Number Format, Statement Header, Report Footer.
* Modifying settings must not require changes to the application code.

### 10. Data Integrity Rules 🛡️
* Account Balance must always equal the latest Running Balance.
* Every transaction must update Account Balance atomically.
* Transactions cannot exist without a valid Student Account.
* Financial records must never be physically deleted.
* Every financial action must generate an Audit Log.
* Every Reference Number must be unique.
* Reports must always match transaction history.
* Historical balances must never change after a transaction is finalized.

---

## 🌟 HIGH PRIORITY FEATURES & REPORTS

### 📅 Monthly Closing
* Support monthly financial closing and store monthly summaries.
* Generate monthly reports without recalculating historical data.
* Future transactions must never modify closed-month reports.

### 📊 Reports & Exports
* **Daily Financial Report:** Opening Balance, Today's Deposits, Today's Withdrawals, Closing Balance, Transaction Count.
* **Classroom Summary:** Group reports by Grade, Class, and Room showing: Number of Students, Total Savings, Total/Average Deposits & Withdrawals.
* **Formats:** Print directly from browser, Export to PDF, and Export to Excel (`.xlsx`).
* **Student Passbook:** Traditional bank passbook layout showing Date, Reference, Description, Deposit, Withdrawal, Running Balance.

---

## 🎯 MVP SCOPE MATRIX

| IN SCOPE (Version 1) | OUT OF SCOPE (Version 2+) |
| :--- | :--- |
| ✓ Authentication & 3-Tier Staff Management | ✗ Interest Calculation |
| ✓ Student Management & Savings Account | ✗ Parent Notification (LINE / SMS) |
| ✓ Deposit & Withdrawal | ✗ Multiple Branches |
| ✓ Bank Statement & Passbook | ✗ Approval Workflow |
| ✓ Dashboard, Reports & Advanced Search | ✗ Advanced Accounting |
| ✓ Audit Log, Firebase Security Rules & Multi-level Roles (Super Admin, Admin, User) | |

*Note: The database and architecture must remain extensible so future versions can add these capabilities without breaking existing data.*

---

## 🗄️ Database Design

We design and structure all collections and schemas with scaling in mind:
* `users` - Teachers and administrative credentials.
* `students` - Student demographic data.
* `accounts` - Savings account ledgers.
* `transactions` - Transaction history.
* `audit_logs` - Audit trails.
* `settings` - System configuration settings.
* `reports` - Pre-calculated summaries and closing reports.
* `counter` - To manage unique sequential transaction reference numbers safely.

---

## 🔄 Development Phases (Workflow)

```mermaid
graph TD
    P1[Phase 1: Requirement Analysis] --> P2[Phase 2: System Architecture]
    P2 --> P3[Phase 3: Database Design]
    P3 --> P4[Phase 4: Firebase Structure]
    P4 --> P5[Phase 5: Authentication]
    P5 --> P6[Phase 6: Student Module]
    P6 --> P7[Phase 7: Savings Account Module]
    P7 --> P8[Phase 8: Deposit Module]
    P8 --> P9[Phase 9: Withdrawal Module]
    P9 --> P10[Phase 10: Statement Module]
    P10 --> P11[Phase 11: Dashboard]
    P11 --> P12[Phase 12: Reports]
    P12 --> P13[Phase 13: Audit Log]
    P13 --> P14[Phase 14: Security Rules & Admin Panel]
    P14 --> P15[Phase 15: Testing]
    P15 --> P16[Phase 16: Deployment]
```

For each phase, the design must cover:
1. **Goal:** What are we building in this phase?
2. **Business Logic:** Rules, equations, constraints.
3. **UI/UX:** Responsive layouts, Desktop-first design, confirmation dialogs, loading states, skeleton screens, dark mode.
4. **Database & API:** Document schemas and Cloud Function routes.
5. **Security & Validation:** Firestore rules and server-side checks.
6. **Edge Cases & Testing Checklist:** Unit and integration testing criteria.

### 📋 Phase Deliverables & Scope Details

Below is the detailed list of implementation goals, core logic constraints, and corresponding files for each development phase:

---

### **Phase 1 to 4: Planning, Architecture, Database Design & Firebase Configuration**
* **Goal:** วางรากฐานสถาปัตยกรรมระบบ, การเชื่อมต่อ Firebase, การกำหนดพาธคอลเลกชันที่ปลอดภัยสูง และระบบแชร์ข้อมูลส่วนกลางเพื่อลดการดึงข้อมูลซ้ำซ้อน
* **Key Files:**
  * [firebase.ts](file:///h:/05-Physics/Bank-Of-School/src/config/firebase.ts) - กำหนดค่าเริ่มต้นการเชื่อมต่อ Firebase และการสลับโหมดใช้งาน Local Emulator อัตโนมัติเมื่อรันใน localhost
  * [dbPaths.ts](file:///h:/05-Physics/Bank-Of-School/src/utils/dbPaths.ts) - ฟังก์ชันจัดทำคอลเลกชันพาธแบบ Strict Paths ป้องกันข้อมูลรั่วไหลตาม กฎเหล็กข้อที่ 1 (Public: `artifacts/{appId}/{col}`, Private: `artifacts/{appId}/users/{userId}/{col}`)
  * [index.ts](file:///h:/05-Physics/Bank-Of-School/src/types/index.ts) - ประกาศ TypeScript Type และ Interface ทั้งหมดในระบบ (Student, Account, Transaction, AuditLog, SystemSettings)
  * [BankDataContext.tsx](file:///h:/05-Physics/Bank-Of-School/src/context/BankDataContext.tsx) - ระบบ React Context (`useBankData`) ใช้สร้าง Listener `onSnapshot` เพียงจุดเดียวเพื่อดึงข้อมูล Students, Accounts, และ Audit Logs มาใช้ร่วมกันแบบเรียลไทม์
  * [bankUtils.ts](file:///h:/05-Physics/Bank-Of-School/src/utils/bankUtils.ts) - ฟังก์ชันส่วนกลางสำหรับการบันทึกประวัติปูมระบบ (`writeAuditLog`), การจัดการเวลาประเทศไทย (`getLocalDateString`), และการคำนวณยอดสรุปบอร์ดความคืบหน้าแบบปรมาณู (`recalculateDashboardSummary`)
* **Core Logic & Security Constraints:**
  - กำหนดโครงสร้างข้อมูลตามหลัก Immutability: ข้อมูลประวัติการทำเงินห้ามลบเด็ดขาด (No Physical Deletes)
  - ทุกพาธเข้าถึงเอกสารต้องผ่านฟังก์ชันครอบ `dbPaths.ts` เพื่อป้องกันปัญหาการเข้าถึงเอกสารข้าม App ID
  - การแชร์ข้อมูลต้องทำงานบน Context Provider เพื่อป้องกันปัญหา Firestore Reads ล้นเกินโควตาและการสั่นไหวของ UI

---

### **Phase 5 (Authentication): User login/logout and session management**
* **Goal:** ระบบควบคุมการเข้าสู่ระบบของคุณครูผู้ใช้งาน ตรวจสอบสิทธิ์ สแกนบทบาท และการควบคุมสถานะคงอยู่ของเซสชัน (Session Tracking)
* **Key Files:**
  * [LoginView.tsx](file:///h:/05-Physics/Bank-Of-School/src/components/LoginView.tsx) - หน้าจอกรอกข้อมูลยืนยันตัวตน (Authentication Screen) พร้อมการตรวจสอบรหัสผ่านและแสดงข้อผิดพลาดที่เข้าใจง่าย
  * [page.tsx](file:///h:/05-Physics/Bank-Of-School/app/page.tsx) - ตรวจจับสถานะการเข้าสู่ระบบผ่าน `onAuthStateChanged` และดึงข้อมูลบทบาทจากคอลเลกชัน `users`
* **Core Logic & Security Constraints:**
  - บล็อกไม่ให้บัญชีผู้ใช้งานที่อยู่ในสถานะ `Suspended` (ถูกระงับสิทธิ์) เข้าสู่ระบบ
  - มีกลไกการสืบค้นและแทนที่บัญชี Placeholder (สร้างล่วงหน้าโดยแอดมินด้วย Email) ไปเป็นบัญชีครูจริงหลังล็อกอินด้วย Firebase Auth ครั้งแรก
  - มีระบบตรวจจับการตั้งค่าระบบส่วนกลางแบบ Reactive: เมื่อแอดมินแก้ปีการศึกษาหรือชื่อโรงเรียน ข้อมูลในเซสชันครูทุกคนจะได้รับการอัปเดตทันที

---

### **Phase 6 (Student Module): Student profiles creation, editing, active/inactive/deleted status management**
* **Goal:** ระบบลงทะเบียนและจัดการประวัตินักเรียน (เพิ่มข้อมูล, แก้ไขประวัติ, ค้นหาแบบละเอียด, และการจัดการสถานะ)
* **Key Files:**
  * [StudentsMainContent.tsx](file:///h:/05-Physics/Bank-Of-School/src/components/StudentsMainContent.tsx) - แท็บแสดงสมุดรายชื่อนักเรียน ตารางการกรอง และ CRUD modals
* **Core Logic & Security Constraints:**
  - **Soft Delete Only:** นักเรียนที่มีประวัติทางการเงินแล้วจะไม่สามารถถูกลบออกจากระบบทางกายภาพได้ การลบจะเปลี่ยนค่า `deletedAt` และอัปเดตสถานะเป็น `Inactive` หรืออื่นๆ เพื่อรักษาความถูกต้องของประวัติบัญชีออมทรัพย์
  - ห้ามทำธุรกรรมการเงินใดๆ กับนักเรียนที่มีสถานะไม่พร้อมใช้งาน (`Inactive`, `Graduated`, `Transferred`)
  - ค้นหาข้อมูลแบบยืดหยุ่น: รองรับการกรองตามชั้นเรียน, รหัสนักเรียน, ชื่อเต็ม, และสถานะ

---

### **Phase 7 (Savings Account): Account ledger initiation and balance linking**
* **Goal:** ระบบสมุดบัญชีออมทรัพย์นักเรียน เชื่อมโยงบัญชี 1:1 กับโปรไฟล์นักเรียนเพื่อติดตามยอดคงเหลือ
* **Key Files:**
  * [StudentLedgerView.tsx](file:///h:/05-Physics/Bank-Of-School/src/components/StudentLedgerView.tsx) - หน้าแสดงสรุปข้อมูลบัญชีและรายการเดินบัญชี (Statement / Passbook) รายบุคคล
* **Core Logic & Security Constraints:**
  - บัญชีเงินออมแต่ละบัญชีจะมีเลขที่เฉพาะที่สร้างตามโครงสร้างรันนิ่งและผูกเข้ากับ `studentId`
  - ยอดเงินออมรวม (`currentBalance`) ต้องถูกคำนวณและอัปเดตจากเซิร์ฟเวอร์แบบอะตอมมิกเท่านั้น ห้ามให้แอปฝากเขียนค่าตรงๆ ไปยังฟิลด์ยอดเงินเพื่อป้องกันการดัดแปลงข้อมูล
  - เก็บประวัติเวลาการทำธุรกรรมล่าสุด (`lastTransactionAt`) เพื่อใช้ประโยชน์ในการจัดเรียงและสแกนบัญชีที่ไม่มีความเคลื่อนไหว

---

### **Phase 8 (Deposit Module): Deposit transaction interface, idempotency keys, and Firestore transactions**
* **Goal:** ระบบรับฝากเงินออมทรัพย์ ตรวจรับข้อมูล และบันทึกประวัติการฝากลงสู่บัญชีอย่างปลอดภัยและมีประสิทธิภาพ
* **Key Files:**
  * [DepositMainContent.tsx](file:///h:/05-Physics/Bank-Of-School/src/components/DepositMainContent.tsx) - หน้ากรอกจำนวนเงินฝาก ระบบสร้างเลขอ้างอิง และบัตรคิวพิมพ์ใบเสร็จ
* **Core Logic & Business Rules:**
  - **Firestore Transactions:** ยอดเงินฝากจะถูกสะสมเข้าไปใน `accounts.currentBalance` และสร้างเอกสารบันทึกใน `transactions` พร้อมกันภายในธุรกรรมชุดเดียวเพื่อความเสถียรของข้อมูลทางการเงิน
  - **Sequential Reference Number:** เลขอ้างอิงทุกรายการ (เช่น `DEP2026000001`) จะต้องถูกดึงและบวกเพิ่มแบบประสานผ่านคอลเลกชัน `counter` เพื่อป้องกันรหัสซ้ำซ้อนขณะทำธุรกรรมพร้อมกัน
  - บังคับการส่งค่าฝากที่เป็นตัวเลขจำนวนบวกเท่านั้น (`Amount > 0`)

---

### **Phase 9 (Withdrawal Module): Withdrawal interface, balance limits validation, and atomic writes**
* **Goal:** ระบบจ่ายถอนเงินออมทรัพย์ ตรวจจับข้อผิดพลาดทางการเงิน บล็อกการทำธุรกรรมซ้ำซ้อน และประมวลผลยอดเงินคงเหลือ
* **Key Files:**
  * [WithdrawMainContent.tsx](file:///h:/05-Physics/Bank-Of-School/src/components/WithdrawMainContent.tsx) - หน้าควบคุมการถอนเงิน ระบบเตือนสิทธิ์ และใบเสร็จยืนยันรายการ
* **Core Logic & Business Rules:**
  - **Prevent Negative Balance:** บล็อกธุรกรรมถอนเงินทันทีหากยอดเงินที่ต้องการถอนมากกว่ายอดคงเหลือในบัญชีปัจจุบัน (`Withdrawal Amount > Current Balance`) ยอดบัญชีห้ามติดลบเด็ดขาด
  - **Double Submission Lock:** ระบบปิดการกดปุ่มส่งแบบชั่วคราวทันทีหลังกดครั้งแรก พร้อมแสดง Spinner แสดงการดาวน์โหลดเพื่อป้องกันการบันทึกรายการเบิ้ลสองครั้ง

---

### **Phase 10 (Statement Module): Account statements generation, ledger views, passbook view**
* **Goal:** ระบบสร้างและแสดงรายการเดินบัญชีอย่างเป็นทางการ รองรับระบบพิมพ์และคัดกรองประวัติย้อนหลัง
* **Key Files:**
  * [StudentLedgerView.tsx](file:///h:/05-Physics/Bank-Of-School/src/components/StudentLedgerView.tsx) - แสดงตารางสรุปรายการเรียงตามวันที่ พร้อมระบบคำนวณยอดสะสมไหลเวียน (Running Balance) ย้อนหลังได้อย่างเที่ยงตรง
* **Core Logic & Business Rules:**
  - การพิมพ์ Statement และหน้าสมุดบัญชีเงินฝาก (Passbook) ใช้สไตล์ CSS เฉพาะตัวที่ซ่อน Sidebar เมนูภายนอกและขยายตารางให้แสดงพอดีกับหน้ากระดาษ A4 ในโหมดพิมพ์
  - คัดกรองข้อมูลตามระดับปีการศึกษา ช่วงวันที่ และประเภทธุรกรรมได้สะดวก

---

### **Phase 11 (Dashboard): Main dashboard stats, top depositors list, and metrics visualization**
* **Goal:** หน้ากระดานสรุปผลแสดงสถิติและข้อมูลแนวโน้มทางการเงินภาพรวมของโรงเรียน เพื่อให้ผู้ดูแลรับรู้สุขภาพทางการเงิน
* **Key Files:**
  * [DashboardMainContent.tsx](file:///h:/05-Physics/Bank-Of-School/src/components/DashboardMainContent.tsx) - หน้าแรกแสดงบอร์ดสถิติตัวเลข ยอดเงินออมสะสม กราฟแสดงสถิติ และทำเนียบนักเรียนยอดรักการออม (Top Depositors)
* **Core Logic & Business Rules:**
  - ตัวเลขสรุปข้อมูลสถิติประจำวันจะไม่ถูกดึงมาจาก Firestore ตรงๆ ทุกครั้งที่มีการโหลดหน้าจอ แต่จะดึงมาจากเอกสารตั้งค่าส่วนกลาง `dashboard_summary` ที่อัปเดตแบบเรียลไทม์ผ่านการทำธุรกรรม เพื่อประหยัด Firestore Reads
  - แสดงผลกราฟเส้นแนวโน้มการฝาก-ถอนย้อนหลัง 7 วันเพื่อให้เห็นพฤติกรรมทางการเงิน

---

### **Phase 12 (Reports): Daily reports, closing metrics, and classroom summaries**
* **Goal:** ระบบรายงานสรุปผลทางการเงินสำหรับฝ่ายบัญชีโรงเรียน ประกอบด้วยรายงานธุรกรรมประจำวัน รายงานแยกรายห้องเรียน และระบบส่งออกข้อมูล
* **Key Files:**
  * [ReportsMainContent.tsx](file:///h:/05-Physics/Bank-Of-School/src/components/ReportsMainContent.tsx) - แท็บหลักควบคุมการเลือกดูประเภทรายงาน
  * [DailyReportView.tsx](file:///h:/05-Physics/Bank-Of-School/src/components/DailyReportView.tsx) - แสดงยอดเปิดบัญชี ยอดฝากเข้า ยอดถอนออก และยอดเงินปิดระบบประจำวัน พร้อมฟังก์ชันดาวน์โหลดรายงาน (.csv)
  * [ClassroomSummaryView.tsx](file:///h:/05-Physics/Bank-Of-School/src/components/ClassroomSummaryView.tsx) - รายงานสรุปยอดการออมแยกตามชั้นเรียนและห้องเรียน เพื่อส่งให้ครูประจำชั้นตรวจสอบ
* **Core Logic & Business Rules:**
  - มีรายงาน Daily Financial Report ที่ระบุยอดคงเหลือก่อนหน้าธุรกรรม ยอดออม/ถอนระหว่างวัน และยอดสิ้นสุดวัน
  - รองรับการ Export ข้อมูลธุรกรรมออกมาเป็นรูปแบบ CSV เพื่อให้ฝ่ายการเงินนำไปเปิดใช้งานต่อบน Excel ได้ทันที

---

### **Phase 13 (Audit Log): Audit tracking for database modifications, teacher action logs**
* **Goal:** ระบบบันทึกและตรวจสอบประวัติพฤติกรรมการใช้งานระบบของคุณครูและแอดมิน เพื่อความโปร่งใสและตรวจสอบย้อนหลังได้ 100%
* **Key Files:**
  * [LogsMainContent.tsx](file:///h:/05-Physics/Bank-Of-School/src/components/LogsMainContent.tsx) - แท็บส่องประวัติปูมการใช้งานระบบ (Audit Log Viewer) มาพร้อมตัวกรองตามวัน เวลา ครูผู้ทำ และประเภทกิจกรรม
  * [bankUtils.ts](file:///h:/05-Physics/Bank-Of-School/src/utils/bankUtils.ts) - ฟังก์ชันส่งค่าเขียนปูมระบบเข้าไปยังฐานข้อมูลแบบเบื้องหลัง
* **Core Logic & Security Constraints:**
  - บันทึกรายละเอียดการกระทำที่สำคัญทั้งหมด: ลงชื่อเข้าใช้, ลงชื่อออก, การเพิ่ม/แก้ไขนักเรียน, การทำธุรกรรมฝากถอน และการยกเลิกรายการ (Void)
  - เก็บค่าเปรียบเทียบก่อน-หลังการเปลี่ยนแปลง (`oldValue` และ `newValue`) เพื่อความแม่นยำในการแกะรอยประวัติ
  - **Write-once Rule:** เอกสารในคอลเลกชัน `audit_logs` จะได้รับการป้องกันด้วย Firebase Security Rules ไม่ให้มีผู้ใดแก้ไขหรือลบรายการได้เด็ดขาด

---

### **Phase 14 (Security Rules, Multi-level Roles & Admin Control Panel):**
* **Goal:** กำหนดสิทธิ์การเข้าถึงฐานข้อมูลอย่างรัดกุมผ่านกฎความปลอดภัย แยกสิทธิ์การทำงานครูออกเป็น 3 ระดับ และมีศูนย์ควบคุมการตั้งค่าระบบส่วนกลาง
* **Key Files:**
  * [admin_control_panel_ui.tsx](file:///h:/05-Physics/Bank-Of-School/app/admin_control_panel_ui.tsx) - หน้าจอกลางสำหรับ Super Admin/Admin ในการตั้งค่าสถานศึกษา และจัดการข้อมูลพนักงาน (Staff Management)
  * [SettingsMainContent.tsx](file:///h:/05-Physics/Bank-Of-School/src/components/SettingsMainContent.tsx) - แท็บรวบรวมฟังก์ชันการจัดการบัญชีครู ข้อมูลระบบส่วนกลาง และเครื่องมือตรวจสอบระบบ
  * [firestore.rules](file:///h:/05-Physics/Bank-Of-School/firestore.rules) - รหัสควบคุมสิทธิ์การเขียน/อ่านข้อมูลบน Cloud Firestore ตามระดับชั้นยศอย่างเข้มข้น
* **3-Tier User Hierarchy Constraints (ลำดับสิทธิ์การใช้งานอย่างเคร่งครัด):**
  1. **Super admin (ผู้ดูแลสูงสุด):**
     - มีสิทธิ์เข้าถึงทุกหน้าจอและฟังก์ชันของระบบ รวมถึงหน้าจอควบคุมระบบส่วนกลาง (Global Settings)
     - สามารถสร้าง แก้ไข ระงับสิทธิ์ และกำหนดบทบาทผู้ใช้งานในระบบได้ทุกระดับ (Super admin / admin / user)
     - ตรวจสอบประวัติการใช้งานและ Audit Logs ทั้งหมด
  2. **admin (ครูผู้ดูแลระบบ):**
     - สามารถเข้าถึงหน้าจอตั้งค่าทั่วไปได้
     - จัดการบทบาทและเปิดบัญชีผู้ใช้ได้เฉพาะในระดับครู (user) เท่านั้น
     - จัดการข้อมูลนักเรียน, บัญชีเงินฝาก, และการตรวจสอบความถูกต้องทางการเงินเบื้องต้น
     - ดูประวัติ Audit Logs ได้
  3. **user (ครูผู้ใช้):**
     - จัดการธุรกรรมทางการเงินพื้นฐาน (ฝากเงิน, ถอนเงิน) 
     - เข้าดูข้อมูลนักเรียนเบื้องต้น ออกรายงานธุรกรรม และพิมพ์ Statement/Passbook
     - **ห้ามเข้าถึง** หน้าจอ Admin Control Panel หรือส่วนการตั้งค่าความปลอดภัยและสิทธิ์การใช้งานโดยเด็ดขาด

---

### **Phase 15 (Testing): Verification checklist, E2E testing, error flow validation**
* **Goal:** ระบบตรวจทานความถูกต้องทางการเงินและช่องโหว่ความปลอดภัยก่อนนำระบบไปใช้งานจริงในรูปแบบการรันระบบทดสอบอัตโนมัติ (In-App Automated Testing)
* **Key Files:**
  * [test_runner_ui.tsx](file:///h:/05-Physics/Bank-Of-School/app/test_runner_ui.tsx) - เครื่องมือรันระบบทดสอบคุณลักษณะการเขียนฐานข้อมูล ตรวจเช็ค Race Condition, ตรวจความล้มเหลวของกติกา Security Rules และแสดงผลทดสอบทีละขั้นตอน
* **Core Logic & Verification Checks:**
  - **Security Rules Audit:** จำลองสิทธิ์ล็อกอินที่ไม่ถูกต้องเพื่อพิสูจน์ว่า Firestore จะดีดตัวกลับและบล็อกการแก้ไขปูมหรือธุรกรรม
  - **Financial Concurrency Check:** จำลองคำสั่งฝากเงินแบบพร้อมเพรียงกันสองรายการจากสองยูสเซอร์ เพื่อทดสอบว่ายอดเงินใน Firestore Transaction จะเพิ่มพูนอย่างแม่นยำและไม่เกิดปัญหายอดหาย (Race condition)
  - **Double-submit lock Check:** ตรวจเช็คระบบล็อกหน้าจอปุ่มฝาก-ถอนป้องกันการกดเบิ้ล

---

### **Phase 16 (Deployment): Cloud deployment, production environment setup, and release**
* **Goal:** การตั้งค่าการจัดจำหน่ายแอปพลิเคชัน โหมดออฟไลน์เพื่อความต่อเนื่อง (PWA) และการทำแผนผังไฟล์บริการโฮสต์
* **Key Files:**
  * [firebase.json](file:///h:/05-Physics/Bank-Of-School/firebase.json) - กำหนดเป้าหมายโฮสติ้งและสคริปต์การทำทรานส์เลชันกฎบนฐานข้อมูล
  * [manifest.ts](file:///h:/05-Physics/Bank-Of-School/app/manifest.ts) - กำหนดรายละเอียดสี ไอคอน และหน้าตาเริ่มต้นสำหรับนำเสนอเว็บเพจในรูปแบบ Progressive Web App (PWA)
  * [public/sw.js](file:///h:/05-Physics/Bank-Of-School/public/sw.js) - ไฟล์ Service Worker คอยให้บริการเก็บแคชเนื้อหาคงที่ ช่วยให้หน้าจอยังสามารถเปิดสแตนด์บายได้แม้อินเทอร์เน็ตขาดหาย
  * [package.json](file:///h:/05-Physics/Bank-Of-School/package.json) - กำหนดคำสั่งการคอมไพล์และบิวด์ซอร์สโค้ด (`next build`)

> [!IMPORTANT]
> **At the end of every phase, wait for approval before proceeding to the next phase.**

---

## 🎨 UI/UX & Coding Standards

### UI/UX Guidelines
* Professional Banking Style
* Responsive (Desktop First)
* Elements: Sidebar, Dashboard, Data Tables with Search, Pagination & Filters, Confirmation Dialogs, Toast Notifications, Loading States & Skeleton screens.
* Dark Mode Ready

### Coding Standards
* Clean Architecture & SOLID Principles
* Reusable components with feature-based folder structure
* TypeScript Strict Mode
* Robust Error Handling & Server-Side Validation
* Zero duplicated code, scalable, and production-ready