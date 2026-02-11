
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
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser
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

  /* 🔐 AUTHENTICATION */
  async login(email: string, password: string): Promise<User> {
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const snap = await getDoc(doc(db, USERS, cred.user.uid));
      if (!snap.exists()) throw new Error('User profile missing in database. Please sign up again.');
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

  async signup(email: string, password: string, name: string, employeeId: string, department: string): Promise<User> {
    let cred;
    try {
      cred = await createUserWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error("Auth Signup failed:", error);
      throw error;
    }

    try {
      const userId = cred.user.uid;
      const userData = {
        name,
        email,
        employeeId,
        department,
        role: 'employee',
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`
      };

      await setDoc(doc(db, USERS, userId), userData);
      
      const user: User = { id: userId, ...userData } as User;
      this.currentUser = user;
      return user;
    } catch (error) {
      console.error("Firestore Profile Creation failed:", error);
      if (cred?.user) await signOut(auth);
      throw error;
    }
  }

  initAuth(onUser: (user: User | null) => void) {
    onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      this.authInitialized = true;
      if (!firebaseUser) {
        this.currentUser = null;
        onUser(null);
        return;
      }
      try {
        const snap = await getDoc(doc(db, USERS, firebaseUser.uid));
        if (!snap.exists()) {
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

  /* ⏱️ ATTENDANCE ACTIONS */
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

  async getProjects(userId?: string): Promise<Project[]> {
    try {
      let q;
      if (userId) {
        q = query(collection(db, PROJECTS), where('assignedUserIds', 'array-contains', userId));
      } else {
        q = query(collection(db, PROJECTS));
      }
      const snap = await getDocs(q);
      return snap.docs.map(d => ({
        id: d.id,
        ...(d.data() as Omit<Project, 'id'>)
      }));
    } catch (error) {
      this.handleFirestoreError(error, "Fetch Projects");
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

  async getUsers(): Promise<User[]> {
    try {
      const snap = await getDocs(collection(db, USERS));
      return snap.docs.map(d => ({
        id: d.id,
        ...(d.data() as Omit<User, 'id'>)
      }));
    } catch (error) {
      this.handleFirestoreError(error, "Fetch Users");
      return [];
    }
  }

  async saveUser(user: Partial<User>) {
    try {
      if (!this.currentUser || this.currentUser.role !== 'admin') throw new Error("Unauthorized: Admin role required");
      
      const userId = user.id || doc(collection(db, USERS)).id;
      const userRef = doc(db, USERS, userId);
      
      const data = {
        name: user.name || '',
        email: user.email || '',
        employeeId: user.employeeId || '',
        department: user.department || '',
        role: user.role || 'employee',
        avatar: user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || '')}&background=random`
      };

      await setDoc(userRef, data, { merge: true });
      return { id: userId, ...data };
    } catch (error) {
      this.handleFirestoreError(error, "Save User");
      throw error;
    }
  }

  async deleteUser(userId: string) {
    try {
      if (!this.currentUser || this.currentUser.role !== 'admin') throw new Error("Unauthorized: Admin role required");
      await deleteDoc(doc(db, USERS, userId));
    } catch (error) {
      this.handleFirestoreError(error, "Delete User");
      throw error;
    }
  }

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
    if (fError && (fError.code === 'permission-denied' || fError.message?.includes('permission'))) {
      console.error(`[Security Error] ${context}: Permission Denied. Check your Firestore Security Rules.`);
    } else if (fError && fError.code === 'failed-precondition') {
      console.error(`[Index Error] ${context}: Missing index. Check your browser console for a link to create it.`);
    } else {
      console.error(`[Database Error] ${context}:`, error);
    }
  }

  getRecommendedRules(): string {
    return `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAdmin() {
      return request.auth != null && 
             exists(/databases/$(database)/documents/users/$(request.auth.uid)) && 
             get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }

    match /users/{userId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null && request.auth.uid == userId;
      allow update, delete: if request.auth != null && (request.auth.uid == userId || isAdmin());
    }

    match /attendance/{docId} {
      allow read, create: if request.auth != null;
      allow update, delete: if request.auth != null && (resource.data.userId == request.auth.uid || isAdmin());
    }

    match /projects/{docId} {
      allow read: if request.auth != null;
      allow write: if isAdmin();
    }
  }
}`;
  }
}

export const dataService = new DataService();
