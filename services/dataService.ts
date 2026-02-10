
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
// Fix: Use modular imports for auth functions
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth, db } from '../firebase';
import { AttendanceRecord, User } from '../types';

const ATTENDANCE_COLLECTION = 'attendance';

class DataService {
  private currentUser: User | null = null;

  async init() {
    // nothing needed anymore
    return;
  }

  getCurrentUser(): User | null {
    return this.currentUser;
  }

  async login(email: string, password: string): Promise<User> {
    const cred = await signInWithEmailAndPassword(auth, email, password);

    const user: User = {
      id: cred.user.uid,
      username: cred.user.email || 'User',
      name: cred.user.email?.split('@')[0] || 'User',
      employeeId: 'EMP-TBD',
      department: 'General',
      role: 'employee',
      avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${cred.user.email}`,
    };

    this.currentUser = user;
    return user;
  }

  async logout() {
    await signOut(auth);
    this.currentUser = null;
  }

  async checkIn(user: User) {
    await addDoc(collection(db, ATTENDANCE_COLLECTION), {
      userId: user.id,
      userName: user.name,
      type: 'in',
      time: serverTimestamp(),
    });
  }

  async checkOut(user: User) {
    await addDoc(collection(db, ATTENDANCE_COLLECTION), {
      userId: user.id,
      userName: user.name,
      type: 'out',
      time: serverTimestamp(),
    });
  }

  async getAttendanceHistory(userId: string): Promise<AttendanceRecord[]> {
    const q = query(
      collection(db, ATTENDANCE_COLLECTION),
      where('userId', '==', userId),
      orderBy('time', 'desc')
    );

    const snap = await getDocs(q);

    // Map Firebase event stream back to Paired AttendanceRecord format for UI compatibility
    const events = snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as any[];

    const records: AttendanceRecord[] = [];
    let currentOut: any = null;

    // Iterate backwards to pair Ins with Outs
    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      const eventDate = (event.time as Timestamp)?.toDate() || new Date();
      
      if (event.type === 'out') {
        currentOut = event;
      } else if (event.type === 'in') {
        records.push({
          id: event.id,
          userId: event.userId,
          userName: event.userName || 'Employee',
          checkIn: eventDate,
          checkOut: currentOut ? (currentOut.time as Timestamp).toDate() : undefined,
          duration: currentOut ? Math.round(((currentOut.time as Timestamp).toDate().getTime() - eventDate.getTime()) / 60000) : undefined
        });
        currentOut = null; // Reset for next pair
      }
    }

    return records;
  }

  // Stubs for admin features to prevent crashes after replacement
  async getUsers(): Promise<User[]> { return []; }
  async addUser(userData: any) { return null; }
  async getMonthlyReports(): Promise<any[]> { return []; }
  exportToCSV(records: any, filename: string) { console.log("CSV Export not implemented in basic Firebase version"); }
}

export const dataService = new DataService();
