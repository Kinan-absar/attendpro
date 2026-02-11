
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
  updateDoc,
  setDoc,
  deleteDoc,
  FirestoreError
} from 'firebase/firestore';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { auth, db } from '../firebase';
import { AttendanceRecord, User, MonthlyReport, Project } from '../types';

const USERS = 'users';
const ATTENDANCE = 'attendance';
const PROJECTS = 'projects';

class DataService {
  private currentUser: User | null = null;
  private authInitialized: boolean = false;

  getCurrentUser() {
    return this.currentUser;
  }

  /* 🔐 LOGIN */
  async login(email: string, password: string): Promise<User> {
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const snap = await getDoc(doc(db, USERS, cred.user.uid));
      if (!snap.exists()) throw new Error('User profile missing in database');
      const data = snap.data();
      const user: User = {
        id: cred.user.uid,
        email: cred.user.email!,
        name: data.name,
        employeeId: data.employeeId,
        department: data.department,
        role: data.role,
        avatar: data.avatar
      };
      this.currentUser = user;
      return user;
    } catch (error) {
      console.error("Login failed:", error);
      throw error;
    }
  }

  initAuth(onUser: (user: User | null) => void) {
    onAuthStateChanged(auth, async (firebaseUser) => {
      this.authInitialized = true;
      if (!firebaseUser) {
        this.currentUser = null;
        onUser(null);
        return;
      }
      try {
        const snap = await getDoc(doc(db, USERS, firebaseUser.uid));
        if (!snap.exists()) {
          console.error("Authenticated but no document in 'users' collection for UID:", firebaseUser.uid);
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
          role: data.role,
          avatar: data.avatar
        };
        this.currentUser = user;
        onUser(user);
      } catch (error) {
        this.handleFirestoreError(error, "Auth Initialization");
        onUser(null);
      }
    });
  }

  async logout() {
    try {
      await signOut(auth);
      this.currentUser = null;
    } catch (error) {
      console.error("Logout failed:", error);
    }
  }

  /* ⏱️ CHECK IN */
  async checkIn(user: User, location?: { lat: number, lng: number, accuracy?: number }) {
    try {
      await addDoc(collection(db, ATTENDANCE), {
        userId: user.id,
        userName: user.name,
        checkIn: serverTimestamp(),
        location: location || null
      });
    } catch (error) {
      this.handleFirestoreError(error, "Check-in Attempt");
      throw error;
    }
  }

  /* ⏱️ CHECK OUT */
  async checkOut(recordId: string, location?: { lat: number, lng: number, accuracy?: number }) {
    try {
      await updateDoc(doc(db, ATTENDANCE, recordId), {
        checkOut: serverTimestamp(),
        checkOutLocation: location || null
      });
    } catch (error) {
      this.handleFirestoreError(error, "Check-out Attempt");
      throw error;
    }
  }

  /* 📜 HISTORY */
  async getAttendanceHistory(userId: string): Promise<AttendanceRecord[]> {
    try {
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
          checkIn: r.checkIn?.toDate() || new Date(),
          checkOut: r.checkOut?.toDate(),
          location: r.location,
          duration: r.checkOut && r.checkIn
            ? (r.checkOut.toDate().getTime() - r.checkIn.toDate().getTime()) / 60000
            : undefined
        };
      });
    } catch (error) {
      this.handleFirestoreError(error, "Fetch History");
      return [];
    }
  }

  /* 🏗️ PROJECTS & LOCATIONS */
  async getProjects(userId?: string): Promise<Project[]> {
    if (!this.authInitialized || !this.currentUser) return [];
    
    try {
      let q;
      if (userId) {
        // Employees fetch only their assigned projects
        q = query(collection(db, PROJECTS), where('assignedUserIds', 'array-contains', userId));
      } else {
        // Admins fetch all projects for management
        q = query(collection(db, PROJECTS));
      }
      
      const snap = await getDocs(q);
      return snap.docs.map(d => ({
        id: d.id,
        ...(d.data() as Omit<Project, 'id'>)
      }));
    } catch (error) {
      const fError = error as FirestoreError;
      if (fError.code === 'permission-denied') {
        console.error(`[Security Error] Fetch Projects: Permission Denied. Rule update required.`);
        throw error; // Re-throw so UI can handle
      }
      console.error("Fetch Projects failed:", error);
      return [];
    }
  }

  async saveProject(project: Partial<Project>) {
    try {
      const data = {
        ...project,
        assignedUserIds: project.assignedUserIds || []
      };

      if (project.id) {
        const { id, ...updateData } = data;
        await updateDoc(doc(db, PROJECTS, id), updateData);
      } else {
        await addDoc(collection(db, PROJECTS), data);
      }
    } catch (error) {
      this.handleFirestoreError(error, "Save Project");
      throw error;
    }
  }

  async deleteProject(projectId: string) {
    try {
      await deleteDoc(doc(db, PROJECTS, projectId));
    } catch (error) {
      this.handleFirestoreError(error, "Delete Project");
      throw error;
    }
  }

  /* 👥 USERS (ADMIN) */
  async getUsers(): Promise<User[]> {
    try {
      if (!this.currentUser || this.currentUser.role !== 'admin') return [];
      const snap = await getDocs(collection(db, USERS));
      return snap.docs.map(d => ({
        id: d.id,
        ...(d.data() as Omit<User, 'id'>)
      }));
    } catch (error) {
      this.handleFirestoreError(error, "Fetch Users (Admin)");
      return [];
    }
  }

  /* 📊 REPORTS */
  async getMonthlyReports(from?: Date, to?: Date): Promise<MonthlyReport[]> {
    try {
      if (!this.currentUser || this.currentUser.role !== 'admin') return [];
      
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
        
        let year = checkIn.getFullYear();
        let month = checkIn.getMonth();
        if (checkIn.getDate() >= 26) {
          month += 1;
          if (month === 12) { month = 0; year += 1; }
        }
        const monthName = new Date(year, month).toLocaleString('default', { month: 'long' });
        const key = `${year}-${month}`;
        grouped[key] ??= { month: monthName, year, employees: [] };

        const user = users.find(u => u.id === r.userId);
        if (!user) return;
        let emp = grouped[key].employees.find(e => e.name === user.name);
        if (!emp) {
          emp = { name: user.name, shiftCount: 0, totalHours: 0 };
          grouped[key].employees.push(emp);
        }
        emp.shiftCount++;
        emp.totalHours += (checkOut.getTime() - checkIn.getTime()) / 3600000;
      });
      return Object.values(grouped);
    } catch (error) {
      this.handleFirestoreError(error, "Monthly Reports");
      return [];
    }
  }

  async getAllAttendance(): Promise<AttendanceRecord[]> {
    try {
      if (!this.currentUser || this.currentUser.role !== 'admin') return [];
      const snap = await getDocs(collection(db, ATTENDANCE));
      return snap.docs.map(d => {
        const r = d.data();
        if (!r.checkIn || typeof r.checkIn.toDate !== 'function') return null;
        const checkIn = r.checkIn.toDate();
        const checkOut = r.checkOut?.toDate?.();
        return {
          id: d.id,
          userId: r.userId,
          userName: r.userName,
          checkIn,
          checkOut,
          duration: checkOut ? (checkOut.getTime() - checkIn.getTime()) / 60000 : undefined,
        };
      }).filter(Boolean) as AttendanceRecord[];
    } catch (error) {
      this.handleFirestoreError(error, "Fetch All Attendance");
      return [];
    }
  }

  private handleFirestoreError(error: any, context: string) {
    const fError = error as FirestoreError;
    if (fError && fError.code === 'permission-denied') {
      console.error(`[Security Error] ${context}: Permission Denied. Check Firestore Rules.`);
    } else {
      console.error(`[Database Error] ${context}:`, error);
    }
  }
}

export const dataService = new DataService();
