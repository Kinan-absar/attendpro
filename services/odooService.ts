
import { AttendanceRecord, OdooConfig, UserProfile } from '../types';

/**
 * Note: Odoo standard API uses XML-RPC which is difficult to call directly from a browser 
 * due to CORS. In a real production scenario, you would use a lightweight proxy or 
 * Odoo's JSON-RPC endpoints with proper CORS headers.
 */

const STORAGE_KEY = 'odoo_checkin_records';
const CONFIG_KEY = 'odoo_checkin_config';

export const odooService = {
  saveConfig: (config: OdooConfig) => {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  },

  getConfig: (): OdooConfig | null => {
    const data = localStorage.getItem(CONFIG_KEY);
    return data ? JSON.parse(data) : null;
  },

  // Updated to include an 'id' property in the returned UserProfile
  getProfile: async (): Promise<UserProfile> => {
    // Simulate API fetch delay
    await new Promise(resolve => setTimeout(resolve, 800));
    return {
      id: "mitchell-admin-id",
      name: "Mitchell Admin",
      employeeId: "EMP-001",
      avatar: "https://picsum.photos/seed/mitchell/200/200",
      department: "Research & Development"
    };
  },

  getAttendanceHistory: async (): Promise<AttendanceRecord[]> => {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    
    return JSON.parse(data).map((r: any) => ({
      ...r,
      checkIn: new Date(r.checkIn),
      checkOut: r.checkOut ? new Date(r.checkOut) : undefined
    }));
  },

  // Fix: Fetches profile to populate required userId and userName in AttendanceRecord
  checkIn: async (location?: { lat: number; lng: number }): Promise<AttendanceRecord> => {
    const history = await odooService.getAttendanceHistory();
    const profile = await odooService.getProfile();
    const newRecord: AttendanceRecord = {
      id: Date.now(),
      userId: profile.id,
      userName: profile.name,
      checkIn: new Date(),
      location
    };
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify([newRecord, ...history]));
    return newRecord;
  },

  checkOut: async (): Promise<AttendanceRecord> => {
    const history = await odooService.getAttendanceHistory();
    const activeIdx = history.findIndex(r => !r.checkOut);
    
    if (activeIdx === -1) throw new Error("No active check-in found.");
    
    const record = history[activeIdx];
    record.checkOut = new Date();
    record.duration = Math.round((record.checkOut.getTime() - record.checkIn.getTime()) / 60000);
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    return record;
  }
};
