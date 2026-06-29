import { initializeApp } from 'firebase/app';
import { getFirestore, doc, updateDoc, getDocs, collection, setDoc } from 'firebase/firestore';

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
    console.log("1. Fixing student STD1234 (setting deletedAt to null)...");
    const studentDocRef = doc(db, 'artifacts', appId, 'students', 'STD1234');
    await updateDoc(studentDocRef, {
        deletedAt: null
    });
    console.log("Successfully fixed STD1234!");

    console.log("\n2. Recalculating dashboard summary...");
    const studentsCol = collection(db, 'artifacts', appId, 'students');
    const studentsSnap = await getDocs(studentsCol);
    let activeStudentCount = 0;
    studentsSnap.forEach((docSnap) => {
        const s = docSnap.data();
        if (s.deletedAt === null) {
            activeStudentCount++;
        }
    });
    console.log(`Active student count calculated: ${activeStudentCount}`);

    const summaryDocRef = doc(db, 'artifacts', appId, 'settings', 'dashboard_summary');
    await updateDoc(summaryDocRef, {
        totalStudents: activeStudentCount
    });
    console.log("Successfully updated dashboard summary in Firestore!");
}

run().catch(console.error);
