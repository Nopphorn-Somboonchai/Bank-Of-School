# Implement Plan — Bank of School: Security, Financial Integrity & Tech Debt

> เอกสารนี้คือ **single source of truth** ของงานแก้ไข สร้างจากผล code review (2026-10-06)
> AI ตัวใดก็ตามที่รับช่วงต่อ: อ่านหัวข้อ 0–2 + Progress Log + เฟสที่ยังไม่เสร็จเท่านั้น (ไม่ต้องอ่านทั้งโปรเจกต์)

---

## 0. Handoff Protocol (อ่านก่อนเสมอ)

1. เปิด **Progress Log** (ท้ายไฟล์) → หา task `[ ]` ตัวแรกที่ว่างตามลำดับ → ทำต่อจากนั้น
2. ทำเสร็จทีละ task → ติ๊ก `[x]` + เพิ่มบรรทัดใน Progress Log (ไฟล์ที่แก้, ข้อสังเกต, สิ่งที่ค้าง) **ทันที** ก่อนเริ่ม task ถัดไป (กัน token หมดกลางคัน)
3. จบแต่ละเฟส: รัน Verification ของเฟส → `git commit` (1 เฟส = 1 commit, ข้อความ `phaseN: ...`)
4. ถ้าเจอสิ่งที่ plan ไม่ครอบคลุม/ขัดกับโค้ดจริง → บันทึกใน "Open Decisions" แล้วถามผู้ใช้ อย่าเดา
5. ห้ามข้ามเฟส เฟสเรียงตามความเสี่ยง (P1 → P5)

### Token-saving rules
- ใช้ `grep_search` หาตำแหน่ง แล้ว `view_file` เฉพาะช่วงบรรทัดที่ต้องแก้ (ห้ามอ่านไฟล์ใหญ่ทั้งไฟล์: `SettingsMainContent`, `LogsMainContent`, `test_runner_ui`, `StudentLedgerView`)
- ใช้ `multi_replace_file_content` แก้หลายจุดในไฟล์เดียวครั้งเดียว
- ไม่ต้องสรุปซ้ำ/ไม่ต้องสร้าง artifact เพิ่ม — อัปเดตแค่ Progress Log
- ไฟล์ `README-1.md`, `Refactoring Master Plan.md`, `tech debt-implementation_plan.md` เป็นเอกสารเก่า **ไม่ต้องอ่าน**

### Hard rules (Guardrails)
- `AGENTS.md`: Next.js เวอร์ชันนี้ต่างจากที่รู้ ก่อนแตะโค้ดที่เป็น Next-specific (route, layout, config) ให้อ่าน `node_modules/next/dist/docs/` ที่เกี่ยวข้อง
- **ห้ามเปลี่ยน schema/ชนิดข้อมูลใน Firestore** (เช่น `createdAt` ต้องยังเป็น ISO string, `currentBalance` ยังเป็น number บาท) — มีข้อมูลจริงอยู่
- ห้ามลบข้อมูลจริง (Soft Delete only), Financial Integrity ต้อง atomic 100% และห้าม UI/flow เปลี่ยน
- ทุก path ของ Firestore ต้องผ่าน `src/utils/dbPaths.ts`
- **Anti tech-debt:** ห้ามเพิ่ม `any` ใหม่, ห้าม copy-paste logic (ดึงเป็น helper), ห้ามเพิ่มไฟล์ที่ไม่ถูกใช้, ลบโค้ดที่ตายเมื่อแทนที่ด้วยของใหม่, คอมเมนต์เดิมที่ไม่เกี่ยวข้องห้ามลบ
- แก้ `firestore.rules` แล้วต้องมี test ใน emulator (P5) ก่อน deploy — **ห้าม deploy rules เอง** ให้แจ้งผู้ใช้

---

## 1. Context Snapshot (ไม่ต้องสำรวจซ้ำ)

