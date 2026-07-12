import { create } from 'zustand';
import { onSnapshot } from 'firebase/firestore';
import { getPublicCollection } from '@/src/utils/dbPaths';
import { Student } from '@/src/types';

interface StudentState {
  students: Student[];
  loading: boolean;
  error: string | null;
  subscribeStudents: (showToast: (message: string, type?: string) => void) => () => void;
}

export const useStudentStore = create<StudentState>((set) => ({
  students: [],
  loading: true,
  error: null,
  subscribeStudents: (showToast) => {
    set({ loading: true, error: null });
    const studentsCol = getPublicCollection('students');
    const unsubscribe = onSnapshot(
      studentsCol,
      (snapshot) => {
        const list: Student[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          if (data.deletedAt == null) {
            list.push({ studentId: doc.id, ...data } as Student);
          }
        });
        // Sort in frontend by studentNumber numerically
        list.sort((a, b) =>
          (a.studentNumber || '').localeCompare(b.studentNumber || '', undefined, { numeric: true })
        );
        set({ students: list, loading: false });
      },
      (error) => {
        console.error("Firestore read error for students store:", error);
        showToast("ล้มเหลวในการโหลดรายชื่อนักเรียน", "error");
        set({ error: error.message, loading: false });
      }
    );
    return unsubscribe;
  }
}));
