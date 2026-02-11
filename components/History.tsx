
import React from 'react';
import { AttendanceRecord, User } from '../types';
import { dataService } from '../services/dataService';

interface Props {
  history: AttendanceRecord[];
  user: User;
}

const History: React.FC<Props> = ({ history, user }) => {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Print Header (Only visible when printing) */}
      <div className="print-only mb-8 text-center border-b pb-4">
        <h1 className="text-2xl font-bold uppercase tracking-widest">Attendance Timesheet</h1>
        <div className="flex justify-between mt-4 text-sm px-4">
          <div className="text-left">
            <p><strong>Employee:</strong> {user.name}</p>
            <p><strong>ID:</strong> {user.employeeId}</p>
          </div>
          <div className="text-right">
            <p><strong>Department:</strong> {user.department}</p>
            <p><strong>Date Generated:</strong> {new Date().toLocaleDateString()}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Personal Timesheet</h1>
          <p className="text-slate-500">Your historical attendance logs</p>
        </div>
        <div className="flex items-center space-x-2">
          <button 
            onClick={handlePrint}
            className="flex items-center space-x-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100"
          >
            <i className="fa-solid fa-print"></i>
            <span>Print Timesheet</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden card">
        {history.length === 0 ? (
          <div className="p-20 text-center no-print">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-200">
              <i className="fa-solid fa-calendar-xmark text-3xl"></i>
            </div>
            <p className="text-slate-400 font-medium">No logs found for your account.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50/50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">Time Window</th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">Duration</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-slate-400 uppercase tracking-wider no-print">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.map((record) => (
                  <tr key={record.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4">
                      <p className="font-bold text-slate-900">{record.checkIn.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                      <p className="text-xs text-slate-400">{record.checkIn.toLocaleDateString([], { weekday: 'long' })}</p>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center space-x-2">
                        <span className="text-sm font-bold text-slate-600">{record.checkIn.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        <i className="fa-solid fa-arrow-right-long text-slate-300 text-[10px]"></i>
                        <span className="text-sm font-bold text-slate-600">
                          {record.checkOut ? record.checkOut.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '---'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="font-mono font-bold text-slate-500">
                        {record.duration ? `${(record.duration / 60).toFixed(2)}h` : '--'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right no-print">
                      {record.checkOut ? (
                        <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase">Completed</span>
                      ) : (
                        <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase animate-pulse">In Progress</span>
                      )}
                    </td>
                  </tr>
                ))}
                <tr className="bg-slate-50/30 print:bg-white border-t-2 border-slate-200">
                  <td colSpan={2} className="px-6 py-4 font-bold text-right text-slate-400 uppercase text-xs">Total Tracked Hours</td>
                  <td className="px-6 py-4 text-center font-bold text-indigo-600 text-lg">
                    {(history.reduce((acc, r) => acc + (r.duration || 0), 0) / 60).toFixed(2)} hrs
                  </td>
                  <td className="no-print"></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="print-only mt-24">
        <div className="flex justify-between px-12">
          <div className="border-t border-slate-400 w-48 pt-2 text-center text-xs">Employee Signature</div>
          <div className="border-t border-slate-400 w-48 pt-2 text-center text-xs">Supervisor Signature</div>
        </div>
      </div>
    </div>
  );
};

export default History;
