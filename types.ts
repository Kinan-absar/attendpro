
export type UserRole = 'admin' | 'employee';

export interface User {
  id: string;
  username: string;
  password?: string;
  name: string;
  employeeId: string;
  department: string;
  role: UserRole;
  avatar?: string;
}

// Added UserProfile interface required by odooService
export interface UserProfile {
  id: string;
  name: string;
  employeeId: string;
  department: string;
  avatar?: string;
}

// Added OdooConfig interface required by odooService
export interface OdooConfig {
  url: string;
  db: string;
  username: string;
  apiKey: string;
}

export interface AttendanceRecord {
  id: string | number;
  userId: string;
  userName: string;
  checkIn: Date;
  checkOut?: Date;
  location?: {
    lat: number;
    lng: number;
  };
  duration?: number;
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
