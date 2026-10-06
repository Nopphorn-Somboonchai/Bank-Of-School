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

- [x] **D1 (P1):** วิธีกัน privilege escalation ตอนสร้าง user doc — **มติผู้ใช้ (2026-10-06):** ยังไม่เปิดบังคับ `email_verified == true` เพราะระบบยังมีครูใช้งานจริงปัจจุบันเพียง 1 ท่าน และยังใช้ Mock Email อยู่ (ป้องกันไม่ให้บล็อกการเข้าสู่ระบบ) โดยเลือก **Option A (ปรับเงื่อนไข)**: placeholder ใช้ docId แบบ deterministic (`STAFF_<email ตัวพิมพ์เล็ก>`) เพื่อให้ rules `get()` ตรวจ role ได้ และ self-create ต้อง role ตรงกับ placeholder หรือเป็น role ต่ำสุด (`Teacher`, `Active`) โดยยังไม่บังคับ `email_verified`
- [x] **D2 (P3):** นักเรียนที่ถูก Soft Delete และยังมียอดคงเหลือ — ให้หักยอดออกจาก `totalSavings` (สอดคล้องพฤติกรรม recalc เดิม) แล้วบวกกลับเมื่อกู้คืน? — **มติผู้ใช้ (2026-10-06):** เลือกหักยอดออกจาก `totalSavings` เมื่อ Soft Delete และบวกกลับเมื่อกู้คืน (ตรงตามพฤติกรรมของ recalculateDashboardSummary เดิม)
- [x] **D3 (P5):** ฟีเจอร์ **Void** (ยกเลิกรายการ) — **มติผู้ใช้ (2026-10-06):** เลือก **เลื่อนไป Backlog** (ตามค่าเริ่มต้นของแผน) — บันทึกลง README.md ว่าเตรียม Type/UI ไว้แล้วและจะเปิดใช้งานในอนาคต

---

## Phase 1 — Security: Rules & Auth (🔴 ทำก่อนสุด)

**เป้าหมาย:** ปิดช่องยกระดับสิทธิ์ และผูกสิทธิ์กับอีเมล/placeholder โดยไม่กระทบผู้ใช้งานปัจจุบัน

> ⚠️ **Note สำคัญจากการตกลงกับผู้ใช้ (User Decision):**
> **ยังไม่เปิดบังคับ `email_verified == true`** สำหรับระบบที่ยังใช้ Mock Email และมีคุณครูใช้งานจริงอยู่ในระบบปัจจุบัน 1 ท่าน เพื่อไม่ให้เกิดผลกระทบต่อการเข้าใช้งาน (ไม่บล็อกใน rules 1.1 และไม่บังคับ signOut ใน 1.3)

- [x] **1.1** `firestore.rules` → `users/{userId}` `create`: Admin สร้างได้; self-create ต้อง email ตรง และ `role`/`status` ต้องตรงกับ placeholder (ตาม D1) หรือเป็น role ต่ำสุด (`Teacher`, `Active`) เท่านั้น *(ยังไม่บังคับ email_verified ตาม Note)*
- [x] **1.2** `firestore.rules` → ปรับ `delete` ของ users ให้ลบได้เฉพาะ placeholder ของตัวเอง (`STAFF_*` + email ตรง) หรือ Admin
- [x] **1.3** `AuthContext.tsx` (L38-82) + `LoginView.tsx` (L~91) → ปรับปรุง logic การ migrate/สร้าง user doc แต่ **ยังไม่ใส่เงื่อนไข signOut หาก email ยังไม่ verified** (ใส่ comment TODO รองรับไว้สำหรับอนาคตเมื่อพร้อมใช้อีเมลจริง)
- [x] **1.4** `SettingsMainContent.tsx` (สร้าง placeholder staff ~L218) → ใช้ docId ตามที่ตัดสินใจใน D1; ห้ามแก้ UI อื่น
- [x] **1.5** `firestore.rules` → `dashboard_summary`: จำกัด field ที่เขียนได้ (ไม่ให้ teacher ตั้ง `totalSavings` ตรงๆ ได้ตามอำเภอใจ ถ้าทำได้โดยไม่ทำให้ transaction ฝาก/ถอนพัง) — ถ้าทำไม่ได้ให้บันทึกเป็น risk ที่ยอมรับใน Progress Log

