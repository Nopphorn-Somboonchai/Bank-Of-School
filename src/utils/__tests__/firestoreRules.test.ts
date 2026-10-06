import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import fs from 'fs';
import path from 'path';
import net from 'net';
import { doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';

function isEmulatorReachable(host = '127.0.0.1', port = 8080): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(800);
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, host);
  });
}

describe('Firestore Security Rules Test Suite', async () => {
  const emulatorRunning = await isEmulatorReachable();
  const testSuite = emulatorRunning ? describe : describe.skip;

  if (!emulatorRunning) {
    it.skip('Firestore emulator is offline on 127.0.0.1:8080. Start with: firebase emulators:start --only firestore', () => {});
  }

  testSuite('Emulator Security Assertions', () => {
    let testEnv: RulesTestEnvironment;
    const appId = 'school-demo';
    const rules = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf8');

    beforeAll(async () => {
      testEnv = await initializeTestEnvironment({
        projectId: 'bank-of-school-rules-test',
        firestore: {
          rules,
          host: '127.0.0.1',
          port: 8080,
        },
      });
    });

    afterAll(async () => {
      if (testEnv) {
        await testEnv.cleanup();
      }
    });

    beforeEach(async () => {
      if (testEnv) {
        await testEnv.clearFirestore();
      }
    });

    it('Privilege Escalation Prevention: self-create as Admin without placeholder must FAIL', async () => {
      const teacherContext = testEnv.authenticatedContext('user_123', {
        email: 'teacher@school.ac.th',
      });
      const db = teacherContext.firestore();
      const userDocRef = doc(db, 'artifacts', appId, 'users', 'user_123');

      await assertFails(
        setDoc(userDocRef, {
          email: 'teacher@school.ac.th',
          fullName: 'Malicious User',
          role: 'Admin', // Escalation attempt
          status: 'Active',
        })
      );
    });

    it('Self-create with default Teacher / Active role must SUCCEED', async () => {
      const teacherContext = testEnv.authenticatedContext('user_123', {
        email: 'teacher@school.ac.th',
      });
      const db = teacherContext.firestore();
      const userDocRef = doc(db, 'artifacts', appId, 'users', 'user_123');

      await assertSucceeds(
        setDoc(userDocRef, {
          email: 'teacher@school.ac.th',
          fullName: 'Valid Teacher',
          role: 'Teacher',
          status: 'Active',
        })
      );
    });

    it('Financial Protection: Account with negative balance must FAIL', async () => {
      // Seed teacher account
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), 'artifacts', appId, 'users', 'teacher_1'), {
          email: 'teacher@school.ac.th',
          role: 'Teacher',
          status: 'Active',
        });
      });

      const teacherContext = testEnv.authenticatedContext('teacher_1', {
        email: 'teacher@school.ac.th',
      });
      const db = teacherContext.firestore();
      const accountRef = doc(db, 'artifacts', appId, 'accounts', 'ACC001');

      await assertFails(
        setDoc(accountRef, {
          accountId: 'ACC001',
          studentId: 'STD001',
          currentBalance: -500, // Invalid negative balance
          status: 'Active',
        })
      );
    });

    it('Immutability: Transaction must NOT be editable or deletable', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), 'artifacts', appId, 'users', 'teacher_1'), {
          email: 'teacher@school.ac.th',
          role: 'Teacher',
          status: 'Active',
        });
        await setDoc(doc(context.firestore(), 'artifacts', appId, 'transactions', 'TX001'), {
          transactionId: 'TX001',
          amount: 100,
          balanceAfter: 500,
        });
      });

      const teacherContext = testEnv.authenticatedContext('teacher_1', {
        email: 'teacher@school.ac.th',
      });
      const db = teacherContext.firestore();
      const txRef = doc(db, 'artifacts', appId, 'transactions', 'TX001');

      await assertFails(updateDoc(txRef, { amount: 200 }));
      await assertFails(deleteDoc(txRef));
    });

    it('Soft Delete Policy: Students must NOT be hard-deleted', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), 'artifacts', appId, 'users', 'teacher_1'), {
          email: 'teacher@school.ac.th',
          role: 'Teacher',
          status: 'Active',
        });
        await setDoc(doc(context.firestore(), 'artifacts', appId, 'students', 'STD001'), {
          studentId: 'STD001',
          fullName: 'Test Student',
          status: 'Active',
        });
      });

      const teacherContext = testEnv.authenticatedContext('teacher_1', {
        email: 'teacher@school.ac.th',
      });
      const db = teacherContext.firestore();
      const studentRef = doc(db, 'artifacts', appId, 'students', 'STD001');

      await assertFails(deleteDoc(studentRef));
    });
  });
});
