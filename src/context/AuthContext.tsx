"use client";

import React, { createContext, useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '@/src/config/firebase';
import { getPublicDoc, getPublicCollection } from '@/src/utils/dbPaths';
import { getDoc, setDoc, deleteDoc, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { writeAuditLog } from '@/src/utils/bankUtils';
import { UserSession } from '@/src/types';
import { normalizeRole } from '@/src/utils/roleUtils';

interface AuthContextType {
  userSession: UserSession | null;
  loading: boolean;
  logout: () => Promise<void>;
  setUserSession: React.Dispatch<React.SetStateAction<UserSession | null>>;
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
  const [userSession, setUserSession] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);

  // Firebase Auth State Listener & Session Restoration
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        if (user) {
          const userDocRef = getPublicDoc('users', user.uid);
          let userDocSnap = await getDoc(userDocRef);

          if (!userDocSnap.exists()) {
            // TODO: ในอนาคตเมื่อพร้อมบังคับใช้อีเมลจริงและต้องการบังคับยืนยันอีเมล ให้เปิดใช้งานเงื่อนไขนี้:
            // if (!user.emailVerified) {
            //   showToast("กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ", "error");
            //   setUserSession(null);
            //   await signOut(auth);
            //   setLoading(false);
            //   return;
            // }

            // Search for a placeholder created by Admin (by email) and migrate it
            const targetEmail = (user.email || "").toLowerCase().trim();
            let placeholderData: any = null;
            let placeholderDocRef: any = null;

            // ตรวจสอบตาม Deterministic ID ก่อน (STAFF_<email ตัวพิมพ์เล็ก> ตาม D1)
            if (targetEmail) {
              const directPlaceholderRef = getPublicDoc('users', `STAFF_${targetEmail}`);
              const directSnap = await getDoc(directPlaceholderRef);
              if (directSnap.exists()) {
                placeholderData = directSnap.data();
                placeholderDocRef = directSnap.ref;
              }
            }

            // Fallback รองรับ Legacy placeholder เดิมที่ขึ้นต้นด้วย STAFF_
            if (!placeholderData && user.email) {
              const usersCol = getPublicCollection('users');
              const q = query(usersCol, where('email', '==', user.email));
              const querySnapshot = await getDocs(q);

              querySnapshot.forEach((docSnap) => {
                if (docSnap.id.startsWith('STAFF_')) {
                  placeholderData = docSnap.data();
                  placeholderDocRef = docSnap.ref;
                }
              });
            }

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
              role: normalizeRole(data.role || "Teacher"),
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

    const configDocRef = getPublicDoc('settings', 'system_config');
    const unsubscribe = onSnapshot(configDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setUserSession((prev) => {
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