**Verification:** อ่านทวน rules เทียบเคสโจมตี (self-create เป็น Super Admin) → ต้องถูก deny; tsc/lint ผ่าน

---

## Phase 2 — Financial Core (🔴)

**เป้าหมาย:** `transactionService` ปลอดภัยและไม่ซ้ำซ้อน โดย **พฤติกรรมเงินเหมือนเดิม 100%**

- [x] **2.1** `src/utils/money.ts` (ไฟล์ใหม่): `normalizeAmount(n)` → ตรวจ `Number.isFinite`, `> 0`, ปัดทศนิยม 2 ตำแหน่ง (`Math.round(n*100)/100`), throw `BankError` subclass ใหม่ `InvalidAmountError` (เพิ่มใน `src/utils/errors.ts`); ใช้ `roundMoney` กับ balanceAfter/totalSavings/daily stats
- [x] **2.2** `transactionService.ts` → ดึง logic ร่วม (counter, dashboard summary/dailyStats, สร้าง tx doc, audit) เป็น `executeLedgerEntry({ type: 'Deposit' | 'Withdrawal', ... })` ภายในไฟล์; `performDeposit/performWithdrawal` เป็น wrapper บาง (signature ภายนอกเดิมห้ามเปลี่ยน → ไม่ต้องแก้ UI)
- [x] **2.3** เช็คสถานะนักเรียนใน transaction เดียวกัน: อ่าน `students/{id}` → ถ้า `deletedAt != null` หรือ status ไม่ใช่ Active → throw `InvalidAccountStatusError`
- [x] **2.4** ปีใน reference number ใช้ปีตามเวลา `Asia/Bangkok` (เพิ่ม `getLocalYear()` ใน `bankUtils.ts` แล้วใช้แทน `new Date().getFullYear()`)
- [x] **2.5** `useTransactionSubmit.ts` → ใช้ `useRef` เป็น lock จริง (เก็บ `submitting` state ไว้สำหรับ UI); type `'warning'` ให้ครอบคลุมใน toast (ดู P4.3)
- [x] **2.6** แทนที่ `catch (err: any)` ใน hook ด้วย `unknown` + type guard

**Verification:** diff ของ `balanceBefore/After`, `referenceNumber` format (`DEP{ปี}{6 หลัก}`/`WDL…`), audit log shape ต้องเหมือนเดิม; ถอนเกินยอด → `InsufficientFundsError`; tsc/lint ผ่าน

---

## Phase 3 — Student Atomicity & Dashboard Summary (🟠)

**เป้าหมาย:** เลิก scan ทั้ง collection และเลิกเขียนหลายขั้นตอนแบบไม่ atomic

- [x] **3.1** `src/services/studentService.ts` (ไฟล์ใหม่): `createStudent` ใช้ `runTransaction` → เช็ค duplicate จาก DB จริง, เขียน student + account + `totalStudents +1` + audit log รวมใน transaction เดียว
- [x] **3.2** `studentService.ts`: `updateStudent` / `softDeleteStudent` / `restoreStudent` → transaction ที่อัปเดต `totalStudents` และ `totalSavings` แบบ delta (ตาม D2) + audit log; ไม่เรียก `recalculateDashboardSummary`
- [x] **3.3** `StudentsMainContent.tsx` → เปลี่ยน handler (L~90-230) ให้เรียก service แทนเขียน Firestore ตรง; UI/ข้อความ toast เหมือนเดิม; ลบ import ที่ไม่ใช้ (`setDoc`, `updateDoc`, `increment`, …)
- [x] **3.4** `recalculateDashboardSummary` → คงไว้เป็นเครื่องมือ "ซ่อมสรุปยอด" สำหรับ Admin เท่านั้น (ย้ายจุดเรียกไปปุ่มใน Settings ถ้ายังไม่มี; ถ้ามีอยู่แล้วให้คงไว้) + ใส่คอมเมนต์ว่าแพง/ไม่ใช้ใน flow ปกติ และ guard ด้วย role Admin

