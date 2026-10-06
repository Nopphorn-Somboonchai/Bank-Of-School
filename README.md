# Bank of School 🏦

ระบบจัดการธนาคารโรงเรียน (Student Savings Web Application) ระดับ Production-ready มุ่งเน้นความถูกต้องทางการเงินสูงสุด (Financial Integrity & Immutability), การประมวลผลธุรกรรมแบบอะตอมิก (Atomic Multi-Document Transactions) ผ่าน Google Cloud Firestore และระบบควบคุมสิทธิ์ผู้ใช้ 3 ระดับ (Role-Based Access Control)

---

## 🛠 Tech Stack

- **Framework:** Next.js 16 (App Router)
- **UI Library:** React 19, Lucide React
- **Language:** TypeScript 5 (Strict Mode)
- **Styling:** Tailwind CSS 4
- **State Management:** Zustand 5 & React Context (Auth)
- **Database & Auth:** Firebase v12 (Cloud Firestore, Firebase Authentication)
- **Testing:** Vitest 5, `@firebase/rules-unit-testing`

---

## ⚙️ Environment Variables

สร้างไฟล์ `.env.local` ที่ root directory ของโปรเจกต์:

```bash
# Firebase Client SDK Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id

# Multi-tenant / School Scope ID (Default: default-bank-school-id)
NEXT_PUBLIC_APP_ID=default-bank-school-id

# Firebase Local Emulator Switch (true สำหรับ local dev / false สำหรับ production)
NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true
```

---

## 🚀 Getting Started

### 1. ติดตั้ง Dependencies
```bash
npm install
```

### 2. รัน Firestore Emulator (แนะนำสำหรับ Local Development)
โครงการมีไฟล์ `firebase.json` และ security rules เตรียมไว้:
```bash
# ติดตั้ง Firebase CLI (หากยังไม่มี)
npm install -g firebase-tools

# เริ่มต้น Firestore Emulator (Port 8080)
firebase emulators:start --only firestore
```

