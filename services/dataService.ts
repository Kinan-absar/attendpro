import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  doc,
  getDoc,
  updateDoc
} from 'firebase/firestore';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { auth, db } from '../firebase';
import { AttendanceRecord, User, MonthlyReport } from '../types';

const USERS = 'users';
const ATTENDANCE = 'attendance';

class DataService {
  private currentUser: User | null = null;

  getCurrentUser() {
    return this.currentUser;
  }

  /* 🔐 LOGIN */
  async login(email: string, password: string): Promise<User> {
    const cred = await signInWithEmailAndPassword(auth, email, password);

    const snap = await getDoc(doc(db, USERS, cred.user.uid));
    if (!snap.exists()) throw new Error('User profile missing');

    const data = snap.data();

    const user: User = {
      id: cred.user.uid,
      email: cred.user.email!,
      name: data.name,
      employeeId: data.employeeId,
      department: data.department,
      role: data.role, // 🔥 admin / employee
      avatar: data.avatar
    };

    this.currentUser = user;
    return user;
  }

  /* 🔄 AUTH REHYDRATION (FIXES ADMIN UI ISSUE) */
  initAuth(onUser: (user: User | null) => void) {
    onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        this.currentUser = null;
        onUser(null);
        return;
      }

      const snap = await getDoc(doc(db, USERS, firebaseUser.uid));
      if (!snap.exists()) {
        console.error('User profile missing');
        onUser(null);
        return;
      }

      const data = snap.data();

      const user: User = {
        id: firebaseUser.uid,
        email: firebaseUser.email!,
        name: data.name,
        employeeId: data.employeeId,
        department: data.department,
        role: data.role, // ✅ ADMIN FLAG
        avatar: data.avatar
      };

      this.currentUser = user;
      onUser(user);
    });
  }

  async logout() {
    await signOut(auth);
    this.currentUser = null;
  }

  /* ⏱️ CHECK IN */
  async checkIn(user: User) {
    await addDoc(collection(db, ATTENDANCE), {
      userId: user.id,
      userName: user.name,
      checkIn: serverTimestamp()
    });
  }

  /* ⏱️ CHECK OUT — FIXED */
  async checkOut(recordId: string) {
    await updateDoc(doc(db, ATTENDANCE, recordId), {
      checkOut: serverTimestamp()
    });
  }

  /* 📜 HISTORY */
  async getAttendanceHistory(userId: string): Promise<AttendanceRecord[]> {
    const q = query(
      collection(db, ATTENDANCE),
      where('userId', '==', userId),
      orderBy('checkIn', 'desc')
    );

    const snap = await getDocs(q);

    return snap.docs.map(d => {
      const r = d.data();
      return {
        id: d.id,
        userId: r.userId,
        userName: r.userName,
        checkIn: r.checkIn.toDate(),
        checkOut: r.checkOut?.toDate(),
        duration: r.checkOut
          ? (r.checkOut.toDate().getTime() - r.checkIn.toDate().getTime()) / 60000
          : undefined
      };
    });
  }

  /* 👥 USERS (ADMIN) */
  async getUsers(): Promise<User[]> {
    const snap = await getDocs(collection(db, USERS));
    return snap.docs.map(d => ({
      id: d.id,
      ...(d.data() as Omit<User, 'id'>)
    }));
  }

  /* 📊 REPORTS */
    async getMonthlyReports(from?: Date, to?: Date): Promise<MonthlyReport[]> {
      const attendance = await getDocs(collection(db, ATTENDANCE));
      const users = await this.getUsers();

      const grouped: Record<string, MonthlyReport> = {};

      attendance.docs.forEach(docSnap => {
        const r = docSnap.data();
        if (!r.checkIn || !r.checkOut) return;

        const checkIn = r.checkIn.toDate();
        const checkOut = r.checkOut.toDate();
        
        if (from && checkIn < from) return;
        if (to && checkIn > to) return;
        // 🔥 Payroll month logic (26 → 25)
        let year = checkIn.getFullYear();
        let month = checkIn.getMonth();

        if (checkIn.getDate() >= 26) {
          month += 1;
          if (month === 12) {
            month = 0;
            year += 1;
          }
        }

        const monthName = new Date(year, month).toLocaleString('default', {
          month: 'long'
        });

        const key = `${year}-${month}`;

        grouped[key] ??= {
          month: monthName,
          year,
          employees: []
        };

        const user = users.find(u => u.id === r.userId);
        if (!user) return;

        let emp = grouped[key].employees.find(e => e.name === user.name);

        if (!emp) {
          emp = {
            name: user.name,
            shiftCount: 0,
            totalHours: 0
          };
          grouped[key].employees.push(emp);
        }

        emp.shiftCount++;
        emp.totalHours +=
          (checkOut.getTime() - checkIn.getTime()) / 3600000;
      });

      return Object.values(grouped);
      
    }

  async getAllAttendance(): Promise<AttendanceRecord[]> {
    const snap = await getDocs(collection(db, ATTENDANCE));

    return snap.docs
      .map(d => {
        const r = d.data();

        // 🚨 Skip broken records
        if (!r.checkIn || typeof r.checkIn.toDate !== 'function') {
          console.warn('Skipping invalid attendance record:', d.id);
          return null;
        }

        const checkIn = r.checkIn.toDate();
        const checkOut = r.checkOut?.toDate?.();

        return {
          id: d.id,
          userId: r.userId,
          userName: r.userName,
          checkIn,
          checkOut,
          duration: checkOut
            ? (checkOut.getTime() - checkIn.getTime()) / 60000
            : undefined,
        };
      })
      .filter(Boolean) as AttendanceRecord[];
  }


}

export const dataService = new DataService();
