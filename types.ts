
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

// Added missing UserProfile interface used by odooService
export interface UserProfile {
  id: string;
  name: string;
  employeeId: string;
  avatar: string;
  department: string;
}

// Added missing OdooConfig interface used by odooService
export interface OdooConfig {
  url?: string;
  db?: string;
  username?: string;
  password?: string;
}

// Added missing AIInsight interface for Gemini analysis results
export interface AIInsight {
  summary: string;
  suggestions: string[];
  trend: 'positive' | 'neutral' | 'negative';
}
