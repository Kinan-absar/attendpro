
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
  getAuth,
  setPersistence,
  inMemoryPersistence,
  User as FirebaseUser
} from 'firebase/auth';
import { initializeApp, deleteApp } from 'firebase/app';
import { auth, db, firebaseConfig } from '../firebase';
import { AttendanceRecord, User, MonthlyReport, Project, ShiftSchedule, Holiday, Broadcast } from '../types';

const USERS = 'users';
const ATTENDANCE = 'attendance';
const PROJECTS = 'projects';
const SHIFTS = 'shifts';
const SETTINGS = 'settings';
const HOLIDAYS = 'holidays';
const BROADCASTS = 'broadcasts';

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

  /**
   * Deeply sanitizes an object to ensure it only contains Firestore-compatible primitives.
   * Prevents "Circular structure to JSON" errors by identifying plain objects vs class instances.
   */
  private sanitize(data: any): any {
    if (data === null || data === undefined) return data;
    
    const type = typeof data;
    if (type !== 'object') return data;
    
    // Pass through native safe types
    if (data instanceof Date || data instanceof Timestamp) return data;
    
    // Check for plain objects vs Class instances (like FieldValue or internal SDK objects)
    // We only want to recurse into plain objects/arrays.
    const proto = Object.getPrototypeOf(data);
    const isPlainObject = proto === null || proto === Object.prototype;

    if (Array.isArray(data)) {
      return data.map(v => this.sanitize(v));
    }

    if (!isPlainObject) {
      // This is a class instance (like FieldValue for serverTimestamp). Pass it through.
      return data;
    }

    const sanitized: any = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        sanitized[key] = this.sanitize(data[key]);
      }
    }
    return sanitized;
  }

  /* 🔐 AUTHENTICATION */
  async login(email: string, password: string): Promise<User> {
    const cred = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
    const snap = await getDoc(doc(db, USERS, cred.user.uid));
    if (!snap.exists()) throw new Error('User profile missing in Firestore.');
    const data = snap.data();
    const user: User = { id: cred.user.uid, email: cred.user.email || '', ...data } as User;
    this.currentUser = user;
    return user;
  }

  async adminCreateUser(userData: Partial<User>, password: string) {
    this.ensureAdmin();
    
    const normalizedEmail = (userData.email || '').trim().toLowerCase();
    const appName = `AdminUserCreator-${Date.now()}`;
    const secondaryApp = initializeApp(firebaseConfig, appName);
    const secondaryAuth = getAuth(secondaryApp);

    try {
      await setPersistence(secondaryAuth, inMemoryPersistence);
      const cred = await createUserWithEmailAndPassword(secondaryAuth, normalizedEmail, password);
      const uid = cred.user.uid;

      const userProfile = {
        name: userData.name || 'New Staff',
        email: normalizedEmail,
        employeeId: userData.employeeId || 'EMP-TEMP',
        department: userData.department || 'Operations',
        role: userData.role || 'employee',
        grossSalary: Number(userData.grossSalary || 0),
        standardHours: Number(userData.standardHours || 0),
        company: userData.company || 'Absar Alomran',
        disableOvertime: userData.disableOvertime ?? true,
        disableDeductions: userData.disableDeductions ?? false,
        avatar: userData.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.name || 'User')}&background=random`
      };

      await setDoc(doc(db, USERS, uid), this.sanitize(userProfile));
      return uid;
    } finally {
      await deleteApp(secondaryApp);
    }
  }

  initAuth(onUser: (user: User | null) => void) {
    onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) { this.currentUser = null; onUser(null); return; }
      const snap = await getDoc(doc(db, USERS, fbUser.uid));
      if (!snap.exists()) { onUser(null); return; }
      this.currentUser = { id: fbUser.uid, email: fbUser.email || '', ...snap.data() } as User;
      
      try {
        if (this.currentUser.role === 'admin') {
          await this.processAllAutoClosures();
        } else {
          await this.processAutoClosures(fbUser.uid);
        }
      } catch (e) {
        console.error("Auth init auto-close error:", e);
      }
      
      onUser(this.currentUser);
    });
  }

  async logout() {
    await signOut(auth);
    this.currentUser = null;
  }

  /* 🕒 AUTO-CLOSE ENGINE */
  async processAllAutoClosures(): Promise<boolean> {
    try {
      this.ensureAdmin();
      const q = query(collection(db, ATTENDANCE), where('checkOut', '==', null));
      const snap = await getDocs(q);
      if (snap.empty) return false;

      const shiftsSnap = await getDocs(collection(db, SHIFTS));
      const schedules = shiftsSnap.docs.map(d => ({ id: d.id, ...d.data() } as ShiftSchedule));

      const now = new Date();
      const batch = writeBatch(db);
      let count = 0;

      snap.docs.forEach(d => {
        const data = d.data();
        const checkIn = this.convertToDate(data.checkIn);
        if (!checkIn) return;

        const isFromPreviousDay = checkIn.toDateString() !== now.toDateString() && checkIn < now;
        if (!isFromPreviousDay) return;

        // Check if user has ANY shift schedule with midnight closure disabled
        const hasExemption = schedules.some(s => 
          s.assignedUserIds.includes(data.userId) && s.disableAutoClose === true
        );

        if (hasExemption) {
          const diffHours = (now.getTime() - checkIn.getTime()) / 3600000;
          if (diffHours > 24) {
            batch.update(d.ref, {
              checkOut: Timestamp.fromDate(now),
              autoClosed: true,
              needsReview: true,
              duration: diffHours * 60
            });
            count++;
          }
        } else {
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

      if (count > 0) {
        await batch.commit();
        return true;
      }
      return false;
    } catch (err) {
      console.error("Global auto-close failed:", err);
      return false;
    }
  }

  async processAutoClosures(userId: string): Promise<boolean> {
    try {
      const q = query(
        collection(db, ATTENDANCE), 
        where('userId', '==', userId), 
        where('checkOut', '==', null)
      );
      const snap = await getDocs(q);
      if (snap.empty) return false;

      const shiftsSnap = await getDocs(query(collection(db, SHIFTS), where('assignedUserIds', 'array-contains', userId)));
      const schedules = shiftsSnap.docs.map(d => d.data() as ShiftSchedule);
      const hasNightShiftExemption = schedules.some(s => s.disableAutoClose === true);

      const now = new Date();
      const batch = writeBatch(db);
      let count = 0;

      snap.docs.forEach(d => {
        const data = d.data();
        const checkIn = this.convertToDate(data.checkIn);
        if (!checkIn) return;

        const isFromPreviousDay = checkIn.toDateString() !== now.toDateString() && checkIn < now;

        if (isFromPreviousDay) {
          if (hasNightShiftExemption) {
            const diffHours = (now.getTime() - checkIn.getTime()) / 3600000;
            if (diffHours > 24) {
              batch.update(d.ref, {
                checkOut: Timestamp.fromDate(now),
                autoClosed: true,
                needsReview: true,
                duration: diffHours * 60
              });
              count++;
            }
          } else {
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
        }
      });

      if (count > 0) {
        await batch.commit();
        return true;
      }
      return false;
    } catch (err) {
      console.error("User auto-close failed:", err);
      return false;
    }
  }

  /* 📢 COMMUNICATIONS (Broadcasts) */
  async getActiveBroadcasts(): Promise<Broadcast[]> {
    try {
      this.ensureAuth();
      const user = this.currentUser!;
      const q = query(collection(db, BROADCASTS), where('active', '==', true));
      const snap = await getDocs(q);
      const userProjects = await this.getProjects(user.id);
      const userProjectIds = userProjects.map(p => p.id);
      const items = snap.docs.map(d => {
        const data = d.data();
        return { 
          id: d.id, 
          ...data, 
          createdAt: this.convertToDate(data.createdAt) || new Date() 
        } as Broadcast;
      });
      return items.filter(b => {
        const hasProjectFilter = b.targetProjectIds && b.targetProjectIds.length > 0;
        const hasUserFilter = b.targetUserIds && b.targetUserIds.length > 0;
        if (!hasProjectFilter && !hasUserFilter) return true;
        const userMatch = hasUserFilter && b.targetUserIds!.includes(user.id);
        const projectMatch = hasProjectFilter && b.targetProjectIds!.some(pid => userProjectIds.includes(pid));
        return userMatch || projectMatch;
      }).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } catch (err) {
      console.error("Broadcasts fetch error:", err);
      return [];
    }
  }

  async getAllBroadcasts(): Promise<Broadcast[]> {
    this.ensureAdmin();
    const q = query(collection(db, BROADCASTS), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => {
      const data = d.data();
      return { id: d.id, ...data, createdAt: this.convertToDate(data.createdAt) || new Date() } as Broadcast;
    });
  }

  async saveBroadcast(broadcast: Partial<Broadcast>) {
    this.ensureAdmin();
    const dataToSave = {
      ...broadcast,
      targetProjectIds: broadcast.targetProjectIds || [],
      targetUserIds: broadcast.targetUserIds || []
    };
    if (broadcast.id) {
      const { id, ...data } = dataToSave;
      await updateDoc(doc(db, BROADCASTS, id), this.sanitize({ ...data, updatedAt: serverTimestamp() }));
    } else {
      await addDoc(collection(db, BROADCASTS), this.sanitize({ ...dataToSave, createdAt: serverTimestamp(), active: broadcast.active ?? true }));
    }
  }

  async deleteBroadcast(id: string) {
    this.ensureAdmin();
    await deleteDoc(doc(db, BROADCASTS, id));
  }

  /* ⚙️ GLOBAL SETTINGS & HOLIDAYS */
  async getGlobalSettings(): Promise<{ standardHours: number }> {
    try {
      const snap = await getDoc(doc(db, SETTINGS, 'global_config'));
      if (snap.exists()) return { standardHours: Number(snap.data().standardHours) || 225 };
    } catch (e) {}
    return { standardHours: 225 };
  }

  async saveGlobalSettings(settings: { standardHours: number }) {
    this.ensureAdmin();
    await setDoc(doc(db, SETTINGS, 'global_config'), this.sanitize({ standardHours: Number(settings.standardHours), updatedAt: serverTimestamp(), updatedBy: this.currentUser?.id }), { merge: true });
  }

  async getHolidays(): Promise<Holiday[]> {
    const snap = await getDocs(collection(db, HOLIDAYS));
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Holiday));
  }

  async saveHoliday(holiday: Partial<Holiday>) {
    this.ensureAdmin();
    if (holiday.id) await updateDoc(doc(db, HOLIDAYS, holiday.id), this.sanitize(holiday));
    else await addDoc(collection(db, HOLIDAYS), this.sanitize(holiday));
  }

  async deleteHoliday(id: string) {
    this.ensureAdmin();
    await deleteDoc(doc(db, HOLIDAYS, id));
  }

  /* ⏱️ ATTENDANCE ACTIONS */
  async checkIn(user: User, location?: { lat: number, lng: number, accuracy?: number }, projectId?: string) {
    this.ensureAuth();
    const docData = {
      userId: user.id,
      userName: user.name,
      checkIn: serverTimestamp(),
      checkOut: null, 
      projectId: projectId || null,
      location: location || null,
      needsReview: false
    };
    await addDoc(collection(db, ATTENDANCE), this.sanitize(docData));
  }

  async checkOut(recordId: string, location?: { lat: number, lng: number, accuracy?: number }, outsideGeofence: boolean = false) {
    this.ensureAuth();
    const snap = await getDoc(doc(db, ATTENDANCE, recordId));
    if (!snap.exists()) return;
    const data = snap.data();
    const checkIn = this.convertToDate(data.checkIn) || new Date();
    const checkOut = new Date();
    const duration = (checkOut.getTime() - checkIn.getTime()) / 60000;
    await updateDoc(doc(db, ATTENDANCE, recordId), this.sanitize({
      checkOut: serverTimestamp(),
      checkOutLocation: location || null,
      duration: duration > 0 ? duration : 0,
      needsReview: outsideGeofence 
    }));
  }

  private convertToDate(val: any): Date | undefined {
    if (!val) return undefined;
    if (val instanceof Timestamp) return val.toDate();
    if (val instanceof Date) return val;
    if (typeof val.toDate === 'function') return val.toDate();
    if (typeof val.seconds === 'number') return new Date(val.seconds * 1000);
    return undefined;
  }

  async getAttendanceHistory(userId: string): Promise<AttendanceRecord[]> {
    this.ensureAuth();
    const q = query(collection(db, ATTENDANCE), where('userId', '==', userId), orderBy('checkIn', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => {
      const r = d.data();
      const checkIn = this.convertToDate(r.checkIn);
      const checkOut = this.convertToDate(r.checkOut);
      let duration = Number(r.duration);
      if ((!duration || isNaN(duration)) && checkIn && checkOut) {
        duration = (checkOut.getTime() - checkIn.getTime()) / 60000;
      }
      return { id: d.id, ...r, checkIn, checkOut, duration } as AttendanceRecord;
    }).filter(r => r.checkIn !== undefined) as AttendanceRecord[];
  }

  /* 🏗️ PROJECT ACTIONS */
  async getProjects(userId?: string): Promise<Project[]> {
    this.ensureAuth();
    try {
      let q = userId 
        ? query(collection(db, PROJECTS), where('assignedUserIds', 'array-contains', userId))
        : query(collection(db, PROJECTS));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Project));
    } catch (err) {
      console.error("Projects fetch error:", err);
      return [];
    }
  }

  async saveProject(project: Partial<Project>) {
    this.ensureAdmin();
    if (project.id) await updateDoc(doc(db, PROJECTS, project.id), this.sanitize(project));
    else await addDoc(collection(db, PROJECTS), this.sanitize(project));
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
    const sanitizedUser = { ...user, grossSalary: Number(user.grossSalary || 0), standardHours: Number(user.standardHours || 0) };
    await setDoc(doc(db, USERS, user.id!), this.sanitize(sanitizedUser), { merge: true });
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
    if (shift.id) await updateDoc(doc(db, SHIFTS, shift.id), this.sanitize(shift));
    else await addDoc(collection(db, SHIFTS), this.sanitize(shift));
  }

  async deleteShiftSchedule(id: string) {
    this.ensureAdmin();
    await deleteDoc(doc(db, SHIFTS, id));
  }

  async updateAttendanceRecord(id: string, updates: { checkIn: Date, checkOut?: Date }) {
    this.ensureAdmin();
    const duration = updates.checkOut ? (updates.checkOut.getTime() - updates.checkIn.getTime()) / 60000 : 0;
    await updateDoc(doc(db, ATTENDANCE, id), this.sanitize({
      checkIn: Timestamp.fromDate(updates.checkIn),
      checkOut: updates.checkOut ? Timestamp.fromDate(updates.checkOut) : null,
      duration: duration > 0 ? duration : 0,
      needsReview: false 
    }));
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
    match /holidays/{id} {
      allow read: if request.auth != null;
      allow write: if isAdmin();
      allow delete: if isAdmin();
    }
    match /broadcasts/{id} {
      allow read: if request.auth != null;
      allow create, update, delete: if isAdmin();
    }
  }
}`;
  }
}

export const dataService = new DataService();
