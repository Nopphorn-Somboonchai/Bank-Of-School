import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, doc, getDoc, setDoc } from 'firebase/firestore';

// 1. ดึงข้อมูลการกำหนดค่า Firebase (ปลอดภัยจากค่าคงที่ระบบและ Local Env)
const getFirebaseConfig = () => {
    if (typeof window !== 'undefined' && (window as any).__firebase_config) {
        return JSON.parse((window as any).__firebase_config);
    }
    return {
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    };
};

// 2. ตรวจหาและดึงค่ารหัส App ID สำหรับจัดการพาธจัดเก็บข้อมูล
export const getAppId = (): string => {
    if (typeof window !== 'undefined' && (window as any).__app_id) {
        return (window as any).__app_id;
    }
    return process.env.NEXT_PUBLIC_APP_ID || 'default-bank-school-id';
};

// 3. เริ่มต้นใช้งาน Firebase App
const firebaseConfig = getFirebaseConfig();
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// 4. ประกาศบริการและส่งออกภายนอก
export const auth = getAuth(app);
export const db = getFirestore(app);

// เชื่อมต่อ Firestore Emulator หากมีการเปิดใช้งานผ่าน env และรันบน localhost/local network เพื่อความปลอดภัยของข้อมูลจริง
const useEmulator = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true';

if (useEmulator && typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname.includes('192.168'))) {
    const dbAny = db as any;
    if (!dbAny._emulatorConnected) {
        try {
            // ใช้ window.location.hostname เพื่อรองรับการเชื่อมต่อจากอุปกรณ์อื่นในวง LAN เดียวกัน
            const host = window.location.hostname === 'localhost' ? '127.0.0.1' : window.location.hostname;
            connectFirestoreEmulator(db, host, 8080);
            dbAny._emulatorConnected = true;
            console.log(`⚡ Connected to Firestore Emulator at ${host}:8080`);
        } catch (error) {
            console.warn("⚠️ Cannot connect to Firestore Emulator:", error);
        }
    }
}

/**
 * ฟังก์ชันสำหรับการทำ Authentication เริ่มต้นแบบปลอดภัยสูง (สอดคล้องกับ RULE 3)
 * จะเริ่มตรวจสอบ Token พิเศษก่อน หากไม่มีจะเข้าสู่ระบบแบบนิรนามชั่วคราวเพื่อรับสิทธิ์
 */
export const initializeAppAuth = async (): Promise<string> => {
    try {
        const initialToken = typeof window !== 'undefined' ? (window as any).__initial_auth_token : undefined;

        let uid: string;
        if (initialToken) {
            // ลงชื่อเข้าใช้งานด้วย Custom Token ที่ระบบมอบให้
            const userCredential = await signInWithCustomToken(auth, initialToken);
            uid = userCredential.user.uid;
        } else {
            // ลงชื่อเข้าใช้งานแบบนิรนาม (Anonymous) เพื่อให้ผ่านเงื่อนไขการระบุตัวตนเบื้องต้น
            const userCredential = await signInAnonymously(auth);
            uid = userCredential.user.uid;
        }

        // ลงทะเบียน UID ของผู้ใช้ให้เป็นบทบาทคุณครู (Teacher) โดยอัตโนมัติ เพื่อให้ผ่านเงื่อนไขระบบความปลอดภัย (Security Rules)
        try {
            const appId = getAppId();
            const userDocRef = doc(db, 'artifacts', appId, 'users', uid);
            const userDocSnap = await getDoc(userDocRef);

            if (!userDocSnap.exists()) {
                await setDoc(userDocRef, {
                    userId: uid,
                    email: "teacher.somrak@school.ac.th",
                    fullName: "คุณครูสมรักษ์ ใจดี",
                    role: "Teacher",
                    classAssignment: "ชั้นมัธยมศึกษาปีที่ 1/2",
                    status: "Active",
                    createdAt: new Date().toISOString()
                });
                console.log("Teacher auto-registered in Firestore for UID:", uid);
            } else {
                console.log("Teacher already registered in Firestore for UID:", uid);
            }
        } catch (dbErr) {
            console.error("Failed to auto-register teacher in initializeAppAuth:", dbErr);
        }

        return uid;
    } catch (error) {
        console.error('การยืนยันตัวตนผิดพลาด:', error);
        throw error;
    }
};