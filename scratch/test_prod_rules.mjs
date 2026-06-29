import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, query, orderBy, limit } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyCaM4YqTYI-phaxPnwD9_MUSDLiLafYmbQ",
    authDomain: "bank-of-school.firebaseapp.com",
    projectId: "bank-of-school",
    storageBucket: "bank-of-school.firebasestorage.app",
    messagingSenderId: "88967256046",
    appId: "1:88967256046:web:fea98dfca195b5940ba0ff",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = "bank-of-school-v1";

async function run() {
    console.log("1. Authenticating anonymously...");
    const cred = await signInAnonymously(auth);
    const uid = cred.user.uid;
    console.log(`✅ Authenticated with UID: ${uid}`);

    console.log(`2. Checking if teacher document exists for UID: ${uid}...`);
    const userDocRef = doc(db, 'artifacts', appId, 'users', uid);
    let docExists = false;
    try {
        const snap = await getDoc(userDocRef);
        docExists = snap.exists();
        console.log(`   Document exists: ${docExists}`);
    } catch (err) {
        console.error(`❌ Failed to read own user document: ${err.message}`);
    }

    if (!docExists) {
        console.log("3. Attempting to register/write teacher document...");
        try {
            await setDoc(userDocRef, {
                userId: uid,
                email: "teacher.somrak@school.ac.th",
                fullName: "คุณครูสมรักษ์ ใจดี",
                role: "Teacher",
                classAssignment: "ชั้นมัธยมศึกษาปีที่ 1/2",
                status: "Active",
                createdAt: new Date().toISOString()
            });
            console.log("✅ Teacher document registered successfully!");
        } catch (err) {
            console.error(`❌ Failed to write teacher document: ${err.message}`);
        }
    }

    console.log("4. Verifying if teacher document can be read now...");
    try {
        const snap = await getDoc(userDocRef);
        console.log(`✅ Read teacher document successfully: ${snap.exists() ? "Yes" : "No"}`);
    } catch (err) {
        console.error(`❌ Failed to read teacher document: ${err.message}`);
    }

    console.log("5. Attempting to query audit_logs collection...");
    try {
        const logsCol = collection(db, 'artifacts', appId, 'audit_logs');
        const q = query(logsCol, orderBy('timestamp', 'desc'), limit(5));
        const snap = await getDocs(q);
        console.log(`✅ Read audit_logs successfully! Found ${snap.size} log entries.`);
    } catch (err) {
        console.error(`❌ Failed to read audit_logs: ${err.message}`);
    }
}

run().catch(console.error);