| หัวข้อ | ข้อเท็จจริง |
|---|---|
| Stack | Next.js 16.2.9 (App Router, webpack dev), React 19, TS, Tailwind 4, Firebase 12, zustand 5 |
| Entry | `app/page.tsx` (client; `AuthProvider` → `AppContent` → tab components) |
| Service ฝาก/ถอน | `src/services/transactionService.ts` → `performDeposit`, `performWithdrawal` (runTransaction; ซ้ำกัน ~85%) |
| Auth/Role | `src/context/AuthContext.tsx` (session `any`, migrate placeholder `STAFF_*` ด้วย email), `src/hooks/useAuthRole.ts` (เช็ค role ด้วย `includes`), `src/components/ProtectedRoute.tsx` |
| Rules | `firestore.rules` (multi-tenant `artifacts/{appId}/...`) |
| Student CRUD | `src/components/StudentsMainContent.tsx` (create = 3 await แยก, ~L95-150; edit/delete เรียก `recalculateDashboardSummary`) |
| Summary | `src/utils/bankUtils.ts` → `recalculateDashboardSummary` (scan ทั้ง collection) |
| Submit lock | `src/hooks/useTransactionSubmit.ts` (ใช้ `useState`) |
| Stores | `src/store/{student,account,notification}Store.ts` (zustand; `BankDataContext` ถูกลบแล้ว) |
| Test | ไม่มี unit test; มีแค่ `app/test_runner_ui.tsx` (เขียนลง Firestore จริง) |
| Env | `npx`/node อาจไม่อยู่ใน PATH ของ shell → ถ้า `npm run lint` ไม่ได้ ให้แจ้งผู้ใช้ อย่าข้าม verification เงียบๆ |

---

## 2. Open Decisions (ต้องถามผู้ใช้ถ้า AI ยังไม่เห็นคำตอบ)

- [ ] **D1 (P1):** วิธีกัน privilege escalation ตอนสร้าง user doc — แนะนำ **Option A**: placeholder ใช้ docId แบบ deterministic (`STAFF_<email ตัวพิมพ์เล็ก>`) เพื่อให้ rules `get()` ตรวจ role ได้ และ self-create ต้อง role ตรงกับ placeholder + `email_verified == true`; Super Admin คนแรกสร้างผ่าน Firebase Console. (Option B: Cloud Function — ต้อง Blaze plan)
- [ ] **D2 (P3):** นักเรียนที่ถูก Soft Delete และยังมียอดคงเหลือ — ให้หักยอดออกจาก `totalSavings` (สอดคล้องพฤติกรรม recalc เดิม) แล้วบวกกลับเมื่อกู้คืน? (ค่าเริ่มต้นที่แนะนำ: ใช่)
- [ ] **D3 (P5):** ฟีเจอร์ **Void** (ยกเลิกรายการ) — เลื่อนไป backlog (ค่าเริ่มต้น) หรือทำตอนนี้ (ต้องทำ reversal transaction + แก้ rules)

---

## Phase 1 — Security: Rules & Auth (🔴 ทำก่อนสุด)

**เป้าหมาย:** ปิดช่องยกระดับสิทธิ์ และผูกสิทธิ์กับอีเมลที่ยืนยันแล้ว

- [ ] **1.1** `firestore.rules` → `users/{userId}` `create`: Admin สร้างได้; self-create ต้อง `request.auth.token.email_verified == true`, email ตรง และ `role`/`status` ต้องตรงกับ placeholder (ตาม D1) หรือเป็น role ต่ำสุด (`Teacher`, `Active`) เท่านั้น
- [ ] **1.2** `firestore.rules` → ปรับ `delete` ของ users ให้ลบได้เฉพาะ placeholder ของตัวเอง (`STAFF_*` + email ตรง) หรือ Admin
- [ ] **1.3** `AuthContext.tsx` (L38-82) + `LoginView.tsx` (L~91) → เช็ค `user.emailVerified` ก่อน migrate/สร้าง user doc; ถ้ายังไม่ยืนยัน → toast + `signOut`
- [ ] **1.4** `SettingsMainContent.tsx` (สร้าง placeholder staff ~L218) → ใช้ docId ตามที่ตัดสินใจใน D1; ห้ามแก้ UI อื่น
- [ ] **1.5** `firestore.rules` → `dashboard_summary`: จำกัด field ที่เขียนได้ (ไม่ให้ teacher ตั้ง `totalSavings` ตรงๆ ได้ตามอำเภอใจ ถ้าทำได้โดยไม่ทำให้ transaction ฝาก/ถอนพัง) — ถ้าทำไม่ได้ให้บันทึกเป็น risk ที่ยอมรับใน Progress Log

**Verification:** อ่านทวน rules เทียบเคสโจมตี (self-create เป็น Super Admin / อีเมลไม่ยืนยัน) → ต้องถูก deny; tsc/lint ผ่าน

---

## Phase 2 — Financial Core (🔴)

**เป้าหมาย:** `transactionService` ปลอดภัยและไม่ซ้ำซ้อน โดย **พฤติกรรมเงินเหมือนเดิม 100%**

