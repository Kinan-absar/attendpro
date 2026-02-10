
export type UserRole = 'admin' | 'employee';

export interface User {
  id: string;
  username: string;
  password?: string; // Only for local mock "database"
  name: string;
  employeeId: string;
  department: string;
  role: UserRole;
  avatar?: string;
}

export interface OdooConfig {
  url: string;
  db: string;
  username: string;
  password?: string;
}

export interface UserProfile {
  id: string;
  name: string;
  employeeId: string;
  avatar: string;
  department: string;
}

export interface AttendanceRecord {
  id: number;
  userId: string;
  userName: string; // Redundant but helpful for reporting
  checkIn: Date;
  checkOut?: Date;
  location?: {
    lat: number;
    lng: number;
  };
  duration?: number; // Minutes
}

export interface AIInsight {
  summary: string;
  suggestions: string[];
  trend: 'positive' | 'neutral' | 'negative';
}

export interface MonthlyReport {
  month: string;
  year: number;
  employees: {
    name: string;
    totalHours: number;
    shiftCount: number;
  }[];
}
