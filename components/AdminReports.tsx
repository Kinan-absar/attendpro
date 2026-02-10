
import React, { useState, useEffect } from 'react';
import { dataService } from '../services/dataService';
import { MonthlyReport, AttendanceRecord, User } from '../types';
import History from './History';

const AdminReports: React.FC = () => {
  const [reports, setReports] = useState<MonthlyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState<{ user: User; records: AttendanceRecord[] } | null>(null);

  useEffect(() => {
    const fetch = async () => {
      const data = await dataService.getMonthlyReports();
      setReports(data);
      setLoading(false);
    };
    fetch();
  }, []);

  const handleViewEmployee = async (employeeName: string) => {
    const allUsers = dataService.getUsers();
    const user = allUsers.find(u => u.name === employeeName);
    if (user) {
      const history = await dataService.getAttendanceHistory(user.id);
      setSelectedEmployee({ user, records: history });
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Generating reports...</div>;

  if (selectedEmployee) {
    return (
      <div className="space-y-6">
        <button 
          onClick={() => setSelectedEmployee(null)}
          className="no-print flex items-center text-indigo-600 font-semibold mb-4 hover:translate-x-[-4px] transition-transform"
        >
          <i className="fa-solid fa-arrow-left mr-2"></i>
          Back to Reports
        </button>
        <History history={selectedEmployee.records} user={selectedEmployee.user} />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      <div className="flex items-center justify-between no-print">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Manager Dashboard</h1>
          <p className="text-slate-500">Aggregate monthly hours for all staff</p>
        </div>
        <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
          <i className="fa-solid fa-chart-line text-xl"></i>
        </div>
      </div>

      {reports.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl text-center border border-dashed border-slate-300">
          <p className="text-slate-400">No shift data available for reporting yet.</p>
        </div>
      ) : (
        reports.map((report, idx) => (
          <div key={`${report.year}-${report.month}`} className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden card">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-800">
                {report.month} {report.year}
              </h3>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                {report.employees.length} Active Staff
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Employee</th>
                    <th className="px-6 py-3 text-center text-xs font-bold text-slate-400 uppercase">Shifts</th>
                    <th className="px-6 py-3 text-right text-xs font-bold text-slate-400 uppercase">Total Hours</th>
                    <th className="px-6 py-3 text-right text-xs font-bold text-slate-400 uppercase no-print">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {report.employees.map((emp, eIdx) => (
                    <tr key={eIdx} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 font-semibold text-slate-700">{emp.name}</td>
                      <td className="px-6 py-4 text-center">
                        <span className="px-2 py-1 bg-slate-100 rounded-md text-sm text-slate-600">{emp.shiftCount}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="font-mono font-bold text-indigo-600">{emp.totalHours.toFixed(2)} hrs</span>
                      </td>
                      <td className="px-6 py-4 text-right no-print">
                        <button 
                          onClick={() => handleViewEmployee(emp.name)}
                          className="text-xs bg-white border border-slate-200 px-3 py-1.5 rounded-lg font-bold text-slate-600 hover:border-indigo-600 hover:text-indigo-600 transition-all"
                        >
                          View Logs
                        </button>
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-indigo-50/30">
                    <td className="px-6 py-4 font-bold text-indigo-900">Monthly Total</td>
                    <td className="px-6 py-4 text-center font-bold text-indigo-900">
                      {report.employees.reduce((acc, e) => acc + e.shiftCount, 0)}
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-indigo-900">
                      {report.employees.reduce((acc, e) => acc + e.totalHours, 0).toFixed(2)} hrs
                    </td>
                    <td className="no-print"></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default AdminReports;
