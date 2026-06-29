import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, connectFirestoreEmulator } from 'firebase/firestore';

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
connectFirestoreEmulator(db, '127.0.0.1', 8080);
const appId = "G-4QFV3M7261"; // Real app ID from env

async function testRules() {
    console.log("=== STARTING FIRESTORE SECURITY RULES DRY-RUN TEST ===\n");

    // 1. Test Unauthenticated Access
    console.log("1. Testing Unauthenticated Access...");
    try {
        const studentDocRef = doc(db, 'artifacts', appId, 'students', 'test-student-id');
        await getDoc(studentDocRef);
        console.log("❌ Unauthenticated Access: ALLOWED (Failure)\n");
    } catch (error) {
        console.log("✅ Unauthenticated Access: DENIED (Success)");
        console.log(`   Error: ${error.message}\n`);
    }

    // 2. Test Negative Balance Bypass
    console.log("2. Testing Negative Balance Bypass (Update currentBalance < 0)...");
    try {
        const accountDocRef = doc(db, 'artifacts', appId, 'accounts', 'test-account-id');
        await setDoc(accountDocRef, {
            accountId: 'test-account-id',
            currentBalance: -500,
            status: 'Active'
        }, { merge: true });
        console.log("❌ Negative Balance Bypass: ALLOWED (Failure)\n");
    } catch (error) {
        console.log("✅ Negative Balance Bypass: DENIED (Success)");
        console.log(`   Error: ${error.message}\n`);
    }

    // 3. Test Delete Transaction
    console.log("3. Testing Delete Transaction...");
    try {
        const txDocRef = doc(db, 'artifacts', appId, 'transactions', 'test-tx-id');
        await deleteDoc(txDocRef);
        console.log("❌ Delete Transaction: ALLOWED (Failure)\n");
    } catch (error) {
        console.log("✅ Delete Transaction: DENIED (Success)");
        console.log(`   Error: ${error.message}\n`);
    }

    // 4. Test Update Audit Log
    console.log("4. Testing Update Audit Log...");
    try {
        const logDocRef = doc(db, 'artifacts', appId, 'audit_logs', 'test-log-id');
        await updateDoc(logDocRef, {
            remarks: "Modified Remarks"
        });
        console.log("❌ Update Audit Log: ALLOWED (Failure)\n");
    } catch (error) {
        console.log("✅ Update Audit Log: DENIED (Success)");
        console.log(`   Error: ${error.message}\n`);
    }

    console.log("=== DRY-RUN TEST COMPLETE ===");
}

testRules().catch(console.error);
