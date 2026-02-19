
import React, { useState, useMemo } from 'react';
import { AttendanceRecord, User } from '../types';
import { dataService } from '../services/dataService';

interface Props {
  history: AttendanceRecord[];
  user: User;
  onRefresh?: () => void;
}

const History: React.FC<Props> = ({ history, user, onRefresh }) => {
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

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

  const filteredHistory = useMemo(() => {
    return history.filter(record => {
      const recordDate = new Date(record.checkIn);
      recordDate.setHours(0, 0, 0, 0);
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        if (recordDate < start) return false;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (recordDate > end) return false;
      }
      return true;
    });
  }, [history, startDate, endDate]);

  const totalHours = useMemo(() => {
    return filteredHistory.reduce((acc, record) => {
      const rawDuration = Number(record.duration);
      const calcDuration = record.checkOut ? (new Date(record.checkOut).getTime() - new Date(record.checkIn).getTime()) / 60000 : 0;
      const finalDuration = (!isNaN(rawDuration) && rawDuration > 0) ? rawDuration : calcDuration;
      return acc + (finalDuration / 60);
    }, 0);
  }, [filteredHistory]);

  const now = new Date();

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 no-print">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Attendance Log</h1>
          <p className="text-slate-500 font-medium">Historical site presence for <span className="text-indigo-600 font-bold">{user.name}</span></p>
        </div>
        <div className="flex flex-wrap items-end gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex flex-col">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">From Date</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none" />
          </div>
          <div className="flex flex-col">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">To Date</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none" />
          </div>
          <div className="flex gap-2">
            {(startDate || endDate) && <button onClick={() => { setStartDate(''); setEndDate(''); }} className="px-4 py-2 bg-slate-100 text-slate-500 rounded-xl font-black text-[10px] uppercase tracking-widest">Clear</button>}
            <button onClick={() => window.print()} className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg flex items-center space-x-2">
              <i className="fa-solid fa-print"></i>
              <span>Print Sheet</span>
            </button>
          </div>
        </div>
      </div>

      <div className="hidden print:block mb-8 border-b-2 border-slate-900 pb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tighter">Attendance Timesheet</h1>
            <p className="text-sm font-bold text-slate-600">Employee: {user.name} ({user.employeeId})</p>
            <p className="text-xs font-medium text-slate-500 mt-1">Period: {startDate || 'Beginning'} — {endDate || 'Present'}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-black uppercase text-slate-400 tracking-widest">Absar Alomran Construction</p>
            <p className="text-xs font-bold mt-1">Generated: {new Date().toLocaleDateString()}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden card">
        {filteredHistory.length === 0 ? (
          <div className="p-20 text-center">
            <i className="fa-solid fa-calendar-xmark text-4xl text-slate-100 mb-4 block"></i>
            <p className="text-slate-400 font-medium tracking-tight">No records found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50/50">
                <tr>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Date</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Clock In</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Clock Out</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right">Duration</th>
                  <th className="px-6 py-4 text-center text-[10px] font-black uppercase text-slate-400 tracking-widest">Status</th>
                  <th className="px-6 py-4 text-right text-[10px] font-black uppercase text-slate-400 tracking-widest no-print">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredHistory.map((record) => {
                  const rawDuration = Number(record.duration);
                  const cinDate = new Date(record.checkIn);
                  const coutDate = record.checkOut ? new Date(record.checkOut) : null;
                  const calcDuration = coutDate ? (coutDate.getTime() - cinDate.getTime()) / 60000 : 0;
                  const finalDuration = (!isNaN(rawDuration) && rawDuration > 0) ? rawDuration : calcDuration;
                  
                  // Logical check: Is this record truly stale? 
                  // It's stale if it's over 24 hours old and has no checkout.
                  // This allows night shifts to stay active across midnight.
                  const isStale = !coutDate && (now.getTime() - cinDate.getTime() > 86400000);

                  return (
                    <tr key={record.id} className={`hover:bg-slate-50/30 transition-colors ${record.needsReview || isStale ? 'bg-rose-50/20' : ''}`}>
                      <td className="px-6 py-4 font-bold text-slate-900">
                        {cinDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="px-6 py-4 font-mono text-xs font-bold text-slate-500">
                        {cinDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-6 py-4 font-mono text-xs font-bold text-slate-500">
                        {coutDate ? coutDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (isStale ? '--' : 'Ongoing')}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="font-mono font-black text-slate-700">
                          {finalDuration > 0 ? `${(finalDuration / 60).toFixed(2)}h` : '--'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex flex-wrap justify-center gap-1">
                          {record.autoClosed && <span className="px-2 py-0.5 bg-rose-100 text-rose-700 text-[8px] font-black uppercase rounded border border-rose-200">Auto-Closed</span>}
                          {isStale && <span className="px-2 py-0.5 bg-rose-500 text-white text-[8px] font-black uppercase rounded border border-rose-600">Pending Termination</span>}
                          {record.needsReview && !record.autoClosed && <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-[8px] font-black uppercase rounded border border-orange-200">Flagged</span>}
                          {!record.needsReview && coutDate && <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[8px] font-black uppercase rounded border border-emerald-200">Verified</span>}
                          {!coutDate && !isStale && <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[8px] font-black uppercase rounded border border-indigo-200">Active</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right no-print">
                        {dataService.getCurrentUser()?.role === 'admin' && (
                          <button onClick={() => setEditingRecord(record)} className="w-8 h-8 rounded-lg bg-slate-50 text-slate-400 hover:text-indigo-600 shadow-sm"><i className="fa-solid fa-pen-to-square text-xs"></i></button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-900 text-white font-black">
                <tr>
                  <td colSpan={3} className="px-6 py-4 uppercase text-[10px] tracking-widest">Total Billable Hours</td>
                  <td className="px-6 py-4 text-right font-mono text-indigo-200">{totalHours.toFixed(2)}h</td>
                  <td className="px-6 py-4"></td>
                  <td className="px-6 py-4 no-print"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      <div className="hidden print:flex mt-16 justify-between items-end gap-12">
        <div className="flex-1 border-t border-slate-900 pt-3"><p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-8">Employee Signature</p></div>
        <div className="flex-1 border-t border-slate-900 pt-3"><p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-8">Site Manager Approval</p></div>
        <div className="flex-1 border-t border-slate-900 pt-3"><p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-8">Human Resources Seal</p></div>
      </div>

      {editingRecord && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden animate-fadeIn">
            <div className="bg-indigo-600 p-8 text-white flex justify-between items-center">
              <div><h2 className="text-xl font-black">Correct Shift Data</h2><p className="text-[10px] font-black uppercase opacity-70">Admin Audit Override</p></div>
              <button onClick={() => setEditingRecord(null)} className="text-white/60 hover:text-white"><i className="fa-solid fa-circle-xmark text-2xl"></i></button>
            </div>
            <form onSubmit={handleUpdate} className="p-8 space-y-6">
              <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Clock In</label><input name="checkIn" type="datetime-local" defaultValue={formatDateForInput(new Date(editingRecord.checkIn))} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" /></div>
              <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Clock Out</label><input name="checkOut" type="datetime-local" defaultValue={editingRecord.checkOut ? formatDateForInput(new Date(editingRecord.checkOut)) : ''} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" /></div>
              <div className="pt-4 flex gap-4">
                <button type="button" onClick={() => setEditingRecord(null)} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-xs uppercase">Cancel</button>
                <button disabled={saving} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase shadow-xl shadow-indigo-100">{saving ? <i className="fa-solid fa-circle-notch fa-spin"></i> : 'Publish Correction'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default History;
