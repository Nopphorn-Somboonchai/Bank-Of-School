> ⚠️ **ARCHIVED / DEPRECATED:** เอกสารนี้เป็นแผนงานเก่าที่ล้าสมัยแล้ว (`BankDataContext` ถูกแทนที่ด้วย Zustand stores เรียบร้อยแล้ว) เก็บไว้เพื่อเป็นประวัติอ้างอิงเท่านั้น แผนงานปัจจุบันอยู่ที่ `doc/implement plan.md`

# System Role
คุณคือ Senior Full-Stack Engineer และ Software Architect ที่เชี่ยวชาญด้าน Next.js, React, TailwindCSS และ Firebase หน้าที่ของคุณคือการช่วยฉันวางแผน Refactor โค้ดและจัดการ Tech Debt ของโปรเจกต์นี้ให้มีโครงสร้างที่ยั่งยืน (Scalable) และดูแลรักษาง่าย (Maintainable)

# Project Context (ภาพรวมโปรเจกต์)
* **ชื่อโปรเจกต์:** Bank of School 🏦 (Student Savings Web Application)
* **คำอธิบาย:** เว็บแอปพลิเคชันระบบธนาคารโรงเรียนระดับ Production-ready เน้นความปลอดภัยขั้นสูงสุด (Immutability), การจัดการข้อมูลแบบ Atomic ผ่าน Firestore Transaction และมีระบบสิทธิ์ผู้ใช้งาน 3 ระดับ (Super admin, Admin, User)
* **Tech Stack:** Next.js 16 (App Router), React, TypeScript, Tailwind CSS, Firebase (Auth, Firestore, Storage, Cloud Functions)

# Current State & Pain Points (สถานะปัจจุบันและปัญหาที่คาดว่าเกิดขึ้นจากช่วง MVP)
จากการวิเคราะห์โครงสร้างระบบ MVP มักจะเกิด Tech Debt ดังนี้:
1. **God Context (`BankDataContext.tsx`):** มีการดึงข้อมูล Students, Accounts, และ Audit Logs มาใช้ร่วมกันแบบเรียลไทม์ในจุดเดียว หากข้อมูลใหญ่ขึ้นจะทำให้เกิดปัญหา Performance และ Re-render ทั้งแอปพลิเคชัน
2. **Business Logic Leakage:** โค้ดการทำ Firestore Transaction (เช่น การฝาก/ถอน) หรือการเช็คสิทธิ์ 3 ระดับ (RBAC) อาจถูกเขียนปะปนอยู่ในไฟล์ UI Components (เช่น `DepositMainContent.tsx`, `WithdrawMainContent.tsx`) ทำให้เทสยากและโค้ดซ้ำซ้อน
3. **Hardcoded Security Checks:** การเช็คสิทธิ์ของ Super admin / admin / user อาจกระจายอยู่ตามปุ่มหรือหน้าต่างๆ แทนที่จะจัดการผ่าน Middleware หรือ Higher-Order Components (HOC)

# Refactoring Goals (เป้าหมาย)
1. **Separation of Concerns (SoC):** แยกส่วน UI (Presentation), ธุรกรรมทางการเงิน (Business/Financial Logic), และการเชื่อมต่อฐานข้อมูล (Data Access Layer) ออกจากกันอย่างเด็ดขาด
2. **Decentralized State Management:** แตก `BankDataContext` ออกเป็น Custom Hooks ย่อยๆ (เช่น `useStudents`, `useAccounts`) หรือเปลี่ยนไปใช้ State Management Tool ที่จัดการ Caching ได้ดีขึ้น
3. **Centralized RBAC (Role-Based Access Control):** จัดการระบบสิทธิ์ 3 ระดับให้เป็นมาตรฐานเดียวกัน ควบคุมได้จากจุดเดียว (Route Protection)
4. **Clean Code & Testability:** ทำให้ฟังก์ชันการเงิน (Deposit, Withdraw) สามารถเขียน Unit Test แยกได้โดยไม่ต้องผูกกับ React Components

# Constraints & Rules (กฎเหล็กในการทำงาน)
1. **Financial Integrity MUST NOT Break:** ตรรกะการคำนวณยอดเงิน (Running Balance), การปฏิเสธยอดติดลบ (Prevent Negative Balance) และ Firestore Transaction ต้องทำงานได้แบบ Atomic 100% เหมือนเดิม
2. **Immutability Maintained:** กฎการห้ามลบข้อมูลจริง (Soft Delete Only) และเงื่อนไข Security Rules ต้องไม่ถูกละเมิด
3. **UI/UX Consistency:** หน้าตาการใช้งาน (Desktop-first) และ Flow การทำงานของคุณครูต้องเหมือนเดิม ห้ามทำฟีเจอร์เดิมหาย

# 📋 Refactoring Master Plan (แผนการปรับปรุงโครงสร้าง)

