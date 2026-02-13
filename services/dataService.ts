
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
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { auth, db } from '../firebase';
import { AttendanceRecord, User, MonthlyReport, Project, ShiftSchedule } from '../types';

const USERS = 'users';
const ATTENDANCE = 'attendance';
const PROJECTS = 'projects';
const SHIFTS = 'shifts';
const SETTINGS = 'settings';

class DataService {
  private currentUser: User | null = null;

  getCurrentUser() {
    return this.currentUser;
  }

  private ensureAdmin() {
    if (!this.currentUser || this.currentUser.role !== 'admin') {
      throw new Error("PERMISSION_DENIED: Admin privileges required.");
    }
  }

  private ensureAuth() {
    if (!this.currentUser) {
      throw new Error("UNAUTHORIZED: Please sign in.");
    }
  }

  /* 🔐 AUTHENTICATION */
  async login(email: string, password: string): Promise<User> {
    const cred = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
    const snap = await getDoc(doc(db, USERS, cred.user.uid));
    if (!snap.exists()) throw new Error('User profile missing.');
    const data = snap.data();
    const user: User = { id: cred.user.uid, email: cred.user.email || '', ...data } as User;
    this.currentUser = user;
    return user;
  }

  async signup(email: string, password: string, name: string, employeeId: string, department: string): Promise<User> {
    const cred = await createUserWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
    const userData = {
      name, email, employeeId, department,
      role: 'employee', grossSalary: 0, company: 'Absar Alomran',
      standardHours: 0, disableOvertime: true, disableDeductions: false,
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`
    };
    await setDoc(doc(db, USERS, cred.user.uid), userData);
    const user = { id: cred.user.uid, ...userData } as User;
    this.currentUser = user;
    return user;
  }

  initAuth(onUser: (user: User | null) => void) {
    onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) { this.currentUser = null; onUser(null); return; }
      const snap = await getDoc(doc(db, USERS, fbUser.uid));
      if (!snap.exists()) { onUser(null); return; }
      this.currentUser = { id: fbUser.uid, email: fbUser.email || '', ...snap.data() } as User;
      await this.processAutoClosures(fbUser.uid);
      onUser(this.currentUser);
    });
  }

  async logout() {
    await signOut(auth);
    this.currentUser = null;
  }

  /* ⚙️ GLOBAL SETTINGS - RESOLVING PERSISTENCE & PERMISSION ERRORS */
  async getGlobalSettings(): Promise<{ standardHours: number }> {
    try {
      const snap = await getDoc(doc(db, SETTINGS, 'global_config'));
      if (snap.exists()) {
        const data = snap.data();
        return { standardHours: Number(data.standardHours) || 225 };
      }
    } catch (e) {
      console.warn("Settings fetch failed, using default 225.");
    }
    return { standardHours: 225 };
  }

  async saveGlobalSettings(settings: { standardHours: number }) {
    this.ensureAdmin();
    const ref = doc(db, SETTINGS, 'global_config');
    // We use setDoc with merge: true to ensure the document is created or updated reliably
    await setDoc(ref, {
      standardHours: Number(settings.standardHours),
      updatedAt: serverTimestamp(),
      updatedBy: this.currentUser?.id
    }, { merge: true });
  }

  /* 🕒 AUTO-CLOSE ENGINE */
  async processAutoClosures(userId: string) {
    const q = query(collection(db, ATTENDANCE), where('userId', '==', userId), where('checkOut', '==', null));
    const snap = await getDocs(q);
    const now = new Date();
    const batch = writeBatch(db);
    let count = 0;
    snap.docs.forEach(d => {
      const data = d.data();
      const checkIn = this.convertToDate(data.checkIn);
      if (!checkIn) return;
      if (checkIn.toDateString() !== now.toDateString() && checkIn < now) {
        const autoCloseTime = new Date(checkIn);
        autoCloseTime.setHours(23, 59, 59, 999);
        const duration = (autoCloseTime.getTime() - checkIn.getTime()) / 60000;
        batch.update(d.ref, {
          checkOut: Timestamp.fromDate(autoCloseTime),
          duration: duration > 0 ? duration : 0,
          autoClosed: true,
          needsReview: true
        });
        count++;
      }
    });
    if (count > 0) await batch.commit();
  }

  /* ⏱️ ATTENDANCE ACTIONS */
  async checkIn(user: User, location?: { lat: number, lng: number, accuracy?: number }, projectId?: string) {
    this.ensureAuth();
    await addDoc(collection(db, ATTENDANCE), {
      userId: user.id,
      userName: user.name,
      checkIn: serverTimestamp(),
      projectId: projectId || null,
      location: location || null,
      needsReview: false
    });
  }

  async checkOut(recordId: string, location?: { lat: number, lng: number, accuracy?: number }, outsideGeofence: boolean = false) {
    this.ensureAuth();
    const snap = await getDoc(doc(db, ATTENDANCE, recordId));
    if (!snap.exists()) return;
    const data = snap.data();
    const checkIn = this.convertToDate(data.checkIn) || new Date();
    const checkOut = new Date();
    const duration = (checkOut.getTime() - checkIn.getTime()) / 60000;
    await updateDoc(doc(db, ATTENDANCE, recordId), {
      checkOut: serverTimestamp(),
      checkOutLocation: location || null,
      duration: duration > 0 ? duration : 0,
      needsReview: outsideGeofence 
    });
  }

  private convertToDate(val: any): Date | undefined {
    if (val instanceof Timestamp) return val.toDate();
    if (val?.seconds) return new Date(val.seconds * 1000);
    return val instanceof Date ? val : undefined;
  }

  async getAttendanceHistory(userId: string): Promise<AttendanceRecord[]> {
    this.ensureAuth();
    const q = query(collection(db, ATTENDANCE), where('userId', '==', userId), orderBy('checkIn', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => {
      const r = d.data();
      const checkIn = this.convertToDate(r.checkIn) || new Date(0);
      const checkOut = this.convertToDate(r.checkOut);
      
      // FIX: Calculate duration if missing or invalid
      let duration = Number(r.duration);
      if ((!duration || isNaN(duration)) && checkOut) {
        duration = (checkOut.getTime() - checkIn.getTime()) / 60000;
      }

      return { id: d.id, ...r, checkIn, checkOut, duration } as AttendanceRecord;
    });
  }

  /* 🏗️ PROJECT ACTIONS */
  async getProjects(userId?: string): Promise<Project[]> {
    this.ensureAuth();
    let q = userId 
      ? query(collection(db, PROJECTS), where('assignedUserIds', 'array-contains', userId))
      : query(collection(db, PROJECTS));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Project));
  }

  async saveProject(project: Partial<Project>) {
    this.ensureAdmin();
    if (project.id) {
      const { id, ...data } = project;
      await updateDoc(doc(db, PROJECTS, id), data);
    } else {
      await addDoc(collection(db, PROJECTS), project);
    }
  }

  async deleteProject(id: string) {
    this.ensureAdmin();
    await deleteDoc(doc(db, PROJECTS, id));
  }

  /* 👥 ADMIN TOOLS */
  async getUsers(): Promise<User[]> {
    this.ensureAdmin();
    const snap = await getDocs(collection(db, USERS));
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as User));
  }

  async getAllAttendance(): Promise<AttendanceRecord[]> {
    this.ensureAdmin();
    const snap = await getDocs(collection(db, ATTENDANCE));
    return snap.docs.map(d => {
      const r = d.data();
      const cin = this.convertToDate(r.checkIn);
      const cout = this.convertToDate(r.checkOut);
      let duration = Number(r.duration);
      if ((!duration || isNaN(duration)) && cin && cout) {
        duration = (cout.getTime() - cin.getTime()) / 60000;
      }
      return { id: d.id, ...r, checkIn: cin, checkOut: cout, duration } as AttendanceRecord;
    });
  }

  async getMonthlyReports(from?: Date, to?: Date): Promise<MonthlyReport[]> {
    this.ensureAdmin();
    const snap = await getDocs(collection(db, ATTENDANCE));
    const users = await this.getUsers();
    const grouped: Record<string, MonthlyReport> = {};

    snap.docs.forEach(d => {
      const r = d.data();
      const cin = this.convertToDate(r.checkIn);
      const cout = this.convertToDate(r.checkOut);
      if (!cin || !cout) return;
      if (from && cin < from) return;
      if (to && cin > to) return;

      let month = cin.getMonth();
      let year = cin.getFullYear();
      if (cin.getDate() >= 26) { month++; if (month === 12) { month = 0; year++; } }
      const key = `${year}-${month}`;
      grouped[key] ??= { month: new Date(year, month).toLocaleString('default', { month: 'long' }), year, employees: [] };
      const user = users.find(u => u.id === r.userId);
      if (!user) return;
      const pId = r.projectId || 'none';
      let emp = grouped[key].employees.find(e => e.name === user.name && e.projectId === pId);
      if (!emp) {
        emp = { name: user.name, totalHours: 0, shiftCount: 0, projectId: pId, flaggedCount: 0 };
        grouped[key].employees.push(emp);
      }
      emp.shiftCount++;
      emp.totalHours += (cout.getTime() - cin.getTime()) / 3600000;
      if (r.needsReview) emp.flaggedCount++;
    });
    return Object.values(grouped);
  }

  async saveUser(user: Partial<User>) {
    this.ensureAdmin();
    const sanitizedUser = { 
      ...user, 
      grossSalary: Number(user.grossSalary || 0), 
      standardHours: Number(user.standardHours || 0)
    };
    await setDoc(doc(db, USERS, user.id!), sanitizedUser, { merge: true });
  }

  async bulkUpdateDefaultRules() {
    this.ensureAdmin();
    const snap = await getDocs(collection(db, USERS));
    const batch = writeBatch(db);
    snap.docs.forEach(d => {
      const data = d.data();
      batch.update(d.ref, {
        disableOvertime: data.disableOvertime ?? true,
        disableDeductions: data.disableDeductions ?? false,
        standardHours: Number(data.standardHours || 0),
        grossSalary: Number(data.grossSalary || 0),
        company: data.company ?? 'Absar Alomran'
      });
    });
    await batch.commit();
  }

  async deleteUser(id: string) {
    this.ensureAdmin();
    await deleteDoc(doc(db, USERS, id));
  }

  async getShiftSchedules(): Promise<ShiftSchedule[]> {
    const snap = await getDocs(collection(db, SHIFTS));
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as ShiftSchedule));
  }

  async saveShiftSchedule(shift: Partial<ShiftSchedule>) {
    this.ensureAdmin();
    if (shift.id) {
      await updateDoc(doc(db, SHIFTS, shift.id), shift);
    } else {
      await addDoc(collection(db, SHIFTS), shift);
    }
  }

  async deleteShiftSchedule(id: string) {
    this.ensureAdmin();
    await deleteDoc(doc(db, SHIFTS, id));
  }

  async updateAttendanceRecord(id: string, updates: { checkIn: Date, checkOut?: Date }) {
    this.ensureAdmin();
    const duration = updates.checkOut ? (updates.checkOut.getTime() - updates.checkIn.getTime()) / 60000 : 0;
    await updateDoc(doc(db, ATTENDANCE, id), {
      checkIn: Timestamp.fromDate(updates.checkIn),
      checkOut: updates.checkOut ? Timestamp.fromDate(updates.checkOut) : null,
      duration: duration > 0 ? duration : 0,
      needsReview: false 
    });
  }

  getRecommendedRules(): string {
    return `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Determine if the request user is an admin
    function isAdmin() {
      return request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }

    match /users/{id} {
      allow read: if request.auth != null && (request.auth.uid == id || isAdmin());
      allow create: if request.auth != null;
      allow update: if request.auth != null && (request.auth.uid == id || isAdmin());
      allow delete: if isAdmin();
    }

    match /attendance/{id} {
      allow read: if request.auth != null && (resource.data.userId == request.auth.uid || isAdmin());
      allow create: if request.auth != null;
      allow update: if request.auth != null && (resource.data.userId == request.auth.uid || isAdmin());
      allow delete: if isAdmin();
    }

    match /projects/{id} {
      allow read: if request.auth != null;
      allow write: if isAdmin();
    }

    match /shifts/{id} {
      allow read: if request.auth != null;
      allow write: if isAdmin();
    }

    match /settings/{id} {
      allow read: if request.auth != null;
      allow write: if isAdmin();
    }
  }
}`;
  }
}

export const dataService = new DataService();