**Verification:** สร้างนักเรียน → มี student+account+summary+audit ครบ หรือไม่มีเลย (ทดสอบ throw กลางทาง); ลบ/กู้คืนนักเรียนที่มียอด → `totalSavings` ตรงกับผล recalc เดิม; tsc/lint ผ่าน

---

## Phase 4 — Types, RBAC & Small UI Bugs (🟡)

**เป้าหมาย:** ลบ `any` ในแกนหลัก, role มี source เดียว, แก้บั๊ก UI เล็กๆ

- [x] **4.1** `src/types/index.ts` → เพิ่ม `Role = 'Super Admin' | 'Admin' | 'Teacher'` และ `UserSession` interface; `AuthContext`/`useAuthRole`/components ที่รับ `userSession: any` → ใช้ type ใหม่ (ใช้ grep `userSession: any` / `userSession?: any`)
- [x] **4.2** `useAuthRole.ts` → เปลี่ยน `includes` เป็นการ normalize role ครั้งเดียว (map ค่าเก่าภาษาไทย/สตริงเดิม → `Role`) แล้วเทียบแบบตรงตัว; `AuthContext` fallback role ใช้ `'Teacher'` (ตรงกับ rules)
- [x] **4.3** `app/page.tsx` → ย้าย `ToastContainer` ออกมาเป็นคอมโพเนนต์ระดับ module (รับ `toasts` เป็น prop) → ลบ prop `toasts`/`ToastContainer` ที่ส่งเข้า `AppContent` แบบเดิม; รองรับ type `'warning'` (สีเหลือง); แก้ class พิมพ์ผิด `emerald-505`→`emerald-500`, `rose-450`→`rose-400`, `duration-305`→`duration-300`; ลบ `any[]` ของ toast (สร้าง `Toast` type)
- [x] **4.4** กวาด `catch (err: any)` → `unknown` เฉพาะไฟล์ที่แตะในเฟส 2-3 (ไม่ต้องไล่ทั้งโปรเจกต์)

**Verification:** tsc/lint ผ่าน; ทดสอบ route settings ด้วย user ที่ไม่ใช่ Admin ยังถูกกัน; toast แสดงครบ 3 แบบ

---

## Phase 5 — Tests, Cleanup & Docs (🟡)

**เป้าหมาย:** มีเกราะป้องกัน regression และลบความรก

- [x] **5.1** ติดตั้ง `vitest` (devDependency) + script `"test"`; unit test สำหรับฟังก์ชัน pure: `money.ts`, `getLocalDateString/getLocalYear`, role normalization, daily-stats trimming (ถ้าดึงเป็น pure function ใน P2.2 แล้ว)
- [x] **5.2** `@firebase/rules-unit-testing` + Firestore emulator (`firebase.json` มี config อยู่แล้ว): เทสต์ rules ของเคส P1 (escalation, email ไม่ยืนยัน, balance ติดลบ, ห้ามลบ/แก้ transaction)
- [x] **5.3** `app/test_runner_ui.tsx` → ให้รันได้เฉพาะเมื่อ `NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true'` (ไม่เขียนข้อมูลทดสอบลง Firestore จริง) + แสดงข้อความเตือนถ้าไม่ใช่ emulator
- [x] **5.4** Cleanup: ลบ/ย้าย `firestore-debug.log`, โฟลเดอร์ `bank-of-school/` (มีแค่ `.next`), `scratch/` (ตรวจก่อนว่าไม่มีของสำคัญ), เพิ่ม `firestore-debug.log` เข้า `.gitignore`; เอกสารแผนเก่า 2 ไฟล์ → ย้ายไป `docs/archive/` พร้อมหมายเหตุว่าล้าสมัย (`BankDataContext` ถูกแทนด้วย zustand)
- [x] **5.5** เขียน `README.md` ใหม่ (สั้น: setup, env vars, emulator, scripts, โครงสร้าง `src/`, สิทธิ์ 3 ระดับ, กฎ immutability)
- [x] **5.6** Void (ตาม D3): ค่าเริ่มต้น = เพิ่มหัวข้อ Backlog ใน README ว่ายังไม่ implement และ type/UI ที่รองรับ `Void` เป็นของเตรียมไว้

