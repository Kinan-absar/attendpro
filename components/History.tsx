
import React, { useState } from 'react';
import { AttendanceRecord, User } from '../types';
import { dataService } from '../services/dataService';

interface Props {
  history: AttendanceRecord[];
  user: User;
  onRefresh?: () => void;
}

const History: React.FC<Props> = ({ history, user, onRefresh }) => {
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handlePrint = () => window.print();

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;
    setSaving(true);
    try {
      const form = e.target as any;
      const checkIn = new Date(form.checkIn.value);
      const checkOut = form.checkOut.value ? new Date(form.checkOut.value) : undefined;
      
      await dataService.updateAttendanceRecord(editingRecord.id, { checkIn, checkOut });
      setEditingRecord(null);
      if (onRefresh) onRefresh();
      alert("Shift record corrected successfully.");
    } catch (err) {
      alert("Update failed.");
    } finally {
      setSaving(false);
    }
  };

  const formatDateForInput = (date: Date) => {
    const tzOffset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Attendance Log</h1>
          <p className="text-slate-500">Historical records and mobility audit</p>
        </div>
        <button onClick={handlePrint} className="px-5 py-3 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-indigo-100 flex items-center space-x-2">
          <i className="fa-solid fa-print"></i>
          <span>Print Summary</span>
        </button>
      </div>

      <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden card">
        {history.length === 0 ? (
          <div className="p-20 text-center">
            <i className="fa-solid fa-calendar-xmark text-4xl text-slate-100 mb-4 block"></i>
            <p className="text-slate-400 font-medium tracking-tight">No attendance records found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50/50">
                <tr>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Date & Window</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Duration</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Status</th>
                  <th className="px-6 py-4 text-right text-[10px] font-black uppercase text-slate-400 no-print">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.map((record) => (
                  <React.Fragment key={record.id}>
                    <tr className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-bold text-slate-900">{record.checkIn.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                        <p className="text-[10px] font-black text-indigo-500 uppercase">
                          {record.checkIn.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {record.checkOut ? ` - ${record.checkOut.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ' (Ongoing)'}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-mono font-black text-slate-600">
                          {record.duration ? `${(record.duration / 60).toFixed(2)}h` : '--'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                         <button 
                           onClick={() => setExpandedId(expandedId === record.id ? null : record.id)}
                           className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-2 ${
                             record.checkOut ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-600'
                           }`}
                         >
                           {record.checkOut ? 'Complete' : 'In Progress'}
                           <i className={`fa-solid fa-chevron-${expandedId === record.id ? 'up' : 'down'}`}></i>
                         </button>
                      </td>
                      <td className="px-6 py-4 text-right no-print">
                        {user.role === 'admin' && (
                          <button 
                            onClick={() => setEditingRecord(record)}
                            className="w-9 h-9 rounded-xl bg-slate-50 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-all shadow-sm"
                          >
                            <i className="fa-solid fa-pen-to-square text-xs"></i>
                          </button>
                        )}
                      </td>
                    </tr>
                    {expandedId === record.id && (
                      <tr className="bg-slate-50/30">
                        <td colSpan={4} className="px-12 py-6">
                           <div className="border-l-2 border-indigo-200 pl-6 space-y-4">
                              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Site Presence Timeline</h4>
                              {record.mobilityLogs && record.mobilityLogs.length > 0 ? (
                                record.mobilityLogs.map((log, idx) => (
                                  <div key={idx} className="flex items-center space-x-4 animate-fadeIn">
                                    <div className={`w-2 h-2 rounded-full ${log.status === 'inside' ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]' : 'bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.5)]'}`}></div>
                                    <span className="text-[11px] font-bold text-slate-500 w-24">{log.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                                    <span className={`text-[10px] font-black uppercase tracking-widest ${log.status === 'inside' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                      {log.status === 'inside' ? (idx === 0 ? 'Clocked In (On Site)' : 'Returned to Site') : 'Exited Site boundary'}
                                    </span>
                                  </div>
                                ))
                              ) : (
                                <p className="text-[10px] text-slate-400 font-bold italic">No mobility logs recorded for this shift.</p>
                              )}
                           </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ADMIN EDIT MODAL */}
      {editingRecord && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden animate-fadeIn">
            <div className="bg-indigo-600 p-8 text-white flex justify-between items-center">
              <div>
                <h2 className="text-xl font-black tracking-tight">Edit Shift Data</h2>
                <p className="text-xs text-indigo-100 font-bold uppercase tracking-widest mt-1">Manual Correction</p>
              </div>
              <button onClick={() => setEditingRecord(null)} className="text-white/60 hover:text-white transition-colors">
                <i className="fa-solid fa-circle-xmark text-2xl"></i>
              </button>
            </div>
            <form onSubmit={handleUpdate} className="p-8 space-y-6">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Clock In Time</label>
                <input 
                  name="checkIn" 
                  type="datetime-local" 
                  defaultValue={formatDateForInput(editingRecord.checkIn)} 
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all" 
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Clock Out Time</label>
                <input 
                  name="checkOut" 
                  type="datetime-local" 
                  defaultValue={editingRecord.checkOut ? formatDateForInput(editingRecord.checkOut) : ''} 
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all" 
                  placeholder="Leave empty if shift is ongoing"
                />
              </div>
              <div className="pt-4 flex gap-4">
                <button type="button" onClick={() => setEditingRecord(null)} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-sm">Cancel</button>
                <button disabled={saving} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-lg shadow-indigo-100 flex items-center justify-center">
                  {saving ? <i className="fa-solid fa-circle-notch fa-spin"></i> : 'Apply Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default History;
