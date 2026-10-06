import React, { useState } from 'react';
import { Mail, Lock, EyeOff, Eye, Shield, AlertCircle, LogIn } from 'lucide-react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/src/config/firebase';
import { getPublicDoc, getPublicCollection } from '@/src/utils/dbPaths';
import { getDoc, setDoc, query, where, getDocs, deleteDoc, DocumentData, DocumentReference } from 'firebase/firestore';
import { UserSession } from '@/src/types';
import { normalizeRole } from '@/src/utils/roleUtils';

interface LoginViewProps {
  onLogin: (session: UserSession) => void;
  showToast: (message: string, type?: string) => void;
}

export default function LoginView({ onLogin, showToast }: LoginViewProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!email || !password) {
      setErrorMsg('กรุณากรอกอีเมลและรหัสผ่านให้ครบถ้วน');
      showToast('กรอกข้อมูลไม่ครบถ้วน', 'error');
      return;
    }

    let formattedEmail = email.trim();
    if (!formattedEmail.includes('@')) {
      formattedEmail = `${formattedEmail}@school.ac.th`;
    }

    setIsLoading(true);
    try {
      let sessionData;
      
      // Try real Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, formattedEmail, password);
      const user = userCredential.user;
      
      const userDocRef = getPublicDoc('users', user.uid);
      const userDocSnap = await getDoc(userDocRef);
      
      if (userDocSnap.exists()) {
        const data = userDocSnap.data();
        if (data.status === 'Suspended') {
          await auth.signOut();
          throw new Error("บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ");
        }
        sessionData = {
          userId: user.uid,
          email: user.email || data.email,
          fullName: data.fullName || "คุณครูผู้ดูแลระบบ",
          role: normalizeRole(data.role || "Teacher"),
          classAssignment: data.classAssignment || "ชั้นมัธยมศึกษาปีที่ 1/2",
          schoolName: "โรงเรียนสาธิตวิทยาคาร",
          academicYear: "2569",
          loginTime: new Date().toLocaleString('th-TH')
        };
      } else {
        // TODO: ในอนาคตเมื่อพร้อมบังคับใช้อีเมลจริงและต้องการบังคับยืนยันอีเมล ให้เปิดใช้งานเงื่อนไขนี้:
        // if (!user.emailVerified) {
        //   await auth.signOut();
        //   throw new Error("กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ");
        // }

        // If Firestore document doesn't exist, search for a placeholder created by Admin (by email)
        const targetEmail = (user.email || formattedEmail).toLowerCase().trim();
        let placeholderData: DocumentData | null = null;
        let placeholderDocRef: DocumentReference | null = null;

        // ตรวจสอบตาม Deterministic ID ก่อน (STAFF_<email ตัวพิมพ์เล็ก> ตาม D1)
        if (targetEmail) {
          try {
            const directPlaceholderRef = getPublicDoc('users', `STAFF_${targetEmail}`);
            const directSnap = await getDoc(directPlaceholderRef);
            if (directSnap.exists()) {
              placeholderData = directSnap.data();
              placeholderDocRef = directSnap.ref;
            }
          } catch (placeholderErr) {
            console.warn("Could not read deterministic placeholder in LoginView:", placeholderErr);
          }
        }

        // Fallback รองรับ Legacy placeholder เดิมที่ขึ้นต้นด้วย STAFF_
        if (!placeholderData) {
          try {
            const usersCol = getPublicCollection('users');
            const q = query(usersCol, where('email', '==', user.email || formattedEmail));
            const querySnapshot = await getDocs(q);
            
            querySnapshot.forEach((docSnap) => {
              if (docSnap.id.startsWith('STAFF_')) {
                placeholderData = docSnap.data();
                placeholderDocRef = docSnap.ref;
              }
            });
          } catch (queryErr) {
            console.warn("Could not query legacy placeholder docs in LoginView:", queryErr);
          }
        }

        if (placeholderData && placeholderData.status === 'Suspended') {
          await auth.signOut();
          throw new Error("บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ");
        }

        const isAdminEmail = targetEmail.startsWith('admin');
        const defaultRole = isAdminEmail ? "Admin" : "Teacher";
        const defaultFullName = isAdminEmail ? "ผู้ดูแลระบบ" : "คุณครูผู้ดูแลระบบ";
        const defaultClassAssignment = isAdminEmail ? "ผู้ดูแลระบบกลาง" : "ชั้นมัธยมศึกษาปีที่ 1/2";

        const newTeacherDoc = {
          userId: user.uid,
          email: user.email || formattedEmail,
          fullName: placeholderData?.fullName || defaultFullName,
          role: placeholderData?.role || defaultRole,
          classAssignment: placeholderData?.classAssignment || defaultClassAssignment,
          status: placeholderData?.status || "Active",
          createdAt: new Date().toISOString()
        };
        await setDoc(userDocRef, newTeacherDoc);

        // Delete temporary placeholder document if it exists
        if (placeholderDocRef) {
          try {
            await deleteDoc(placeholderDocRef);
          } catch (delErr) {
            console.error("Failed to delete temporary staff placeholder:", delErr);
          }
        }

        sessionData = {
          userId: user.uid,
          email: newTeacherDoc.email,
          fullName: newTeacherDoc.fullName,
          role: normalizeRole(newTeacherDoc.role || "Teacher"),
          classAssignment: newTeacherDoc.classAssignment,
          schoolName: "โรงเรียนสาธิตวิทยาคาร",
          academicYear: "2569",
          loginTime: new Date().toLocaleString('th-TH')
        };
      }
      
      onLogin(sessionData);
    } catch (err: unknown) {
      console.error("Login verification failed:", err);
      const errObj = (err && typeof err === 'object') ? (err as { code?: string; message?: string }) : null;
      const errMsg = errObj?.code === 'auth/invalid-credential' 
        ? 'อีเมลผู้ใช้ หรือรหัสผ่านไม่ถูกต้อง'
        : errObj?.code === 'auth/user-not-found'
        ? 'ไม่พบผู้ใช้นี้ในระบบ'
        : errObj?.code === 'auth/wrong-password'
        ? 'รหัสผ่านไม่ถูกต้อง'
        : (errObj?.message || 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ');
      setErrorMsg(errMsg);
      showToast(errMsg, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-blue-500/10 blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="w-full mx-auto px-6 py-4 flex justify-between items-center border-b border-slate-800 z-10">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-600/20 text-emerald-400 p-2 rounded-xl border border-emerald-500/30">
            <Shield className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              Bank of School <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30">MVP</span>
            </h1>
          </div>
        </div>
      </header>

      {/* Login Box */}
      <main className="flex-grow flex items-center justify-center p-6 z-10">
        <div className="w-full max-w-md bg-slate-800/80 backdrop-blur-lg rounded-2xl border border-slate-700/60 shadow-2xl p-8">
          <div className="text-center mb-8">
            <span className="inline-block text-4xl mb-3">🏦</span>
            <h2 className="text-2xl font-extrabold text-white">เข้าสู่ระบบจัดการบัญชี</h2>
            <p className="text-sm text-slate-400 mt-1">เฉพาะคุณครูผู้ดูแลระบบที่ได้รับอนุญาต</p>
          </div>

          {errorMsg && (
            <div className="mb-6 p-4 bg-rose-900/30 border border-rose-500/30 rounded-xl text-sm text-rose-300 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleLogin} noValidate className="space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 uppercase block">อีเมลคุณครู</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500"><Mail className="w-5 h-5" /></span>
                <input
                  type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@school.ac.th" disabled={isLoading}
                  className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl py-3 pl-11 pr-4 text-white placeholder-slate-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-sm"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-slate-300 uppercase block">รหัสผ่านบัญชี</label>
              </div>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500"><Lock className="w-5 h-5" /></span>
                <input
                  type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" disabled={isLoading}
                  className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl py-3 pl-11 pr-12 text-white placeholder-slate-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-sm"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} disabled={isLoading} className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-white">
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={isLoading} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-emerald-900/20 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50">
              {isLoading ? <span>กำลังตรวจสอบสิทธิ์...</span> : <><LogIn className="w-5 h-5" /><span>เข้าสู่ระบบอย่างปลอดภัย</span></>}
            </button>
          </form>
        </div>
      </main>

      <footer className="w-full text-center py-4 text-xs text-slate-500 border-t border-slate-800 z-10 bg-slate-900">
        <p>© 2569 Bank of School. สงวนลิขสิทธิ์เฉพาะสถาบันการศึกษา</p>
      </footer>
    </div>
  );
}