- [ ] **2.1** `src/utils/money.ts` (ไฟล์ใหม่): `normalizeAmount(n)` → ตรวจ `Number.isFinite`, `> 0`, ปัดทศนิยม 2 ตำแหน่ง (`Math.round(n*100)/100`), throw `BankError` subclass ใหม่ `InvalidAmountError` (เพิ่มใน `src/utils/errors.ts`); ใช้ `roundMoney` กับ balanceAfter/totalSavings/daily stats
- [ ] **2.2** `transactionService.ts` → ดึง logic ร่วม (counter, dashboard summary/dailyStats, สร้าง tx doc, audit) เป็น `executeLedgerEntry({ type: 'Deposit' | 'Withdrawal', ... })` ภายในไฟล์; `performDeposit/performWithdrawal` เป็น wrapper บาง (signature ภายนอกเดิมห้ามเปลี่ยน → ไม่ต้องแก้ UI)
- [ ] **2.3** เช็คสถานะนักเรียนใน transaction เดียวกัน: อ่าน `students/{id}` → ถ้า `deletedAt != null` หรือ status ไม่ใช่ Active → throw `InvalidAccountStatusError`
- [ ] **2.4** ปีใน reference number ใช้ปีตามเวลา `Asia/Bangkok` (เพิ่ม `getLocalYear()` ใน `bankUtils.ts` แล้วใช้แทน `new Date().getFullYear()`)
- [ ] **2.5** `useTransactionSubmit.ts` → ใช้ `useRef` เป็น lock จริง (เก็บ `submitting` state ไว้สำหรับ UI); type `'warning'` ให้ครอบคลุมใน toast (ดู P4.3)
- [ ] **2.6** แทนที่ `catch (err: any)` ใน hook ด้วย `unknown` + type guard

**Verification:** diff ของ `balanceBefore/After`, `referenceNumber` format (`DEP{ปี}{6 หลัก}`/`WDL…`), audit log shape ต้องเหมือนเดิม; ถอนเกินยอด → `InsufficientFundsError`; tsc/lint ผ่าน

---

## Phase 3 — Student Atomicity & Dashboard Summary (🟠)

**เป้าหมาย:** เลิก scan ทั้ง collection และเลิกเขียนหลายขั้นตอนแบบไม่ atomic

- [ ] **3.1** `src/services/studentService.ts` (ไฟล์ใหม่): `createStudent` ใช้ `runTransaction` → เช็ค duplicate จาก DB จริง, เขียน student + account + `totalStudents +1` + audit log รวมใน transaction เดียว
- [ ] **3.2** `studentService.ts`: `updateStudent` / `softDeleteStudent` / `restoreStudent` → transaction ที่อัปเดต `totalStudents` และ `totalSavings` แบบ delta (ตาม D2) + audit log; ไม่เรียก `recalculateDashboardSummary`
- [ ] **3.3** `StudentsMainContent.tsx` → เปลี่ยน handler (L~90-230) ให้เรียก service แทนเขียน Firestore ตรง; UI/ข้อความ toast เหมือนเดิม; ลบ import ที่ไม่ใช้ (`setDoc`, `updateDoc`, `increment`, …)
- [ ] **3.4** `recalculateDashboardSummary` → คงไว้เป็นเครื่องมือ "ซ่อมสรุปยอด" สำหรับ Admin เท่านั้น (ย้ายจุดเรียกไปปุ่มใน Settings ถ้ายังไม่มี; ถ้ามีอยู่แล้วให้คงไว้) + ใส่คอมเมนต์ว่าแพง/ไม่ใช้ใน flow ปกติ และ guard ด้วย role Admin

**Verification:** สร้างนักเรียน → มี student+account+summary+audit ครบ หรือไม่มีเลย (ทดสอบ throw กลางทาง); ลบ/กู้คืนนักเรียนที่มียอด → `totalSavings` ตรงกับผล recalc เดิม; tsc/lint ผ่าน

---

## Phase 4 — Types, RBAC & Small UI Bugs (🟡)

**เป้าหมาย:** ลบ `any` ในแกนหลัก, role มี source เดียว, แก้บั๊ก UI เล็กๆ

