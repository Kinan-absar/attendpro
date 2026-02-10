
import { AttendanceRecord, User, MonthlyReport } from '../types';

const ATTENDANCE_KEY = 'standalone_attendance_records';
const USER_KEY = 'standalone_current_user';
const USER_DB_KEY = 'standalone_user_database';

// Default Mock Users
const DEFAULT_USERS: User[] = [
  { id: '1', username: 'admin', password: '123', name: 'System Manager', employeeId: 'MGR-001', department: 'Operations', role: 'admin', avatar: 'https://i.pravatar.cc/150?u=admin' },
  { id: '2', username: 'john', password: '123', name: 'John Doe', employeeId: 'EMP-101', department: 'Engineering', role: 'employee', avatar: 'https://i.pravatar.cc/150?u=john' },
  { id: '3', username: 'jane', password: '123', name: 'Jane Smith', employeeId: 'EMP-102', department: 'Design', role: 'employee', avatar: 'https://i.pravatar.cc/150?u=jane' }
];

export const dataService = {
  // Database Initialization
  init: () => {
    if (!localStorage.getItem(USER_DB_KEY)) {
      localStorage.setItem(USER_DB_KEY, JSON.stringify(DEFAULT_USERS));
    }
  },

  getUsers: (): User[] => {
    const data = localStorage.getItem(USER_DB_KEY);
    return data ? JSON.parse(data) : [];
  },

  addUser: (userData: Omit<User, 'id'>) => {
    const users = dataService.getUsers();
    const newUser: User = {
      ...userData,
      id: Math.random().toString(36).substr(2, 9),
      avatar: `https://i.pravatar.cc/150?u=${userData.username}`
    };
    users.push(newUser);
    localStorage.setItem(USER_DB_KEY, JSON.stringify(users));
    return newUser;
  },

  login: async (username: string, password: string): Promise<User | null> => {
    await new Promise(r => setTimeout(r, 600));
    const users = dataService.getUsers();
    const user = users.find(u => u.username === username && u.password === password);
    if (user) {
      const { password, ...userSafe } = user;
      localStorage.setItem(USER_KEY, JSON.stringify(userSafe));
      return userSafe as User;
    }
    return null;
  },

  logout: () => {
    localStorage.removeItem(USER_KEY);
  },

  getCurrentUser: (): User | null => {
    const data = localStorage.getItem(USER_KEY);
    return data ? JSON.parse(data) : null;
  },

  getAttendanceHistory: async (userId?: string): Promise<AttendanceRecord[]> => {
    const data = localStorage.getItem(ATTENDANCE_KEY);
    if (!data) return [];
    
    const records = JSON.parse(data).map((r: any) => ({
      ...r,
      checkIn: new Date(r.checkIn),
      checkOut: r.checkOut ? new Date(r.checkOut) : undefined
    }));

    if (userId) {
      return records.filter((r: AttendanceRecord) => r.userId === userId);
    }
    return records;
  },

  checkIn: async (user: User, location?: { lat: number; lng: number }): Promise<AttendanceRecord> => {
    const history = await dataService.getAttendanceHistory();
    const newRecord: AttendanceRecord = {
      id: Date.now(),
      userId: user.id,
      userName: user.name,
      checkIn: new Date(),
      location
    };
    
    localStorage.setItem(ATTENDANCE_KEY, JSON.stringify([newRecord, ...history]));
    return newRecord;
  },

  checkOut: async (userId: string): Promise<AttendanceRecord> => {
    const history = await dataService.getAttendanceHistory();
    const activeIdx = history.findIndex(r => r.userId === userId && !r.checkOut);
    
    if (activeIdx === -1) throw new Error("No active check-in found.");
    
    const record = history[activeIdx];
    record.checkOut = new Date();
    record.duration = Math.round((record.checkOut.getTime() - record.checkIn.getTime()) / 60000);
    
    localStorage.setItem(ATTENDANCE_KEY, JSON.stringify(history));
    return record;
  },

  getMonthlyReports: async (): Promise<MonthlyReport[]> => {
    const history = await dataService.getAttendanceHistory();
    const reportsMap: Record<string, MonthlyReport> = {};

    history.forEach(r => {
      if (!r.checkOut) return;
      
      const date = new Date(r.checkIn);
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      const monthName = date.toLocaleString('default', { month: 'long' });
      
      if (!reportsMap[key]) {
        reportsMap[key] = {
          month: monthName,
          year: date.getFullYear(),
          employees: []
        };
      }

      let emp = reportsMap[key].employees.find(e => e.name === r.userName);
      if (!emp) {
        emp = { name: r.userName, totalHours: 0, shiftCount: 0 };
        reportsMap[key].employees.push(emp);
      }
      
      emp.totalHours += (r.duration || 0) / 60;
      emp.shiftCount += 1;
    });

    return Object.values(reportsMap).sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      return months.indexOf(b.month) - months.indexOf(a.month);
    });
  },

  exportToCSV: (records: AttendanceRecord[], filename: string) => {
    const headers = ['Employee', 'Date', 'Check In', 'Check Out', 'Duration (Min)', 'Duration (Hrs)'];
    const rows = records.map(r => [
      r.userName,
      new Date(r.checkIn).toLocaleDateString(),
      new Date(r.checkIn).toLocaleTimeString(),
      r.checkOut ? new Date(r.checkOut).toLocaleTimeString() : 'In Progress',
      r.duration || 0,
      ((r.duration || 0) / 60).toFixed(2)
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};