### 3. รัน Development Server
```bash
npm run dev
```
เปิดเบราว์เซอร์ที่ [http://localhost:3000](http://localhost:3000)

> ⚠️ **หมายเหตุเกี่ยวกับ Test Runner UI:**  
> หน้าทดสอบ `/test_runner_ui` จะอนุญาตให้รันต่อเมื่อ `NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true` เท่านั้น เพื่อป้องกันการสร้าง mock data ปะปนในฐานข้อมูลจริง

---

## 📜 Available Scripts

| คำสั่ง | คำอธิบาย |
|---|---|
| `npm run dev` | เริ่ม Next.js development server (`--webpack`) |
| `npm run build` | สร้าง Production build ของ Next.js |
| `npm run start` | รัน Next.js production server |
| `npm run lint` | ตรวจสอบคุณภาพโค้ดด้วย ESLint |
| `npm test` | รัน Unit Test ทั้งหมดด้วย Vitest |

---

## 📂 Project Structure (`src/`)

```text
src/
├── components/          # UI Components แบ่งตามฟีเจอร์และหน้าจอ
│   ├── DashboardMainContent.tsx    # สรุปภาพรวมและสถิติรายวัน
│   ├── DepositMainContent.tsx      # แบบฟอร์มทำรายการฝากเงิน
│   ├── WithdrawMainContent.tsx     # แบบฟอร์มทำรายการถอนเงิน
│   ├── StudentsMainContent.tsx     # จัดการข้อมูลนักเรียน (CRUD)
│   ├── SettingsMainContent.tsx     # จัดการบุคลากรและเครื่องมือ Admin
│   ├── RoleGuard.tsx               # ตรวจสอบสิทธิ์ระดับ Component
│   └── ProtectedRoute.tsx          # ป้องกัน Route ระดับหน้า
├── config/              # การตั้งค่าระบบ
│   ├── firebase.ts                 # Firebase Client & Emulator Initialization
│   └── dbPaths.ts                  # Centralized Firestore Path Builders
├── context/             # React Context
│   └── AuthContext.tsx             # จัดการสถานะการเข้าสู่ระบบและ Migration
├── hooks/               # Custom Hooks
│   ├── useAuthRole.ts              # ดึงและตรวจสอบบทบาทผู้ใช้แบบมี Type-safety
│   └── useTransactionSubmit.ts     # Hook จัดการส่งธุรกรรมพร้อม Double-submit Lock
├── services/            # Business Logic & Firestore Transactions
│   ├── transactionService.ts       # ทำรายการฝาก/ถอนเงินแบบ Atomic
│   └── studentService.ts           # จัดการเพิ่ม/แก้ไข/ลบนักเรียนแบบ Atomic
├── store/               # State Store (Zustand)
│   └── notificationStore.ts        # จัดการระบบแจ้งเตือน
├── types/               # TypeScript Definitions
│   └── index.ts                    # รวม Types กลาง (Role, UserSession, Transaction ฯลฯ)
└── utils/               # ฟังก์ชัน Utility
    ├── bankUtils.ts                # วันที่, เวลา, การคำนวณและสถิติธนาคาร
    ├── money.ts                    # Normalize และปัดเศษทศนิยมการเงิน
    ├── errors.ts                   # Custom Error Classes สำหรับระบบธนาคาร
    ├── roleUtils.ts                # Normalization และ Helper สิทธิ์ผู้ใช้งาน
    └── __tests__/                  # Unit Tests & Security Rules Tests
```

---

## 🛡️ Role-Based Access Control (RBAC)

ระบบกำหนดสิทธิ์การใช้งานเป็น 3 ระดับอย่างเข้มงวด:

1. **Super Admin:**
   - สิทธิ์สูงสุดของระบบ สามารถจัดการบุคลากร แก้ไขสถานะ และตั้งค่าระบบ
   - สร้างและจัดการ Staff Placeholder ได้ทุกระดับ
2. **Admin:**
   - จัดการข้อมูลบุคลากรในโรงเรียน (เพิ่ม/อนุมัติเจ้าหน้าที่)
   - เข้าถึงเครื่องมือดูแลระบบ เช่น ซ่อมแซมยอดสรุปภาพรวม (`recalculateDashboardSummary`)
   - กู้คืนบัญชีนักเรียน (Restore)
3. **Teacher (เจ้าหน้าที่ทั่วไป):**
   - ทำรายการฝากและถอนเงินให้นักเรียน
   - จัดการข้อมูลนักเรียน (เพิ่ม, แก้ไข, ปิดการใช้งาน)
   - ดูรายงานธุรกรรมและสมุดบัญชีเงินฝาก
   - *ไม่สามารถ* เข้าถึงการจัดการบุคลากร หรือลบข้อมูลผู้ใช้งานระดับระบบได้

---

## 🔒 Financial Integrity & Security Rules

1. **Ledger Immutability (Append-only):**
   - รายการธุรกรรม (`transactions`) ห้ามทำการแก้ไข (`update`) หรือลบ (`delete`) ทุกกรณี ทั้งในระดับ Firestore Security Rules และ Application Logic
2. **Atomic Multi-Document Transactions:**
   - การฝาก/ถอนเงินจะปรับปรุงยอดเงินในบัญชีนักเรียน (`accounts`), เพิ่มประวัติธุรกรรม (`transactions`), บันทึก Audit Log และอัปเดตยอดรวมโรงเรียน (`summary`) ใน Firestore Transaction เดียวกันเสมอ
3. **No Negative Balance:**
   - ยอดเงินในบัญชีนักเรียนต้องไม่ติดลบ (`balance >= 0`) และยอดเงินในการทำรายการต้องมากกว่า 0 เสมอ
4. **Soft Delete นักเรียน:**
   - ไม่อนุญาตให้ Hard Delete ข้อมูลนักเรียนที่มีความเคลื่อนไหวทางบัญชี ใช้การเปลี่ยนสถานะเป็น `Deleted` แทน เพื่อรักษาประวัติศาสตร์ทางการเงิน
5. **Centralized Paths:**
   - ทุกการอ้างอิง Collection และ Document ใน Firestore ต้องผ่าน `src/config/dbPaths.ts` เพื่อป้องกัน Path ผิดพลาดหรือการเขียนข้าม Tenant

---

## 📋 Backlog & Roadmap

### 🔄 Void / Reversal Transaction (D3 Deferral)
- **สถานะ:** พักไว้ใน Backlog (ยังไม่ได้เปิดใช้งานฟังก์ชันจริง)
- **คำอธิบาย:** โมเดลข้อมูลและประเภท `TransactionType: 'Void'` ในฝั่ง UI และ TypeScript ได้รับการประกาศเตรียมไว้แล้ว อย่างไรก็ตาม เพื่อรักษาหลักการ Immutability ของระบบบัญชีธนาคาร การยกเลิกรายการจะต้องทำผ่านกลไก **Reversal Transaction (บันทึกรายการธุรกรรมหักล้าง)** แบบ Atomic พร้อมบันทึกหลักฐานการขออนุมัติจาก Admin ซึ่งจะถูกพัฒนาในระยะถัดไป

---

## 🚀 Deployment Guide (Firestore Rules)

หากมีการแก้ไขกฎความปลอดภัยใน `firestore.rules`:
```bash
# ตรวจสอบความถูกต้องและ Deploy กฎความปลอดภัย
firebase deploy --only firestore:rules
```
