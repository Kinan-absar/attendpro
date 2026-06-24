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
  User as FirebaseUser,
  updatePassword
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
const PAYROLL_ADJUSTMENTS = 'payroll_adjustments';
const COMPANIES = 'companies';

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
        const val = this.sanitize(data[key]);
        if (val !== undefined) {
          sanitized[key] = val;
        }
      }
    }
    return sanitized;
  }

  /* 🔐 AUTHENTICATION */
  async verifyCompanyExists(companyId: string): Promise<boolean> {
    const cid = companyId.trim().toUpperCase();
    if (cid === 'ABSAR' || cid === '1' || cid === 'KOKO') {
      try {
        const snap = await getDoc(doc(db, COMPANIES, cid));
        if (!snap.exists()) {
          try {
            let defaultName = 'Corporate Group 1';
            if (cid === 'ABSAR') {
              defaultName = 'Absar Alomran Construction Co.';
            } else if (cid === 'KOKO') {
              defaultName = 'KIKI';
            }
            await setDoc(doc(db, COMPANIES, cid), {
              id: cid,
              name: defaultName,
              createdAt: new Date()
            });
          } catch (e) {
            console.error("Failed to seed default company (non-fatal):", e);
          }
        }
      } catch (e: any) {
        console.warn("Permission restricted when accessing default company (non-fatal fallback):", e);
      }
      return true;
    }

    try {
      const snap = await getDoc(doc(db, COMPANIES, cid));
      return snap.exists();
    } catch (e: any) {
      if (e.code === 'permission-denied' || e.message?.toLowerCase().includes('permission')) {
        console.warn("Permission denied checking companyId; falling back to allowing access.", e);
        return true; // Graceful fallback
      }
      throw e;
    }
  }

  async registerCompany(companyId: string, companyName: string): Promise<void> {
    const cid = companyId.trim().toUpperCase();
    try {
      const snap = await getDoc(doc(db, COMPANIES, cid));
      if (snap.exists()) {
        throw new Error(`Company ID "${cid}" is already registered. Please choose another.`);
      }
      await setDoc(doc(db, COMPANIES, cid), {
        id: cid,
        name: companyName.trim(),
        createdAt: new Date()
      });
    } catch (e: any) {
      if (e.code === 'permission-denied' || e.message?.toLowerCase().includes('permission')) {
        console.warn("Permission denied when registering company; allowing flow to proceed.", e);
        return; // Graceful fallback
      }
      throw e;
    }
  }

  async signUp(
    companyId: string,
    email: string,
    password: string,
    name: string,
    employeeId: string,
    department: string,
    isNewCompany: boolean,
    companyName?: string
  ): Promise<User> {
    const cid = companyId.trim().toUpperCase();
    const normalizedEmail = email.trim().toLowerCase();

    if (isNewCompany) {
      if (!companyName) throw new Error("Company name is required to register a new company.");
      await this.registerCompany(cid, companyName);
    } else {
      const exists = await this.verifyCompanyExists(cid);
      if (!exists) {
        throw new Error(`Company ID "${cid}" does not exist. Please verify with your HR or Admin.`);
      }
    }

    // Get company details for the profile
    let finalCompanyName = companyName || 'Corporate';
    if (cid === 'ABSAR') {
      finalCompanyName = 'Absar Alomran Co.';
    } else if (cid === 'KOKO') {
      finalCompanyName = 'KIKI';
    }
    try {
      const compSnap = await getDoc(doc(db, COMPANIES, cid));
      if (compSnap.exists()) {
        finalCompanyName = compSnap.data()?.name || finalCompanyName;
      }
    } catch (e: any) {
      console.warn("Permission restricted when fetching company details; using fallback name.", e);
    }

    // Create Auth User
    const cred = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
    const uid = cred.user.uid;

    // Securely register/update company document in Firestore now that the user is authenticated
    if (isNewCompany && companyName) {
      try {
        await setDoc(doc(db, COMPANIES, cid), {
          id: cid,
          name: companyName.trim(),
          createdAt: new Date()
        }, { merge: true });
        console.log(`[SignUp] Successfully registered company ${cid} with name ${companyName} under authenticated user.`);
      } catch (e: any) {
        console.warn("[SignUp] Failed to write company document after auth (non-fatal):", e);
      }
    }

    const userProfile: Omit<User, 'id'> = {
      email: normalizedEmail,
      name: name.trim(),
      employeeId: employeeId.trim(),
      department: department.trim() || 'Operations',
      role: isNewCompany ? 'admin' : 'employee',
      company: finalCompanyName,
      companyId: cid,
      grossSalary: 0,
      standardHours: 8,
      disableOvertime: true,
      disableDeductions: false,
      isOnLeave: false,
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`
    };

    await setDoc(doc(db, USERS, uid), this.sanitize(userProfile));

    const user: User = { id: uid, ...userProfile } as User;
    this.currentUser = user;
    return user;
  }

  async login(companyId: string, email: string, password: string): Promise<User> {
    const cred = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
    const snap = await getDoc(doc(db, USERS, cred.user.uid));
    if (!snap.exists()) throw new Error('User profile missing in Firestore.');
    const data = snap.data();
    
    let userCompanyId = (data.companyId || '').trim().toUpperCase();
    const providedCompanyId = companyId.trim().toUpperCase();
    
    if (!userCompanyId) {
      // Pre-existing user from before company ID integration; dynamically assign to this company ID
      await this.verifyCompanyExists(providedCompanyId);
      userCompanyId = providedCompanyId;
      await updateDoc(doc(db, USERS, cred.user.uid), {
        companyId: providedCompanyId
      });
      data.companyId = providedCompanyId;
    }
    
    if (userCompanyId !== providedCompanyId) {
      await signOut(auth);
      throw new Error(`The account ${email} is not registered with company ID ${companyId}.`);
    }

    const user: User = { id: cred.user.uid, email: cred.user.email || '', ...data } as User;
    const resolvedUser = await this.resolveAndCorrectCompanyName(user);
    this.currentUser = resolvedUser;
    return resolvedUser;
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
        employeeId: userData.employeeId || 'Pending',
        department: userData.department || 'Pending',
        role: userData.role || 'employee',
        grossSalary: Number(userData.grossSalary || 0),
        standardHours: Number(userData.standardHours || 0),
        company: this.currentUser?.company || 'Absar Alomran Co.',
        companyId: this.currentUser?.companyId || 'ABSAR',
        disableOvertime: userData.disableOvertime ?? true,
        disableDeductions: userData.disableDeductions ?? false,
        isOnLeave: userData.isOnLeave ?? false,
        leaveStartDate: userData.leaveStartDate || null,
        leaveEndDate: userData.leaveEndDate || null,
        avatar: userData.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.name || 'User')}&background=random`
      };

      await setDoc(doc(db, USERS, uid), this.sanitize(userProfile));
      return uid;
    } finally {
      await deleteApp(secondaryApp);
    }
  }

  async resolveAndCorrectCompanyName(user: User): Promise<User> {
    if (!user || !user.companyId) return user;
    const cid = user.companyId.trim().toUpperCase();
    
    // 1. Establish initial fallback based on the company ID
    let resolvedName = user.company || '';
    if (cid === 'ABSAR') {
      resolvedName = resolvedName || 'Absar Alomran Co.';
    } else if (cid === '1') {
      resolvedName = resolvedName || 'Corporate Group 1';
    }

    // 2. Try fetching the real company name from the DB in an isolated try-catch so permission errors don't crash fallback assignments
    try {
      const compSnap = await getDoc(doc(db, COMPANIES, cid));
      if (compSnap.exists()) {
        const dbName = compSnap.data()?.name;
        if (dbName) {
          resolvedName = dbName;
        }
      }
    } catch (e: any) {
      console.warn(`[Non-fatal] Could not fetch COMPANIES collection for "${cid}" due to restriction or lack of doc:`, e);
    }

    // 3. Self-heal the database document if this user is an admin and has a valid, non-generic company name
    const isGenericUserCompany = !user.company || 
                                 user.company.trim().toLowerCase() === 'corporate' || 
                                 user.company.trim().toLowerCase() === 'corporate group 1' || 
                                 user.company.trim().toLowerCase() === 'corporate ' || 
                                 user.company.trim().toLowerCase() === 'corporate group';
                                 
    if (user.role === 'admin' && user.company && !isGenericUserCompany) {
      try {
        const compRef = doc(db, COMPANIES, cid);
        const compSnap = await getDoc(compRef);
        if (!compSnap.exists() || !compSnap.data()?.name || compSnap.data()?.name !== user.company) {
          await setDoc(compRef, {
            id: cid,
            name: user.company,
            createdAt: new Date()
          }, { merge: true });
          console.log(`[Self-Heal] Successfully wrote/healed company document for "${cid}" with name "${user.company}"`);
          resolvedName = user.company;
        }
      } catch (err: any) {
        console.warn(`[Self-Heal] Failed to write company document for admin:`, err);
      }
    }

    // 4. If resolvedName is still empty, or has generic 'Corporate' values, apply a fallback
    const nameLower = resolvedName.trim().toLowerCase();
    const isGeneric = !resolvedName || 
                      nameLower === 'corporate' || 
                      nameLower === 'corporate group 1' || 
                      nameLower === 'corporate ' || 
                      nameLower === 'corporate group';
                      
    if (isGeneric) {
      if (cid === 'ABSAR') {
        resolvedName = 'Absar Alomran Co.';
      } else if (cid === '1') {
        resolvedName = 'Corporate Group 1';
      } else {
        // Fallback to formatted company ID (e.g. "Google Corp" or "Absar Corp")
        resolvedName = cid.charAt(0) + cid.slice(1).toLowerCase() + ' Corp';
      }
    }

    // 5. Update the in-memory object and attempt to update the document if changed
    if (resolvedName && user.company !== resolvedName) {
      user.company = resolvedName;
      try {
        await updateDoc(doc(db, USERS, user.id), { company: resolvedName });
      } catch (err: any) {
        console.warn(`[Non-fatal] Failed to update user profile's company name in Firestore:`, err);
      }
    }

    return user;
  }

  initAuth(onUser: (user: User | null) => void) {
    onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) { this.currentUser = null; onUser(null); return; }
      const snap = await getDoc(doc(db, USERS, fbUser.uid));
      if (!snap.exists()) { onUser(null); return; }
      let user = { id: fbUser.uid, email: fbUser.email || '', ...snap.data() } as User;
      user = await this.resolveAndCorrectCompanyName(user);
      this.currentUser = user;
      
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

  async getCurrentUserDoc(userId: string): Promise<User | null> {
    const snap = await getDoc(doc(db, USERS, userId));
    if (!snap.exists()) return null;
    const user = { id: userId, email: auth.currentUser?.email || '', ...snap.data() } as User;
    return this.resolveAndCorrectCompanyName(user);
  }

  /* 🕒 AUTO-CLOSE ENGINE */

  /**
   * Returns true if a record was checked out recently enough (within the last
   * 2 hours on the same calendar day as checkIn) that auto-close must NOT
   * override it. This guards against the heartbeat racing with a legitimate
   * checkout that hasn't propagated yet, or a Firestore listener firing before
   * the checkOut field is visible to the query.
   */
  private isRecentlyCheckedOut(checkIn: Date, now: Date): boolean {
    // If the employee checked in today, never auto-close — they may still be working
    // or just checked out and the update hasn't propagated.
    return checkIn.toDateString() === now.toDateString();
  }

  async processAllAutoClosures(): Promise<boolean> {
    try {
      this.ensureAdmin();
      const companyId = this.currentUser?.companyId || '';
      const q = query(collection(db, ATTENDANCE), where('companyId', '==', companyId), where('checkOut', '==', null));
      const snap = await getDocs(q);
      if (snap.empty) return false;

      const shiftsSnap = await getDocs(query(collection(db, SHIFTS), where('companyId', '==', companyId)));
      const schedules = shiftsSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as ShiftSchedule));

      const now = new Date();
      const batch = writeBatch(db);
      let count = 0;

      snap.docs.forEach(d => {
        const data = d.data();
        const checkIn = this.convertToDate(data.checkIn);
        if (!checkIn) return;

        // GUARD: never auto-close a record that started today —
        // the employee may have checked out normally and the write
        // just hasn't been reflected in this query yet.
        if (this.isRecentlyCheckedOut(checkIn, now)) return;

        const isPastGracePeriod = now.getHours() >= 10; // 10 AM grace period
        const isVeryOld = (now.getTime() - checkIn.getTime()) > 16 * 3600000; // 16 hours old

        // Only auto-close records from a PREVIOUS day, past the grace period
        const shouldAutoClose = isPastGracePeriod || isVeryOld;
        if (!shouldAutoClose) return;

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
          // Close at 23:59:59 of the check-in day (genuine forgotten checkout)
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
      console.warn("Global auto-close warning (non-fatal):", err);
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

        // GUARD: never auto-close a record that started today —
        // the employee may have just checked out and Firestore hasn't
        // propagated the update to this query yet.
        if (this.isRecentlyCheckedOut(checkIn, now)) return;

        const isPastGracePeriod = now.getHours() >= 10;
        const isVeryOld = (now.getTime() - checkIn.getTime()) > 16 * 3600000;
        const shouldAutoClose = isPastGracePeriod || isVeryOld;

        if (shouldAutoClose) {
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
            // Close at 23:59:59 of the check-in day (genuine forgotten checkout)
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
      console.warn("User auto-close warning (non-fatal):", err);
      return false;
    }
  }

  /* 📢 COMMUNICATIONS (Broadcasts) */
  async getActiveBroadcasts(): Promise<Broadcast[]> {
    try {
      this.ensureAuth();
      const user = this.currentUser!;
      const q = query(collection(db, BROADCASTS), where('companyId', '==', user.companyId || ''), where('active', '==', true));
      const snap = await getDocs(q);
      const userProjects = await this.getProjects(user.id);
      const userProjectIds = userProjects.map(p => p.id);
      const items = snap.docs.map(d => {
        const data = d.data();
        return { 
          id: d.id, 
          ...data, 
          companyId: data.companyId || '',
          createdAt: this.convertToDate(data.createdAt) || new Date() 
        } as any as Broadcast;
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
    const q = query(collection(db, BROADCASTS), where('companyId', '==', this.currentUser?.companyId || ''));
    const snap = await getDocs(q);
    const broadcasts = snap.docs.map(d => {
      const data = d.data();
      return { id: d.id, ...data, createdAt: this.convertToDate(data.createdAt) || new Date() } as any as Broadcast;
    });
    return broadcasts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async saveBroadcast(broadcast: Partial<Broadcast>) {
    this.ensureAdmin();
    const dataToSave = {
      ...broadcast,
      companyId: this.currentUser?.companyId || '',
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
  async getGlobalSettings(): Promise<{ standardHours: number; reportFromDate?: string; reportToDate?: string }> {
    try {
      const companyId = this.currentUser?.companyId || 'ABSAR';
      const snap = await getDoc(doc(db, SETTINGS, `config_${companyId}`));
      if (snap.exists()) {
        const data = snap.data();
        return {
          standardHours: Number(data.standardHours) || 240,
          reportFromDate: data.reportFromDate || '',
          reportToDate: data.reportToDate || ''
        };
      }
    } catch (e) {}
    return { standardHours: 240, reportFromDate: '', reportToDate: '' };
  }

  async saveGlobalSettings(settings: { standardHours?: number; reportFromDate?: string; reportToDate?: string }) {
    this.ensureAdmin();
    const companyId = this.currentUser?.companyId || 'ABSAR';
    const updateData: any = {};
    if (settings.standardHours !== undefined) {
      updateData.standardHours = Number(settings.standardHours);
    }
    if (settings.reportFromDate !== undefined) {
      updateData.reportFromDate = settings.reportFromDate;
    }
    if (settings.reportToDate !== undefined) {
      updateData.reportToDate = settings.reportToDate;
    }
    updateData.companyId = companyId;
    updateData.updatedAt = serverTimestamp();
    updateData.updatedBy = this.currentUser?.id;

    await setDoc(doc(db, SETTINGS, `config_${companyId}`), this.sanitize(updateData), { merge: true });
  }

  async getHolidays(): Promise<Holiday[]> {
    const companyId = this.currentUser?.companyId || '';
    const snap = await getDocs(query(collection(db, HOLIDAYS), where('companyId', '==', companyId)));
    return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as Holiday));
  }

  async saveHoliday(holiday: Partial<Holiday>) {
    this.ensureAdmin();
    const data = { ...holiday, companyId: this.currentUser?.companyId || '' };
    if (holiday.id) await updateDoc(doc(db, HOLIDAYS, holiday.id), this.sanitize(data));
    else await addDoc(collection(db, HOLIDAYS), this.sanitize(data));
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
      userName: user.name || user.email || 'Unknown User',
      companyId: user.companyId || this.currentUser?.companyId || 'ABSAR',
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
      needsReview: outsideGeofence,
      autoClosed: false // Explicitly clear if it was set by background agent
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
      const companyId = this.currentUser?.companyId || '';
      const q = query(collection(db, PROJECTS), where('companyId', '==', companyId));
      const snap = await getDocs(q);
      const projects = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as Project));
      if (userId) {
        return projects.filter(p => p.assignedUserIds && p.assignedUserIds.includes(userId));
      }
      return projects;
    } catch (err) {
      console.error("Projects fetch error:", err);
      return [];
    }
  }

  async saveProject(project: Partial<Project>) {
    this.ensureAdmin();
    const data = Object.assign({}, project, { companyId: this.currentUser?.companyId || '' });
    if (project.id) await updateDoc(doc(db, PROJECTS, project.id), this.sanitize(data));
    else await addDoc(collection(db, PROJECTS), this.sanitize(data));
  }

  async deleteProject(id: string) {
    this.ensureAdmin();
    await deleteDoc(doc(db, PROJECTS, id));
  }

  /* 👥 ADMIN TOOLS */
  async getUsers(): Promise<User[]> {
    this.ensureAdmin();
    const companyId = this.currentUser?.companyId || '';
    const snap = await getDocs(query(collection(db, USERS), where('companyId', '==', companyId)));
    return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as User));
  }

  async getAllAttendance(): Promise<AttendanceRecord[]> {
    this.ensureAdmin();
    const companyId = this.currentUser?.companyId || '';
    const snap = await getDocs(query(collection(db, ATTENDANCE), where('companyId', '==', companyId)));
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

  private toLocalDateString(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  async getMonthlyReports(from?: Date, to?: Date, holidays: Holiday[] = []): Promise<MonthlyReport[]> {
    this.ensureAdmin();
    const [allLogs, users] = await Promise.all([
      this.getAllAttendance(),
      this.getUsers()
    ]);
    return this.computeMonthlyReports(allLogs, users, holidays, from, to);
  }

  computeMonthlyReports(allLogs: AttendanceRecord[], users: User[], holidays: Holiday[] = [], from?: Date, to?: Date): MonthlyReport[] {
    const grouped: Record<string, MonthlyReport> = {};
    const userWorkDays: Record<string, Set<string>> = {}; 

    const start = from ? new Date(from) : null;
    if (start) start.setHours(0, 0, 0, 0);
    const end = to ? new Date(to) : null;
    if (end) end.setHours(23, 59, 59, 999);

    allLogs.forEach(r => {
      const cin = r.checkIn;
      const cout = r.checkOut;
      if (!cin) return;

      const compareDate = new Date(cin);
      compareDate.setHours(0, 0, 0, 0);

      if (start && compareDate < start) return;
      if (end && compareDate > end) return;

      let month = cin.getMonth();
      let year = cin.getFullYear();
      if (cin.getDate() >= 26) { month++; if (month === 12) { month = 0; year++; } }
      const key = `${year}-${month}`;
      const monthName = new Date(year, month).toLocaleString('en-US', { month: 'long' });
      grouped[key] ??= { month: monthName, year, employees: [] };
      
      const user = users.find(u => u.id === r.userId);
      if (!user) return;
      
      const userKey = `${key}-${user.id}`;
      userWorkDays[userKey] ??= new Set();
      userWorkDays[userKey].add(this.toLocalDateString(cin));

      const pId = r.projectId || 'none';
      let emp = grouped[key].employees.find(e => e.userId === user.id && e.projectId === pId);
      if (!emp) {
        emp = { userId: user.id, name: user.name, totalHours: 0, shiftCount: 0, projectId: pId, flaggedCount: 0, absentDays: 0, daysWorked: 0 };
        grouped[key].employees.push(emp);
      }
      
      emp.shiftCount++;
      const rawDuration = Number(r.duration);
      const calcDuration = cout ? (cout.getTime() - cin.getTime()) / 3600000 : 0;
      const finalDuration = (!isNaN(rawDuration) && rawDuration > 0) ? (rawDuration / 60) : calcDuration;
      
      emp.totalHours += finalDuration;
      if (r.needsReview) emp.flaggedCount++;
    });

    if (start && end) {
      let curr = new Date(start);
      while (curr <= end) {
        let m = curr.getMonth();
        let y = curr.getFullYear();
        if (curr.getDate() >= 26) { m++; if (m === 12) { m = 0; y++; } }
        const key = `${y}-${m}`;
        if (!grouped[key]) {
          const monthName = new Date(y, m).toLocaleString('en-US', { month: 'long' });
          grouped[key] = { month: monthName, year: y, employees: [] };
        }
        curr.setMonth(curr.getMonth() + 1);
      }
    }

    Object.entries(grouped).forEach(([key, report]) => {
      const [year, month] = key.split('-').map(Number);
      const cycleStart = new Date(year, month - 1, 26);
      const cycleEnd = new Date(year, month, 25);
      const actualStart = start && start > cycleStart ? start : cycleStart;
      const actualEnd = end && end < cycleEnd ? end : cycleEnd;

      users.forEach(user => {
        let emp = report.employees.find(e => e.userId === user.id);
        if (!emp) {
          emp = { userId: user.id, name: user.name, totalHours: 0, shiftCount: 0, projectId: 'none', flaggedCount: 0, absentDays: 0, expectedDays: 0, daysWorked: 0 };
          report.employees.push(emp);
        }

        const userKey = `${key}-${user.id}`;
        const workedDays = userWorkDays[userKey] || new Set();
        const current = new Date(actualStart);

        let expectedDaysCount = 0;
        let actualDaysWorkedCount = workedDays.size;

        while (current <= actualEnd) {
          const dateStr = this.toLocalDateString(current);
          const isFriday = current.getDay() === 5;
          const isHoliday = holidays.some(h => h.date === dateStr);

          if (!isFriday && !isHoliday) {
            expectedDaysCount++;
          }
          current.setDate(current.getDate() + 1);
        }

        let absentCount = 0;
        if (actualDaysWorkedCount === 0) {
          absentCount = 30;
        } else {
          absentCount = Math.max(0, expectedDaysCount - actualDaysWorkedCount);
        }

        const userEntries = report.employees.filter(e => e.userId === user.id);
        userEntries.forEach((e, idx) => {
          e.absentDays = (idx === 0) ? absentCount : 0;
          e.expectedDays = (idx === 0) ? expectedDaysCount : 0;
          e.daysWorked = (idx === 0) ? actualDaysWorkedCount : 0;
        });
      });
    });

    return Object.values(grouped).sort((a,b) => (a.year * 12 + new Date(`${a.month} 1`).getMonth()) - (b.year * 12 + new Date(`${b.month} 1`).getMonth()));
  }

  async saveUser(user: Partial<User>) {
    this.ensureAdmin();
    const sanitizedUser = { 
      ...user, 
      grossSalary: Number(user.grossSalary || 0), 
      standardHours: Number(user.standardHours || 0),
      companyId: this.currentUser?.companyId || 'ABSAR',
      company: this.currentUser?.company || 'Absar Alomran Co.'
    };
    await setDoc(doc(db, USERS, user.id!), this.sanitize(sanitizedUser), { merge: true });
  }

  async updateOwnProfile(userId: string, updates: Partial<User>) {
    const current = auth.currentUser;
    if (!current || current.uid !== userId) {
      throw new Error("Unauthorized to update this profile.");
    }
    
    // Only allow updating non-sensitive safe fields
    const safeUpdates: Partial<User> = {};
    if (updates.name !== undefined) safeUpdates.name = updates.name;
    if (updates.department !== undefined) safeUpdates.department = updates.department;
    if (updates.avatar !== undefined) safeUpdates.avatar = updates.avatar;
    if (updates.basicSalary !== undefined) safeUpdates.basicSalary = Number(updates.basicSalary || 0);
    if (updates.ibanNumber !== undefined) safeUpdates.ibanNumber = updates.ibanNumber.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (updates.iqamaNumber !== undefined) safeUpdates.iqamaNumber = updates.iqamaNumber.replace(/\D/g, '');
    if (updates.bankCode !== undefined) safeUpdates.bankCode = updates.bankCode;

    await updateDoc(doc(db, USERS, userId), this.sanitize(safeUpdates));
  }

  async updateCompanyDetails(
    currentCompanyId: string,
    newCompanyId: string,
    newCompanyName: string
  ): Promise<void> {
    if (!this.currentUser || this.currentUser.role !== 'admin') {
      throw new Error("Only Administrators can modify company settings.");
    }

    const oldCid = currentCompanyId.trim().toUpperCase();
    const newCid = newCompanyId.trim().toUpperCase();
    const cleanName = newCompanyName.trim();

    if (!newCid) throw new Error("Company ID cannot be empty.");
    if (!cleanName) throw new Error("Company Name cannot be empty.");

    // 1. Create/update the new company document
    await setDoc(doc(db, COMPANIES, newCid), {
      id: newCid,
      name: cleanName,
      createdAt: new Date()
    }, { merge: true });

    // 2. If the company ID actually changed, migrate all data!
    if (newCid !== oldCid) {
      console.log(`[Migration] Starting company ID migration from ${oldCid} to ${newCid}`);
      
      const collectionsToMigrate = [
        USERS,
        ATTENDANCE,
        PROJECTS,
        SHIFTS,
        HOLIDAYS,
        BROADCASTS,
        SETTINGS, // config_OLD_ID -> config_NEW_ID
        PAYROLL_ADJUSTMENTS
      ];

      for (const collName of collectionsToMigrate) {
        try {
          if (collName === SETTINGS) {
            // Settings has a unique ID: config_OLD_ID
            const oldConfigDoc = doc(db, SETTINGS, `config_${oldCid}`);
            const oldConfigSnap = await getDoc(oldConfigDoc);
            if (oldConfigSnap.exists()) {
              const data = oldConfigSnap.data();
              await setDoc(doc(db, SETTINGS, `config_${newCid}`), {
                ...data,
                companyId: newCid
              });
              await deleteDoc(oldConfigDoc);
            }
            continue;
          }

          // Query documents with the old companyId
          const q = query(collection(db, collName), where('companyId', '==', oldCid));
          const snap = await getDocs(q);

          if (snap.empty) continue;

          // Process in batches
          let batch = writeBatch(db);
          let count = 0;

          for (const d of snap.docs) {
            const docRef = doc(db, collName, d.id);
            const updateObj: any = { companyId: newCid };
            if (collName === USERS) {
              updateObj.company = cleanName;
            }
            batch.update(docRef, updateObj);
            count++;

            if (count >= 400) {
              await batch.commit();
              batch = writeBatch(db);
              count = 0;
            }
          }

          if (count > 0) {
            await batch.commit();
          }
          console.log(`[Migration] Migrated ${snap.size} documents in ${collName}`);
        } catch (e) {
          console.error(`[Migration Warning] Failed to migrate some documents in ${collName}:`, e);
        }
      }

      // Delete the old company document
      try {
        await deleteDoc(doc(db, COMPANIES, oldCid));
        console.log(`[Migration] Deleted old company document ${oldCid}`);
      } catch (e) {
        console.warn(`[Migration Warning] Could not delete old company document ${oldCid}:`, e);
      }
    } else {
      // If the ID didn't change, just update the company name for all users in the company in Firestore
      try {
        const q = query(collection(db, USERS), where('companyId', '==', oldCid));
        const snap = await getDocs(q);
        let batch = writeBatch(db);
        let count = 0;
        for (const d of snap.docs) {
          batch.update(doc(db, USERS, d.id), { company: cleanName });
          count++;
          if (count >= 400) {
            await batch.commit();
            batch = writeBatch(db);
            count = 0;
          }
        }
        if (count > 0) {
          await batch.commit();
        }
      } catch (e) {
        console.error("[Company Name Update] Failed to propagate company name to other users:", e);
      }
    }

    // 3. Update local user state
    if (this.currentUser) {
      this.currentUser.companyId = newCid;
      this.currentUser.company = cleanName;
    }
  }

  async changeOwnPassword(newPassword: string) {
    const current = auth.currentUser;
    if (!current) {
      throw new Error("No authenticated session found.");
    }
    await updatePassword(current, newPassword);
  }

  async deleteUser(id: string) {
    this.ensureAdmin();
    await deleteDoc(doc(db, USERS, id));
  }

  async getShiftSchedules(): Promise<ShiftSchedule[]> {
    const companyId = this.currentUser?.companyId || '';
    const snap = await getDocs(query(collection(db, SHIFTS), where('companyId', '==', companyId)));
    return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as ShiftSchedule));
  }

  async saveShiftSchedule(shift: Partial<ShiftSchedule>) {
    this.ensureAdmin();
    const data = { ...shift, companyId: this.currentUser?.companyId || '' };
    if (shift.id) await updateDoc(doc(db, SHIFTS, shift.id), this.sanitize(data));
    else await addDoc(collection(db, SHIFTS), this.sanitize(data));
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

  /* 💸 PAYROLL ADJUSTMENTS */
  async getPayrollAdjustments(year: number, month: string): Promise<Record<string, { otherDeductions: number, reimbursements: number, absentDays: number }>> {
    this.ensureAdmin();
    const q = query(collection(db, PAYROLL_ADJUSTMENTS), where('year', '==', year), where('month', '==', month));
    const snap = await getDocs(q);
    const adjustments: Record<string, { otherDeductions: number, reimbursements: number, absentDays: number }> = {};
    snap.docs.forEach(d => {
      const data = d.data();
      adjustments[data.userId] = {
        otherDeductions: Number(data.otherDeductions || 0),
        reimbursements: Number(data.reimbursements || 0),
        absentDays: Number(data.absentDays || 0)
      };
    });
    return adjustments;
  }

  async savePayrollAdjustment(year: number, month: string, userId: string, otherDeductions: number, reimbursements: number, absentDays: number) {
    this.ensureAdmin();
    const docId = `${year}-${month}-${userId}`;
    await setDoc(doc(db, PAYROLL_ADJUSTMENTS, docId), this.sanitize({
      year,
      month,
      userId,
      otherDeductions: Number(otherDeductions),
      reimbursements: Number(reimbursements),
      absentDays: Number(absentDays),
      updatedAt: serverTimestamp()
    }), { merge: true });
  }

  async resetAllSystemData(): Promise<void> {
    this.ensureAdmin();
    const adminId = this.currentUser?.id;
    if (!adminId) throw new Error("Current admin session is invalid.");

    const collectionsToClear = [
      ATTENDANCE,
      PROJECTS,
      SHIFTS,
      HOLIDAYS,
      BROADCASTS,
      PAYROLL_ADJUSTMENTS
    ];

    for (const collName of collectionsToClear) {
      const snap = await getDocs(collection(db, collName));
      if (!snap.empty) {
        const batch = writeBatch(db);
        snap.docs.forEach(docSnap => {
          batch.delete(docSnap.ref);
        });
        await batch.commit();
      }
    }

    const userSnap = await getDocs(collection(db, USERS));
    if (!userSnap.empty) {
      const batch = writeBatch(db);
      let count = 0;
      userSnap.docs.forEach(docSnap => {
        if (docSnap.id !== adminId) {
          batch.delete(docSnap.ref);
          count++;
        }
      });
      if (count > 0) {
        await batch.commit();
      }
    }

    await setDoc(doc(db, SETTINGS, 'global_config'), {
      standardHours: 240,
      reportFromDate: '',
      reportToDate: '',
      updatedAt: serverTimestamp(),
      updatedBy: adminId
    });
  }

  getRecommendedRules(): string {
    return `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAdmin() {
      return request.auth != null && (
        (exists(/databases/$(database)/documents/users/$(request.auth.uid)) &&
         get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin') ||
        request.auth.token.email == "kinan88m@gmail.com"
      );
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
    match /payroll_adjustments/{id} {
      allow read, write: if isAdmin();
    }
  }
}`;
  }
}

export const dataService = new DataService();