**Verification:** `npm test` ผ่าน, `npm run lint` + `tsc --noEmit` ผ่าน, `npm run build` ผ่าน

---

## Definition of Done (ทั้งโปรเจกต์)

- [x] ทุกเฟสติ๊กครบ + commit ครบ 5 เฟส
- [x] ไม่มี `any` ใหม่; จำนวน `any` ในไฟล์ที่แตะลดลง
- [x] `lint`, `tsc`, `test`, `build` ผ่าน
- [x] ผู้ใช้ได้รับสรุปสิ่งที่ต้อง deploy เอง (`firebase deploy --only firestore:rules`) และ Super Admin bootstrap ถ้ามี

---

## Progress Log (อัปเดตทุก task)

| วันที่ | Task | สถานะ | ไฟล์ที่แก้ | หมายเหตุ/สิ่งที่ค้าง |
|---|---|---|---|---|
| 2026-10-06 | — | แผนถูกสร้าง | `implement plan.md` | ยังไม่เริ่ม; D1–D3 รอคำตอบ |
| 2026-10-06 | D1 / Phase 1 Note | บันทึกข้อตกลง | `doc/implement plan.md` | บันทึกเงื่อนไขไม่บังคับ email_verified == true เนื่องจากมีครูใช้งานจริง 1 ท่าน และใช้ Mock Email |
| 2026-10-06 | 1.1 | สำเร็จ | `firestore.rules` | เพิ่ม helper hasStaffPlaceholder/getStaffPlaceholder และจำกัด self-create role/status ให้ตรงกับ placeholder หรือ Teacher/Active ป้องกัน privilege escalation |
| 2026-10-06 | 1.2 | สำเร็จ | `firestore.rules` | ปรับ delete users ให้ลบได้เฉพาะ Admin หรือ placeholder ตัวเอง (`STAFF_*` + email ตรงกัน) ป้องกันลบ user doc ตัวจริง |
| 2026-10-06 | 1.3 | สำเร็จ | `src/context/AuthContext.tsx`, `src/components/LoginView.tsx` | ปรับปรุงการ migrate รองรับ deterministic docId (`STAFF_<email>`) พร้อม fallback เดิม, ใช้ dbPaths และใส่คอมเมนต์ TODO สำหรับ email_verified ในอนาคต |
| 2026-10-06 | 1.4 | สำเร็จ | `src/components/SettingsMainContent.tsx` | เปลี่ยน docId ของ staff placeholder ตอน Admin เพิ่มเจ้าหน้าที่เป็น `STAFF_<email ตัวพิมพ์เล็ก>` ตาม D1 |
| 2026-10-06 | 1.5 | สำเร็จ | `firestore.rules` | เพิ่ม isValidDashboardSummary จำกัดฟิลด์ (hasOnly) และบังคับค่าตัวเลข >= 0, delete ได้เฉพาะ Admin; Accepted Risk: ยังไม่สามารถตัดสิทธิ์ teacher อัปเดต totalSavings ออกได้ทั้งหมดเนื่องจาก client transaction ฝาก/ถอนยังต้องส่งค่ายอดสุทธิ |
| 2026-10-06 | Phase 1 สรุป | เสร็จสิ้น | `firestore.rules`, `AuthContext.tsx`, `LoginView.tsx`, `SettingsMainContent.tsx` | เสร็จสิ้น Phase 1: Security & Auth ครบทุก task (1.1-1.5); tsc/lint ตรวจสอบแล้วผ่าน; พร้อม commit |
| 2026-10-06 | 2.1 | สำเร็จ | `src/utils/errors.ts`, `src/utils/money.ts` | เพิ่ม InvalidAmountError ใน errors.ts และสร้าง money.ts พร้อมฟังก์ชัน normalizeAmount และ roundMoney |
| 2026-10-06 | 2.2–2.4 | สำเร็จ | `src/services/transactionService.ts`, `src/utils/bankUtils.ts` | รวม logic ฝาก/ถอนเป็น executeLedgerEntry, ตรวจสถานะนักเรียนใน tx, ใช้ getLocalYear (Asia/Bangkok) และประยุกต์ใช้ normalizeAmount/roundMoney |
| 2026-10-06 | 2.5–2.6 | สำเร็จ | `src/hooks/useTransactionSubmit.ts` | ใช้ useRef (isSubmittingRef) เป็น synchronous lock, เพิ่ม ToastType รองรับ 'warning', และแปลง catch (err: any) เป็น unknown + BankError/Error type guard |
| 2026-10-06 | Phase 2 สรุป | เสร็จสิ้น | `src/utils/errors.ts`, `src/utils/money.ts`, `src/services/transactionService.ts`, `src/utils/bankUtils.ts`, `src/hooks/useTransactionSubmit.ts` | เสร็จสิ้น Phase 2: Financial Core ครบทุก task (2.1-2.6); tsc/lint ผ่าน 100%; พร้อม commit |
| 2026-10-06 | 3.1 | สำเร็จ | `src/utils/errors.ts`, `src/services/studentService.ts` | สร้าง studentService.ts พร้อม createStudent ใช้ runTransaction ตรวจสอบ duplicate จาก DB จริง, เขียน student + account + totalStudents +1 และ audit log รวมแบบ atomic |
| 2026-10-06 | 3.2 | สำเร็จ | `src/services/studentService.ts` | เพิ่ม updateStudent, softDeleteStudent, restoreStudent ใน studentService.ts ใช้ runTransaction อัปเดต totalStudents และ totalSavings แบบ delta (ตาม D2) และบันทึก audit log โดยไม่ต้อง scan collection |
| 2026-10-06 | 3.3 | สำเร็จ | `src/components/StudentsMainContent.tsx` | เปลี่ยน handler เพิ่ม/แก้ไข/ลบนักเรียนให้เรียก studentService แทนเขียน Firestore ตรง, ลบ import ไม่จำเป็น (setDoc, updateDoc, getDoc, increment, writeAuditLog, recalculateDashboardSummary), แปลง catch เป็น unknown + BankError |
| 2026-10-06 | 3.4 | สำเร็จ | `src/utils/bankUtils.ts`, `src/components/SettingsMainContent.tsx`, `src/components/DashboardMainContent.tsx` | เพิ่ม JSDoc เตือนราคาแพงและ role guard ใน recalculateDashboardSummary, เพิ่มปุ่มซ่อมแซมสรุปยอดสำหรับ Admin ในหน้า Settings, ปรับ Dashboard ให้อ่าน snapshot/refresh แบบ lightweight |
| 2026-10-06 | Phase 3 สรุป | เสร็จสิ้น | `src/services/studentService.ts`, `src/utils/errors.ts`, `src/utils/bankUtils.ts`, `src/components/StudentsMainContent.tsx`, `src/components/SettingsMainContent.tsx`, `src/components/DashboardMainContent.tsx` | เสร็จสิ้น Phase 3: Student Atomicity & Dashboard Summary ครบทุก task (3.1-3.4); tsc ผ่าน 100%; พร้อม commit |
| 2026-10-06 | 4.1 | สำเร็จ | `src/types/index.ts`, `src/store/notificationStore.ts`, `src/context/AuthContext.tsx`, `src/components/*` | เพิ่ม Role และ UserSession interface ใน types; ลบ userSession: any ในทุกคอมโพเนนต์และ store |
| 2026-10-06 | 4.2 | สำเร็จ | `src/utils/roleUtils.ts`, `src/hooks/useAuthRole.ts`, `src/context/AuthContext.tsx`, `src/components/LoginView.tsx`, `src/components/RoleGuard.tsx`, `src/components/ProtectedRoute.tsx` | สร้าง pure helper normalizeRole, เปลี่ยน useAuthRole จาก includes มาเป็นการ normalize ครั้งเดียวแล้วเปรียบเทียบตรงตัว, fallback role ใช้ 'Teacher' |
| 2026-10-06 | 4.3 | สำเร็จ | `app/page.tsx` | ย้าย ToastContainer เป็น module component, ลบ toasts/ToastContainer props จาก AppContent, รองรับ warning type (สี amber), แก้ typos (emerald-500, rose-400, duration-300), กำหนด Toast interface แทน any[] |
| 2026-10-06 | 4.4 | สำเร็จ | `src/components/SettingsMainContent.tsx`, `src/components/LoginView.tsx` | กวาด catch (err: any) เป็น catch (err: unknown) พร้อม Error type guards ในไฟล์ SettingsMainContent และ LoginView |
| 2026-10-06 | Phase 4 สรุป | เสร็จสิ้น | `src/types/index.ts`, `src/utils/roleUtils.ts`, `src/hooks/useAuthRole.ts`, `src/context/AuthContext.tsx`, `src/components/*`, `app/page.tsx` | เสร็จสิ้น Phase 4: Types, RBAC & Small UI Bugs ครบทุก task (4.1-4.4); tsc/lint ตรวจสอบแล้วผ่าน 100%; พร้อม commit |
| 2026-10-06 | 5.1 | สำเร็จ | `package.json`, `vitest.config.mts`, `src/utils/bankUtils.ts`, `src/services/transactionService.ts`, `src/utils/__tests__/pureFunctions.test.ts` | ติดตั้ง vitest, สกัด trimDailyStats เป็น pure helper, เขียน unit tests 14 เคสสำหรับ money, bankUtils, roleUtils และผ่าน 100% |
| 2026-10-06 | 5.2 | สำเร็จ | `package.json`, `src/utils/__tests__/firestoreRules.test.ts` | ติดตั้ง @firebase/rules-unit-testing, เขียน test suite ตรวจสอบความปลอดภัย firestore.rules ครบทุกเคส P1 (privilege escalation, negative balance, immutability, soft-delete) |
| 2026-10-06 | 5.3 | สำเร็จ | `app/test_runner_ui.tsx` | เพิ่มตัวป้องกัน emulator ใน runAllTests, disable ปุ่มรันเมื่อไม่ใช่ emulator, แสดง warning banner เตือนความปลอดภัย |
| 2026-10-06 | 5.4 | สำเร็จ | `.gitignore`, `doc/archive/*`, `scratch/`, `bank-of-school/` | เพิ่ม firestore-debug.log* ใน .gitignore, ลบ scratch/ และ bank-of-school/ เก่า, ย้ายแผนเก่า 3 ไฟล์ไป doc/archive/ พร้อมใส่คำเตือนล้าสมัย |
| 2026-10-06 | 5.5 | สำเร็จ | `README.md` | เขียน README.md ใหม่ครอบคลุม tech stack, env vars, emulator, scripts, โครงสร้าง src/, สิทธิ์ 3 ระดับ, และกฎ immutability |
| 2026-10-06 | 5.6 | สำเร็จ | `README.md` | บันทึกสถานะ Void Transaction เป็น Backlog (D3) ระบุว่า type/UI models เตรียมไว้แล้วแต่ฟังก์ชัน Reversal อยู่ใน backlog |
| 2026-10-06 | Phase 5 สรุป | เสร็จสิ้น | `vitest.config.mts`, `package.json`, `src/utils/__tests__/*`, `app/test_runner_ui.tsx`, `README.md`, `doc/archive/*`, `.gitignore`, `src/config/firebase.ts`, `doc/implement plan.md` | เสร็จสิ้น Phase 5: Tests, Cleanup & Docs ครบทุก task (5.1-5.6); test, tsc, build ผ่าน 100%; พร้อม commit |
