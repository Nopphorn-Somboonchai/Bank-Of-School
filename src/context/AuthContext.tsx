"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, db, getAppId } from '@/src/config/firebase';
import { doc, getDoc, collection, setDoc, deleteDoc, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { writeAuditLog } from '@/src/utils/bankUtils';

interface AuthContextType {
  userSession: any | null;
  loading: boolean;
  logout: () => Promise<void>;
  setUserSession: React.Dispatch<React.SetStateAction<any | null>>;
  showToast: (message: string, type?: string) => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({
  children,
  showToast
}: {
  children: React.ReactNode;
  showToast: (message: string, type?: string) => void;
}) {
  const [userSession, setUserSession] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  // Firebase Auth State Listener & Session Restoration
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        if (user) {
          const appId = getAppId();
          const userDocRef = doc(db, 'artifacts', appId, 'users', user.uid);
          let userDocSnap = await getDoc(userDocRef);

          if (!userDocSnap.exists()) {
            // Search for a placeholder created by Admin (by email) and migrate it
            const usersCol = collection(db, 'artifacts', appId, 'users');
            const q = query(usersCol, where('email', '==', user.email));
            const querySnapshot = await getDocs(q);

            let placeholderData: any = null;
            let placeholderDocRef: any = null;

            querySnapshot.forEach((docSnap) => {
              if (docSnap.id.startsWith('STAFF_')) {
                placeholderData = docSnap.data();
                placeholderDocRef = docSnap.ref;
              }
            });

            if (placeholderData) {
              if (placeholderData.status === 'Suspended') {
                showToast("บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ", "error");
                setUserSession(null);
                await signOut(auth);
                setLoading(false);
                return;
              }
              const newTeacherDoc = {
                userId: user.uid,
                email: user.email,
                fullName: placeholderData.fullName || "คุณครูผู้ดูแลระบบ",
                role: placeholderData.role || "Teacher",
                classAssignment: placeholderData.classAssignment || "ชั้นมัธยมศึกษาปีที่ 1/2",
                status: placeholderData.status || "Active",
                createdAt: new Date().toISOString()
              };
              await setDoc(userDocRef, newTeacherDoc);

              if (placeholderDocRef) {
                try {
                  await deleteDoc(placeholderDocRef);
                } catch (delErr) {
                  console.error("Failed to delete placeholder in AuthContext listener:", delErr);
                }
              }
              // Reload document snapshot
              userDocSnap = await getDoc(userDocRef);
            }
          }

          if (userDocSnap.exists()) {
            const data = userDocSnap.data();
            if (data.status === 'Suspended') {
              showToast("บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ", "error");
              setUserSession(null);
              await signOut(auth);
              setLoading(false);
              return;
            }
            setUserSession({
              userId: user.uid,
              email: user.email || data.email,
              fullName: data.fullName || "คุณครูผู้ดูแลระบบ",
              role: data.role || "ครูผู้ดูแลระบบ (Teacher)",
              classAssignment: data.classAssignment || "ชั้นมัธยมศึกษาปีที่ 1/2",
              schoolName: "โรงเรียนสาธิตวิทยาคาร",
              academicYear: "2569",
              loginTime: new Date().toLocaleString('th-TH')
            });
          } else {
            setUserSession(null);
          }
        } else {
          setUserSession(null);
        }
      } catch (error) {
        console.error("Firebase Auth initialization failed in AuthContext:", error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [showToast]);

  // Listen for global settings changes (e.g. schoolName, academicYear) to keep session updated reactively
  useEffect(() => {
    if (!userSession?.userId) return;

    const appId = getAppId();
    const configDocRef = doc(db, 'artifacts', appId, 'settings', 'system_config');
    const unsubscribe = onSnapshot(configDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setUserSession((prev: any) => {
          if (!prev) return null;
          if (prev.schoolName === data.schoolName && prev.academicYear === data.academicYear) {
            return prev;
          }
          return {
            ...prev,
            schoolName: data.schoolName || "โรงเรียนสาธิตวิทยาคาร",
            academicYear: data.academicYear || "2569"
          };
        });
      }
    }, (error) => {
      console.error("Error subscribing to system settings in AuthContext:", error);
    });

    return () => unsubscribe();
  }, [userSession?.userId]);

  const logout = async () => {
    if (userSession) {
      await writeAuditLog(
        'Logout',
        `users/${userSession.userId}`,
        { email: userSession.email, fullName: userSession.fullName, role: userSession.role },
        null,
        `คุณครู ${userSession.fullName} ออกจากระบบ`,
        userSession.userId
      );
    }
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Failed to sign out from Firebase:", err);
    }
    setUserSession(null);
    showToast('ออกจากระบบเรียบร้อยแล้ว', 'success');
  };

  const value = {
    userSession,
    loading,
    logout,
    setUserSession,
    showToast
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
