import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';

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

    console.log(`2. Ensuring teacher document exists for UID: ${uid}...`);
    const userDocRef = doc(db, 'artifacts', appId, 'users', uid);
    const snap = await getDoc(userDocRef);
    if (!snap.exists()) {
        await setDoc(userDocRef, {
            userId: uid,
            email: "teacher.somrak@school.ac.th",
            fullName: "คุณครูสมรักษ์ ใจดี",
            role: "Teacher",
            classAssignment: "ชั้นมัธยมศึกษาปีที่ 1/2",
            status: "Active",
            createdAt: new Date().toISOString()
        });
        console.log("✅ Registered teacher document!");
    } else {
        console.log("ℹ️ Teacher document already exists.");
    }

    console.log("3. Fetching all users in collection...");
    const usersCol = collection(db, 'artifacts', appId, 'users');
    const usersSnap = await getDocs(usersCol);
    console.log(`✅ Found ${usersSnap.size} user documents:`);
    usersSnap.forEach(docSnap => {
        const u = docSnap.data();
        console.log(`- ID: ${docSnap.id}, Name: ${u.fullName}, Role: ${u.role}`);
    });
}

run().catch(console.error);
