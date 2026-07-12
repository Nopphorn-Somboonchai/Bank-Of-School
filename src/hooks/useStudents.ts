import { useStudentStore } from '@/src/store/studentStore';

export function useStudents() {
  const students = useStudentStore((state) => state.students);
  const loading = useStudentStore((state) => state.loading);
  const error = useStudentStore((state) => state.error);

  return { students, loading, error };
}
