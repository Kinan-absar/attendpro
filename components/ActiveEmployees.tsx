
import React, { useEffect, useState } from 'react';
import { dataService } from '../services/dataService';
import { AttendanceRecord, User } from '../types';

interface ActiveShift {
  user: User;
  record: AttendanceRecord;
}

const ActiveEmployees: React.FC = () => {
  const [active, setActive] = useState<ActiveShift[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000); 
    return () => clearInterval(timer);
  }, []);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [users, allAttendance] = await Promise.all([
        dataService.getUsers(),
        dataService.getAllAttendance()
      ]);
      
      const todayStr = new Date().toDateString();
      
      // Filter records: Must have no checkOut AND must have started TODAY
      // If they started yesterday, they are "Awaiting Auto-Close" and shouldn't show in Live Active tab
      const currentActiveRecords = allAttendance.filter(r => 
        r.checkIn && 
        r.checkIn.getTime() > 1000000 && 
        !r.checkOut &&
        r.checkIn.toDateString() === todayStr
      );
      
      const activeShifts: ActiveShift[] = [];
      const processedUserIds = new Set<string>();

      currentActiveRecords.sort((a, b) => b.checkIn.getTime() - a.checkIn.getTime()).forEach(record => {
        if (!processedUserIds.has(record.userId)) {
          const user = users.find(u => u.id === record.userId);
          if (user) {
            activeShifts.push({ user, record });
            processedUserIds.add(record.userId);
          }
        }
      });

      setActive(activeShifts);
    } catch (err: any) {
      console.error("Failed to load active employees", err);
      if (err.message?.includes('PERMISSION_DENIED') || err.code === 'permission-denied') {
        setError("DATABASE_RESTRICTED: You don't have permission to view staff logs. Ensure your user profile is set to 'admin' and Firestore Rules are published.");
      } else {
        setError("Failed to sync active operations.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // Refresh active list every 30 seconds to catch auto-closures
    const refreshTimer = setInterval(load, 30000);
    return () => clearInterval(refreshTimer);
  }, []);

  const getDuration = (start: Date) => {
    const diffMs = Math.max(0, now.getTime() - start.getTime());
    const hours = Math.floor(diffMs / 3600000);
    const minutes = Math.floor((diffMs % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  };

  if (loading && active.length === 0) return (
    <div className="p-20 text-center">
      <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
      <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Scanning Active Workforce...</p>
    </div>
  );

  if (error) return (
    <div className="p-10 max-w-2xl mx-auto bg-rose-50 border border-rose-100 rounded-3xl text-center space-y-4">
      <i className="fa-solid fa-shield-halved text-4xl text-rose-500"></i>
      <h3 className="text-lg font-black text-rose-900 uppercase">Access Restricted</h3>
      <p className="text-sm text-rose-700 font-medium leading-relaxed">{error}</p>
      <button onClick={load} className="px-6 py-2 bg-rose-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest">Retry Sync</button>
    </div>
  );

  return (
    <div className="space-y-8 animate-fadeIn pb-20">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Active Operations</h1>
          <p className="text-slate-500">Real-time status of staff currently on shift</p>
        </div>
        <div className="flex gap-4">
          <button onClick={load} className="p-3 bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 rounded-xl transition-all shadow-sm">
            <i className="fa-solid fa-rotate"></i>
          </button>
          <div className="bg-indigo-600 text-white px-4 py-2 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-indigo-100 flex items-center">
            {active.length} Live {active.length === 1 ? 'User' : 'Users'}
          </div>
        </div>
      </div>

      {active.length === 0 ? (
        <div className="bg-white p-20 rounded-[2.5rem] border border-dashed border-slate-200 text-center">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="fa-solid fa-moon text-slate-200 text-2xl"></i>
          </div>
          <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No employees currently clocked in.</p>
        </div>
      ) : (
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50">
                  <th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest">Employee</th>
                  <th className="px-6 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest">Clocked In At</th>
                  <th className="px-6 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">Site Presence</th>
                  <th className="px-8 py-5 text-right text-[10px] font-black uppercase text-slate-400 tracking-widest">Shift Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {active.map((a) => {
                  const logs = a.record.mobilityLogs || [];
                  const lastLog = logs[logs.length - 1];
                  const lastExit = [...logs].reverse().find(l => l.status === 'outside');
                  const isInside = lastLog ? lastLog.status === 'inside' : true;

                  return (
                    <tr key={a.user.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-8 py-5">
                        <div className="flex items-center space-x-4">
                          <img 
                            src={a.user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(a.user.name)}&background=random`} 
                            className="w-11 h-11 rounded-2xl border border-slate-100 shadow-sm" 
                            alt="" 
                          />
                          <div>
                            <p className="font-bold text-slate-900 leading-tight">{a.user.name}</p>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">{a.user.department}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-col">
                           <span className="font-mono font-bold text-slate-700">
                             {a.record.checkIn.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                           </span>
                           {lastExit && !isInside && (
                             <span className="text-[8px] font-black text-rose-400 uppercase tracking-tighter">
                               Left at {lastExit.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                             </span>
                           )}
                        </div>
                      </td>
                      <td className="px-6 py-5 text-center">
                        <span className={`inline-flex items-center px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest gap-2 ${
                          isInside ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                        }`}>
                          <i className={`fa-solid ${isInside ? 'fa-location-dot' : 'fa-person-walking-arrow-right'}`}></i>
                          {isInside ? 'On Site' : 'Away'}
                        </span>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <span className="text-sm font-black text-indigo-600">
                          {getDuration(a.record.checkIn)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActiveEmployees;
