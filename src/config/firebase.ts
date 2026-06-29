import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

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

/**
 * ฟังก์ชันสำหรับการทำ Authentication เริ่มต้นแบบปลอดภัยสูง (สอดคล้องกับ RULE 3)
 * จะเริ่มตรวจสอบ Token พิเศษก่อน หากไม่มีจะเข้าสู่ระบบแบบนิรนามชั่วคราวเพื่อรับสิทธิ์
 */
export const initializeAppAuth = async (): Promise<string> => {
    try {
        const initialToken = typeof window !== 'undefined' ? (window as any).__initial_auth_token : undefined;

        if (initialToken) {
            // ลงชื่อเข้าใช้งานด้วย Custom Token ที่ระบบมอบให้
            const userCredential = await signInWithCustomToken(auth, initialToken);
            return userCredential.user.uid;
        } else {
            // ลงชื่อเข้าใช้งานแบบนิรนาม (Anonymous) เพื่อให้ผ่านเงื่อนไขการระบุตัวตนเบื้องต้น
            const userCredential = await signInAnonymously(auth);
            return userCredential.user.uid;
        }
    } catch (error) {
        console.error('การยืนยันตัวตนผิดพลาด:', error);
        throw error;
    }
};