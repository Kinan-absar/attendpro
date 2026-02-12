
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
  FirestoreError,
  Timestamp,
  arrayUnion
} from 'firebase/firestore';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { auth, db } from '../firebase';
import { AttendanceRecord, User, MonthlyReport, Project, MobilityLog } from '../types';

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
      if (!snap.exists()) throw new Error('User profile missing in database.');
      const data = snap.data();
      const user: User = {
        id: cred.user.uid,
        email: cred.user.email || '',
        name: data.name || 'Unknown User',
        employeeId: data.employeeId || 'N/A',
        department: data.department || 'General',
        role: data.role || 'employee',
        avatar: data.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(data.name || 'U')}`
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
      throw error;
    }

    try {
      const userId = cred.user.uid;
      const userData = {
        name: name || '',
        email: email || '',
        employeeId: employeeId || '',
        department: department || '',
        role: 'employee',
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'U')}&background=random`
      };

      await setDoc(doc(db, USERS, userId), userData);
      const user: User = { id: userId, ...userData } as User;
      this.currentUser = user;
      return user;
    } catch (error) {
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
          email: firebaseUser.email || '',
          name: data.name || 'Unknown User',
          employeeId: data.employeeId || 'N/A',
          department: data.department || 'General',
          role: data.role || 'employee',
          avatar: data.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(data.name || 'U')}`
        };
        this.currentUser = user;
        onUser(user);
      } catch (error) {
        onUser(null);
      }
    });
  }

  async logout() {
    await signOut(auth);
    this.currentUser = null;
  }

  /* ⏱️ ATTENDANCE ACTIONS */
  async checkIn(user: User, location?: { lat: number, lng: number, accuracy?: number }) {
    await addDoc(collection(db, ATTENDANCE), {
      userId: user.id,
      userName: user.name,
      checkIn: serverTimestamp(),
      location: location || null,
      mobilityLogs: [{
        timestamp: new Date(),
        status: 'inside'
      }]
    });
  }

  async checkOut(recordId: string, location?: { lat: number, lng: number, accuracy?: number }) {
    await updateDoc(doc(db, ATTENDANCE, recordId), {
      checkOut: serverTimestamp(),
      checkOutLocation: location || null
    });
  }

  /* 📍 TRACKER ACTIONS (AUTO-LOG ENTRY/EXIT) */
  async logMobilityEvent(recordId: string, status: 'inside' | 'outside') {
    try {
      await updateDoc(doc(db, ATTENDANCE, recordId), {
        mobilityLogs: arrayUnion({
          timestamp: new Date(),
          status
        })
      });
    } catch (error) {
      console.error("Mobility log failed:", error);
    }
  }

  /* 🛠️ ADMIN CORRECTIONS */
  async updateAttendanceRecord(recordId: string, updates: { checkIn: Date, checkOut?: Date }) {
    const duration = updates.checkOut 
      ? (updates.checkOut.getTime() - updates.checkIn.getTime()) / 60000 
      : 0;

    await updateDoc(doc(db, ATTENDANCE, recordId), {
      checkIn: Timestamp.fromDate(updates.checkIn),
      checkOut: updates.checkOut ? Timestamp.fromDate(updates.checkOut) : null,
      duration: duration > 0 ? duration : 0
    });
  }

  private convertToDate(val: any): Date | undefined {
    if (val instanceof Timestamp) return val.toDate();
    if (val?.seconds) return new Date(val.seconds * 1000);
    if (val instanceof Date) return val;
    if (typeof val === 'string' || typeof val === 'number') return new Date(val);
    return undefined; // Strictly return undefined if missing
  }

  async getAttendanceHistory(userId: string): Promise<AttendanceRecord[]> {
    const q = query(
      collection(db, ATTENDANCE),
      where('userId', '==', userId),
      orderBy('checkIn', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => {
      const r = d.data();
      const checkIn = this.convertToDate(r.checkIn);
      const checkOut = r.checkOut ? this.convertToDate(r.checkOut) : undefined;
      return {
        id: d.id,
        userId: r.userId || '',
        userName: r.userName || 'Unknown',
        checkIn: checkIn || new Date(0), // Provide safe fallback for UI but filter handled elsewhere
        checkOut,
        location: r.location,
        mobilityLogs: (r.mobilityLogs || []).map((l: any) => ({
          ...l,
          timestamp: this.convertToDate(l.timestamp) || new Date()
        })),
        duration: r.duration || (checkIn && checkOut ? (checkOut.getTime() - checkIn.getTime()) / 60000 : undefined)
      };
    });
  }

  async getProjects(userId?: string): Promise<Project[]> {
    let q = userId 
      ? query(collection(db, PROJECTS), where('assignedUserIds', 'array-contains', userId))
      : query(collection(db, PROJECTS));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({
      id: d.id,
      ...(d.data() as Omit<Project, 'id'>)
    }));
  }

  async saveProject(project: Partial<Project>) {
    const data = { ...project, assignedUserIds: project.assignedUserIds || [] };
    if (project.id) {
      const { id, ...updateData } = data;
      await updateDoc(doc(db, PROJECTS, id), updateData);
    } else {
      await addDoc(collection(db, PROJECTS), data);
    }
  }

  async deleteProject(projectId: string) {
    await deleteDoc(doc(db, PROJECTS, projectId));
  }

  async getUsers(): Promise<User[]> {
    const snap = await getDocs(collection(db, USERS));
    return snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        email: data.email || '',
        name: data.name || '',
        employeeId: data.employeeId || '',
        department: data.department || '',
        role: data.role || 'employee',
        avatar: data.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(data.name || 'U')}`
      };
    });
  }

  async saveUser(user: Partial<User>) {
    if (this.currentUser?.role !== 'admin') throw new Error("Unauthorized");
    const userId = user.id || doc(collection(db, USERS)).id;
    const data = {
      name: user.name?.trim(),
      email: user.email?.trim().toLowerCase(),
      employeeId: user.employeeId?.trim(),
      department: (user.department || '').trim(),
      role: user.role || 'employee',
      avatar: user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name?.trim() || 'U')}&background=random`
    };
    await setDoc(doc(db, USERS, userId), data, { merge: true });
    return { id: userId, ...data };
  }

  async deleteUser(userId: string) {
    if (this.currentUser?.role !== 'admin') throw new Error("Unauthorized");
    await deleteDoc(doc(db, USERS, userId));
  }

  async getMonthlyReports(from?: Date, to?: Date): Promise<MonthlyReport[]> {
    if (this.currentUser?.role !== 'admin') return [];
    const attendance = await getDocs(collection(db, ATTENDANCE));
    const users = await this.getUsers();
    const grouped: Record<string, MonthlyReport> = {};

    attendance.docs.forEach(docSnap => {
      const r = docSnap.data();
      const checkIn = this.convertToDate(r.checkIn);
      const checkOut = this.convertToDate(r.checkOut);
      if (!checkIn || !checkOut) return;
      
      if (from && checkIn < from) return;
      if (to && checkIn > to) return;
      
      let year = checkIn.getFullYear();
      let month = checkIn.getMonth();
      if (checkIn.getDate() >= 26) {
        month += 1;
        if (month === 12) { month = 0; year += 1; }
      }
      const key = `${year}-${month}`;
      grouped[key] ??= { 
        month: new Date(year, month).toLocaleString('default', { month: 'long' }), 
        year, 
        employees: [] 
      };

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
  }

  async getAllAttendance(): Promise<AttendanceRecord[]> {
    if (this.currentUser?.role !== 'admin') return [];
    const snap = await getDocs(collection(db, ATTENDANCE));
    return snap.docs.map(d => {
      const r = d.data();
      const checkIn = this.convertToDate(r.checkIn);
      const checkOut = r.checkOut ? this.convertToDate(r.checkOut) : undefined;
      return {
        id: d.id,
        userId: r.userId || '',
        userName: r.userName || 'Unknown',
        checkIn: checkIn || new Date(0),
        checkOut,
        duration: r.duration || (checkIn && checkOut ? (checkOut.getTime() - checkIn.getTime()) / 60000 : undefined),
        mobilityLogs: (r.mobilityLogs || []).map((l: any) => ({
          ...l,
          timestamp: this.convertToDate(l.timestamp) || new Date()
        }))
      };
    });
  }

  getRecommendedRules(): string {
    return `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}`;
  }
}

export const dataService = new DataService();
