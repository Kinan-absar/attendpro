export type UserRole = 'admin' | 'employee';

export interface User {
  id: string;
  email: string;
  name: string;
  employeeId: string;
  department: string;
  role: UserRole;
  avatar?: string;
}

export interface AttendanceRecord {
  id: string;
  userId: string;
  userName: string;
  checkIn: Date;
  checkOut?: Date;
  duration?: number;
  location?: {
    lat: number;
    lng: number;
  };
}

export interface MonthlyReport {
  month: string;
  year: number;
  requiredHours?: number; // 🔥 new
  employees: {
    name: string;
    totalHours: number;
    shiftCount: number;
  }[];
}

