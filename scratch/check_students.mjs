import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc, query, where, orderBy } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyCaM4YqTYI-phaxPnwD9_MUSDLiLafYmbQ",
    authDomain: "bank-of-school.firebaseapp.com",
    projectId: "bank-of-school",
    storageBucket: "bank-of-school.firebasestorage.app",
    messagingSenderId: "88967256046",
    appId: "1:88967256046:web:fea98dfca195b5940ba0ff",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const appId = "bank-of-school-v1";

async function run() {
    console.log("Fetching audit logs for STD1234...");
    const logsCol = collection(db, 'artifacts', appId, 'audit_logs');
    const q = query(logsCol, where('targetDocument', '==', 'students/STD1234'));
    const snap = await getDocs(q);
    
    console.log(`Found ${snap.size} log entries:`);
    const logs = [];
    snap.forEach(docSnap => {
        logs.push(docSnap.data());
    });
    
    // Sort by timestamp
    logs.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    logs.forEach(log => {
        console.log(`[${log.timestamp}] Action: ${log.actionType}, Remarks: ${log.remarks}`);
        console.log(`  Old: ${JSON.stringify(log.oldValue)}`);
        console.log(`  New: ${JSON.stringify(log.newValue)}`);
    });
}

run().catch(console.error);