- [ ] **4.1** `src/types/index.ts` → เพิ่ม `Role = 'Super Admin' | 'Admin' | 'Teacher'` และ `UserSession` interface; `AuthContext`/`useAuthRole`/components ที่รับ `userSession: any` → ใช้ type ใหม่ (ใช้ grep `userSession: any` / `userSession?: any`)
- [ ] **4.2** `useAuthRole.ts` → เปลี่ยน `includes` เป็นการ normalize role ครั้งเดียว (map ค่าเก่าภาษาไทย/สตริงเดิม → `Role`) แล้วเทียบแบบตรงตัว; `AuthContext` fallback role ใช้ `'Teacher'` (ตรงกับ rules)
- [ ] **4.3** `app/page.tsx` → ย้าย `ToastContainer` ออกมาเป็นคอมโพเนนต์ระดับ module (รับ `toasts` เป็น prop) → ลบ prop `toasts`/`ToastContainer` ที่ส่งเข้า `AppContent` แบบเดิม; รองรับ type `'warning'` (สีเหลือง); แก้ class พิมพ์ผิด `emerald-505`→`emerald-500`, `rose-450`→`rose-400`, `duration-305`→`duration-300`; ลบ `any[]` ของ toast (สร้าง `Toast` type)
- [ ] **4.4** กวาด `catch (err: any)` → `unknown` เฉพาะไฟล์ที่แตะในเฟส 2-3 (ไม่ต้องไล่ทั้งโปรเจกต์)

**Verification:** tsc/lint ผ่าน; ทดสอบ route settings ด้วย user ที่ไม่ใช่ Admin ยังถูกกัน; toast แสดงครบ 3 แบบ

---

## Phase 5 — Tests, Cleanup & Docs (🟡)

**เป้าหมาย:** มีเกราะป้องกัน regression และลบความรก

- [ ] **5.1** ติดตั้ง `vitest` (devDependency) + script `"test"`; unit test สำหรับฟังก์ชัน pure: `money.ts`, `getLocalDateString/getLocalYear`, role normalization, daily-stats trimming (ถ้าดึงเป็น pure function ใน P2.2 แล้ว)
- [ ] **5.2** `@firebase/rules-unit-testing` + Firestore emulator (`firebase.json` มี config อยู่แล้ว): เทสต์ rules ของเคส P1 (escalation, email ไม่ยืนยัน, balance ติดลบ, ห้ามลบ/แก้ transaction)
- [ ] **5.3** `app/test_runner_ui.tsx` → ให้รันได้เฉพาะเมื่อ `NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true'` (ไม่เขียนข้อมูลทดสอบลง Firestore จริง) + แสดงข้อความเตือนถ้าไม่ใช่ emulator
- [ ] **5.4** Cleanup: ลบ/ย้าย `firestore-debug.log`, โฟลเดอร์ `bank-of-school/` (มีแค่ `.next`), `scratch/` (ตรวจก่อนว่าไม่มีของสำคัญ), เพิ่ม `firestore-debug.log` เข้า `.gitignore`; เอกสารแผนเก่า 2 ไฟล์ → ย้ายไป `docs/archive/` พร้อมหมายเหตุว่าล้าสมัย (`BankDataContext` ถูกแทนด้วย zustand)
- [ ] **5.5** เขียน `README.md` ใหม่ (สั้น: setup, env vars, emulator, scripts, โครงสร้าง `src/`, สิทธิ์ 3 ระดับ, กฎ immutability)
- [ ] **5.6** Void (ตาม D3): ค่าเริ่มต้น = เพิ่มหัวข้อ Backlog ใน README ว่ายังไม่ implement และ type/UI ที่รองรับ `Void` เป็นของเตรียมไว้

**Verification:** `npm test` ผ่าน, `npm run lint` + `tsc --noEmit` ผ่าน, `npm run build` ผ่าน

---

## Definition of Done (ทั้งโปรเจกต์)

- [ ] ทุกเฟสติ๊กครบ + commit ครบ 5 เฟส
- [ ] ไม่มี `any` ใหม่; จำนวน `any` ในไฟล์ที่แตะลดลง
- [ ] `lint`, `tsc`, `test`, `build` ผ่าน
- [ ] ผู้ใช้ได้รับสรุปสิ่งที่ต้อง deploy เอง (`firebase deploy --only firestore:rules`) และ Super Admin bootstrap ถ้ามี

---

## Progress Log (อัปเดตทุก task)

| วันที่ | Task | สถานะ | ไฟล์ที่แก้ | หมายเหตุ/สิ่งที่ค้าง |
|---|---|---|---|---|
| 2026-10-06 | — | แผนถูกสร้าง | `implement plan.md` | ยังไม่เริ่ม; D1–D3 รอคำตอบ |
