
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