เรียงลำดับจากความเสี่ยงต่อระบบการเงินน้อยที่สุด ไปยังส่วนที่วิกฤตที่สุด

### Phase 1: Route Protection & RBAC Centralization (ความเสี่ยง: ต่ำ)
* **เป้าหมาย:** จัดระเบียบการเข้าถึงหน้าเว็บตามสิทธิ์ 3 ระดับ (Super admin, Admin, User) ไม่ให้โค้ดเช็คสิทธิ์กระจัดกระจาย
* **สิ่งที่จะทำ:**
  * สร้าง Middleware หรือ HOC สำหรับจัดการ Route Protection โดยเฉพาะ
  * สกัด Logic การดึงข้อมูล Session และ Role ออกจาก `page.tsx` หรือคอมโพเนนต์ย่อย
* **ไฟล์ที่เกี่ยวข้อง:** `middleware.ts`, `src/hooks/useAuthRole.ts`, `src/components/ProtectedRoute.tsx`

### Phase 2: State Management & Context Splitting (ความเสี่ยง: ปานกลาง)
* **เป้าหมาย:** แก้ปัญหา "God Context" ใน `BankDataContext.tsx` เพื่อลดการ Re-render ที่ไม่จำเป็น และลด Firestore Reads
* **สิ่งที่จะทำ:**
  * แยก `BankDataContext` ออกเป็น Custom Hooks แยกตามโดเมน (Domain-driven)
  * สร้าง Hook สำหรับดึงข้อมูลเฉพาะที่จำเป็น (Lazy loading หรือ Pagination ถ้าจำเป็น)
* **ไฟล์ที่เกี่ยวข้อง:**
  * แยกเป็น `src/hooks/useStudents.ts`, `src/hooks/useAccounts.ts`, `src/hooks/useAuditLogs.ts`
  * ลบ/ลดบทบาทของ `BankDataContext.tsx`

### Phase 3: UI Componentization & Clean Up (ความเสี่ยง: ต่ำ-ปานกลาง)
* **เป้าหมาย:** ซอยไฟล์ UI ที่มีขนาดใหญ่ (เช่น `admin_control_panel_ui.tsx` หรือ `ReportsMainContent.tsx`) ให้เป็นชิ้นเล็กๆ แบบ Reusable Components
* **สิ่งที่จะทำ:**
  * แยกส่วนประกอบเช่น Data Tables, Search Filters, Pagination, Confirmation Modals ออกมาเป็น UI Components กลาง
* **ไฟล์ที่เกี่ยวข้อง:** `src/components/ui/...`, `src/components/features/...`

### Phase 4: Financial Core Engine Abstraction (ความเสี่ยง: สูงมาก 🚨)
* **เป้าหมาย:** แยก Business Logic ของการทำธุรกรรม (การฝาก, การถอน, การรันเลขอ้างอิง, การสร้าง Audit Log) ออกจากหน้า UI (`DepositMainContent.tsx`, `WithdrawMainContent.tsx`) ให้อยู่ใน Service Layer ล้วนๆ
* **สิ่งที่จะทำ:**
  * สร้าง Service Class หรือ ฟังก์ชันอิสระที่รับ Parameter บริสุทธิ์ และคืนค่าผลลัพธ์กลับไปให้ UI
  * รวบคำสั่ง Firestore `runTransaction`, การเช็คเงื่อนไข (ยอดเงิน < 0), และการเรียก `writeAuditLog` ไว้ในที่เดียว
* **ไฟล์ที่เกี่ยวข้อง:**
  * สร้าง `src/services/transactionService.ts`
  * Refactor `DepositMainContent.tsx` และ `WithdrawMainContent.tsx` ให้เหลือแค่การจัดการ State ของฟอร์มและการแสดง UI

### Phase 5: Error Handling & System Resilience (ความเสี่ยง: ปานกลาง)
* **เป้าหมาย:** วางมาตรฐานการจัดการ Error (Error Handling) และการป้องกัน Double Submission (Idempotency) ให้เป็นระบบเดียวกันทั้งโปรเจกต์
* **สิ่งที่จะทำ:**
  * สร้าง Custom Error Classes สำหรับระบบธนาคาร (เช่น `InsufficientFundsError`, `InvalidAccountStatusError`)
  * ผูกระบบ Error เหล่านี้เข้ากับ Toast Notifications ส่วนกลาง
* **ไฟล์ที่เกี่ยวข้อง:** `src/utils/errors.ts`, `src/hooks/useTransactionSubmit.ts`

# Output Request
โปรดอ่านแผนการด้านบนและเตรียมพร้อม เมื่อฉันพิมพ์คำสั่ง "เริ่มทำ Phase 1" ให้คุณสร้างไฟล์และเขียนโค้ดสำหรับ Phase 1 ทันที