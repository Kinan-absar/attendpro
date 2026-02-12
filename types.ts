
export type UserRole = 'admin' | 'employee';

export interface User {
  id: string;
  email: string;
  name: string;
  employeeId: string;
  department: string;
  role: UserRole;
  avatar?: string;
  grossSalary?: number;
  company?: string;
  standardHours?: number; // Per-employee standard hours override
  fixedPayroll?: boolean; // Deprecated: use granular toggles instead
  disableOvertime?: boolean; // If true, do not calculate overtime pay
  disableDeductions?: boolean; // If true, do not calculate non-attendance deductions
}

export interface MobilityLog {
  timestamp: Date;
  status: 'inside' | 'outside';
}

export interface AttendanceRecord {
  id: string;
  userId: string;
  userName: string;
  checkIn: Date;
  checkOut?: Date;
  duration?: number;
  projectId?: string;
  location?: {
    lat: number;
    lng: number;
    accuracy?: number;
  };
  mobilityLogs?: MobilityLog[];
}

export interface Geofence {
  lat: number;
  lng: number;
  radius: number; // in meters
  enabled: boolean;
}

export interface Project {
  id: string;
  name: string;
  geofence: Geofence;
  assignedUserIds: string[];
}

export interface MonthlyReport {
  month: string;
  year: number;
  requiredHours?: number;
  employees: {
    name: string;
    totalHours: number;
    shiftCount: number;
    projectId?: string;
  }[];
}

export interface UserProfile {
  id: string;
  name: string;
  employeeId: string;
  avatar: string;
  department: string;
}

export interface OdooConfig {
  url?: string;
  db?: string;
  username?: string;
  password?: string;
}

export interface AIInsight {
  summary: string;
  suggestions: string[];
  trend: 'positive' | 'neutral' | 'negative';
}
