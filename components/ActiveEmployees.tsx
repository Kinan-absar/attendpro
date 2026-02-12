
import React, { useEffect, useState, useMemo } from 'react';
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

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000); // Update every minute for duration calculation
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const [users, allAttendance] = await Promise.all([
          dataService.getUsers(),
          dataService.getAllAttendance()
        ]);
        
        // Group by userId and take only the latest active record per user
        const latestActives: Record<string, ActiveShift> = {};
        
        allAttendance.forEach(record => {
          if (record.checkIn && !record.checkOut) {
            const user = users.find(u => u.id === record.userId);
            if (user) {
              // If we already have a record for this user, keep the newer one
              if (!latestActives[user.id] || record.checkIn > latestActives[user.id].record.checkIn) {
                latestActives[user.id] = { user, record };
              }
            }
          }
        });

        setActive(Object.values(latestActives).sort((a, b) => b.record.checkIn.getTime() - a.record.checkIn.getTime()));
      } catch (err) {
        console.error("Failed to load active employees", err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const getDuration = (start: Date) => {
    const diffMs = now.getTime() - start.getTime();
    const hours = Math.floor(diffMs / 3600000);
    const minutes = Math.floor((diffMs % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  };

  if (loading) return (
    <div className="p-20 text-center">
      <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
      <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Scanning Active Workforce...</p>
    </div>
  );

  return (
    <div className="space-y-8 animate-fadeIn pb-20">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Active Operations</h1>
          <p className="text-slate-500">Real-time status of staff currently on shift</p>
        </div>
        <div className="bg-indigo-600 text-white px-4 py-2 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-indigo-100">
          {active.length} Live {active.length === 1 ? 'User' : 'Users'}
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
                  const lastLog = a.record.mobilityLogs?.[a.record.mobilityLogs.length - 1];
                  const isInside = lastLog ? lastLog.status === 'inside' : true;

                  return (
                    <tr key={a.user.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-8 py-5">
                        <div className="flex items-center space-x-4">
                          <div className="relative">
                            <img 
                              src={a.user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(a.user.name)}&background=random`} 
                              className="w-11 h-11 rounded-2xl border border-slate-100 shadow-sm" 
                              alt="" 
                            />
                            <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${isInside ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'}`}></div>
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 leading-tight">{a.user.name}</p>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">{a.user.department}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center space-x-2">
                           <i className="fa-solid fa-clock text-indigo-300 text-xs"></i>
                           <span className="font-mono font-bold text-slate-700">
                             {a.record.checkIn.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                           </span>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-center">
                        <span className={`inline-flex items-center px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest gap-2 ${
                          isInside ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                        }`}>
                          <i className={`fa-solid ${isInside ? 'fa-location-dot' : 'fa-person-walking-arrow-right'}`}></i>
                          {isInside ? 'On Site' : 'Away from Site'}
                        </span>
                        {lastLog && !isInside && (
                          <p className="text-[8px] font-black text-slate-300 mt-1 uppercase">
                            Since {lastLog.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        )}
                      </td>
                      <td className="px-8 py-5 text-right">
                        <div className="flex flex-col items-end">
                          <span className="text-sm font-black text-indigo-600">
                            {getDuration(a.record.checkIn)}
                          </span>
                          <div className="w-16 h-1 bg-slate-100 rounded-full mt-1 overflow-hidden">
                            <div className="h-full bg-indigo-500 animate-pulse" style={{ width: '40%' }}></div>
                          </div>
                        </div>
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
