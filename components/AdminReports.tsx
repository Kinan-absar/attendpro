
import React, { useState, useEffect } from 'react';
import { dataService } from '../services/dataService';
import { MonthlyReport, AttendanceRecord, User } from '../types';
import History from './History';

const AdminReports: React.FC = () => {
  const [reports, setReports] = useState<MonthlyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState<string>('all');
  const [selectedEmployee, setSelectedEmployee] = useState<{ user: User; records: AttendanceRecord[] } | null>(null);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  
  // Financial Configuration
  const [globalRequiredHours, setGlobalRequiredHours] = useState<number>(160); // Default to 160
  const [grossRates, setGrossRates] = useState<Record<string, number>>({});
  const [overtimeRates, setOvertimeRates] = useState<Record<string, number>>({});

  const handleRateChange = (setter: React.Dispatch<React.SetStateAction<Record<string, number>>>, name: string, value: number) => {
    setter(prev => ({
      ...prev,
      [name]: value
    }));
  };

  /* ================= FETCH REPORTS ================= */
  useEffect(() => {
    const fetch = async () => {
      setLoading(true);

      const from = fromDate ? new Date(fromDate) : undefined;
      const to = toDate ? new Date(toDate) : undefined;

      const data = await dataService.getMonthlyReports(from, to);
      setReports(data);
      setLoading(false);
    };

    fetch();
  }, [fromDate, toDate]);

  /* ================= VIEW EMPLOYEE ================= */
  const handleViewEmployee = async (employeeName: string) => {
    const allUsers = await dataService.getUsers();
    const user = allUsers.find(u => u.name === employeeName);
    if (!user) return;

    const history = await dataService.getAttendanceHistory(user.id);
    setSelectedEmployee({ user, records: history });
  };

  if (loading) {
    return (
      <div className="p-20 text-center space-y-4">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-slate-500 font-medium">Generating financial reports...</p>
      </div>
    );
  }

  if (selectedEmployee) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => setSelectedEmployee(null)}
          className="flex items-center text-indigo-600 font-bold hover:text-indigo-800 transition-colors"
        >
          <i className="fa-solid fa-arrow-left mr-2"></i>
          Back to Reports
        </button>
        <History history={selectedEmployee.records} user={selectedEmployee.user} />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12 animate-fadeIn">
      {/* HEADER SECTION */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Payroll & Reports</h1>
          <p className="text-slate-500">Manage hours, rates, and financial adjustments for all staff</p>
        </div>
        
        <div className="flex flex-wrap items-end gap-4 no-print bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-indigo-600 uppercase mb-1 ml-1 flex items-center">
              <i className="fa-solid fa-clock-rotate-left mr-1"></i> Global Required Hours
            </span>
            <input
              type="number"
              value={globalRequiredHours}
              onChange={(e) => setGlobalRequiredHours(parseFloat(e.target.value) || 0)}
              className="px-4 py-2 w-32 bg-indigo-50 border border-indigo-100 rounded-xl text-sm font-bold text-indigo-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              placeholder="e.g. 160"
            />
          </div>

          <div className="h-10 w-px bg-slate-200 hidden md:block"></div>

          <div className="flex flex-col">
            <span className="text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">From Date</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">To Date</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            />
          </div>
        </div>
      </div>

      {reports.length === 0 ? (
        <div className="bg-white p-20 rounded-3xl border border-dashed border-slate-300 text-center">
          <i className="fa-solid fa-file-invoice-dollar text-4xl text-slate-200 mb-4"></i>
          <p className="text-slate-400 font-medium">No attendance data found for the selected period.</p>
        </div>
      ) : (
        reports.map((report) => {
          const filteredEmployees =
            selectedEmployeeFilter === 'all'
              ? report.employees
              : report.employees.filter(e => e.name === selectedEmployeeFilter);

          const totals = filteredEmployees.reduce((acc, e) => {
            const diff = e.totalHours - globalRequiredHours;
            const gross = grossRates[e.name] || 0;
            const ot = overtimeRates[e.name] || 0;
            
            const deduction = diff < 0 ? Math.abs(diff) * gross : 0;
            const otPay = diff > 0 ? diff * ot : 0;

            return {
              shifts: acc.shifts + e.shiftCount,
              hours: acc.hours + e.totalHours,
              deductions: acc.deductions + deduction,
              overtime: acc.overtime + otPay
            };
          }, { shifts: 0, hours: 0, deductions: 0, overtime: 0 });

          return (
            <div
              key={`${report.year}-${report.month}`}
              className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden mb-12"
            >
              <div className="px-8 py-6 bg-slate-50 border-b border-slate-100 flex flex-wrap gap-6 items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
                    <i className="fa-solid fa-calendar-check text-xl"></i>
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 leading-none mb-1">
                      {report.month} {report.year}
                    </h3>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                      Standard: {globalRequiredHours} Hrs
                    </p>
                  </div>
                </div>

                <div className="no-print">
                  <select
                    value={selectedEmployeeFilter}
                    onChange={(e) => setSelectedEmployeeFilter(e.target.value)}
                    className="pl-4 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none appearance-none cursor-pointer"
                  >
                    <option value="all">All Employees</option>
                    {report.employees.map(emp => (
                      <option key={emp.name} value={emp.name}>{emp.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50/50">
                      <th className="px-6 py-4 text-left font-black text-slate-400 uppercase text-[10px] tracking-widest">Employee</th>
                      <th className="px-4 py-4 text-center font-black text-slate-400 uppercase text-[10px] tracking-widest">Shifts</th>
                      <th className="px-4 py-4 text-right font-black text-slate-400 uppercase text-[10px] tracking-widest">Total Hrs</th>
                      <th className="px-4 py-4 text-right font-black text-slate-400 uppercase text-[10px] tracking-widest">Req. Hrs</th>
                      <th className="px-4 py-4 text-right font-black text-slate-400 uppercase text-[10px] tracking-widest">Diff</th>
                      <th className="px-4 py-4 text-right font-black text-indigo-400 uppercase text-[10px] tracking-widest">Gross Rate (SR)</th>
                      <th className="px-4 py-4 text-right font-black text-indigo-400 uppercase text-[10px] tracking-widest">OT Rate (SR)</th>
                      <th className="px-4 py-4 text-right font-black text-rose-400 uppercase text-[10px] tracking-widest">Deduction</th>
                      <th className="px-4 py-4 text-right font-black text-emerald-400 uppercase text-[10px] tracking-widest">OT Pay</th>
                      <th className="px-6 py-4 text-right font-black text-slate-400 uppercase text-[10px] tracking-widest no-print">Actions</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {filteredEmployees.map((emp) => {
                      const diff = emp.totalHours - globalRequiredHours;
                      const gross = grossRates[emp.name] || 0;
                      const ot = overtimeRates[emp.name] || 0;
                      
                      const deductionAmount = diff < 0 ? Math.abs(diff) * gross : 0;
                      const overtimePay = diff > 0 ? diff * ot : 0;

                      return (
                        <tr key={emp.name} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4">
                            <span className="font-bold text-slate-900">{emp.name}</span>
                          </td>

                          <td className="px-4 py-4 text-center">
                            <span className="px-2 py-1 bg-slate-100 rounded text-xs font-black text-slate-500">
                              {emp.shiftCount}
                            </span>
                          </td>

                          <td className="px-4 py-4 text-right font-mono font-bold text-slate-700">
                            {emp.totalHours.toFixed(2)}
                          </td>

                          <td className="px-4 py-4 text-right">
                            <span className="font-mono text-slate-400 text-xs">
                              {globalRequiredHours}
                            </span>
                          </td>

                          <td className={`px-4 py-4 text-right font-mono font-bold ${
                            diff < 0 ? 'text-rose-500' : diff > 0 ? 'text-emerald-500' : 'text-slate-400'
                          }`}>
                            {diff > 0 ? '+' : ''}{diff.toFixed(2)}
                          </td>

                          <td className="px-4 py-4 text-right">
                            <input
                              type="number"
                              step="0.1"
                              value={grossRates[emp.name] ?? ''}
                              onChange={(e) => handleRateChange(setGrossRates, emp.name, parseFloat(e.target.value) || 0)}
                              className="w-20 text-right px-2 py-1 bg-white border border-indigo-100 rounded font-mono text-xs focus:ring-1 focus:ring-indigo-400 outline-none text-indigo-600 font-bold"
                              placeholder="0.00"
                            />
                          </td>

                          <td className="px-4 py-4 text-right">
                            <input
                              type="number"
                              step="0.1"
                              value={overtimeRates[emp.name] ?? ''}
                              onChange={(e) => handleRateChange(setOvertimeRates, emp.name, parseFloat(e.target.value) || 0)}
                              className="w-20 text-right px-2 py-1 bg-white border border-indigo-100 rounded font-mono text-xs focus:ring-1 focus:ring-indigo-400 outline-none text-indigo-600 font-bold"
                              placeholder="0.00"
                            />
                          </td>

                          <td className={`px-4 py-4 text-right font-mono font-black ${deductionAmount > 0 ? 'text-rose-600' : 'text-slate-200'}`}>
                            {deductionAmount > 0 ? `- SR ${deductionAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                          </td>

                          <td className={`px-4 py-4 text-right font-mono font-black ${overtimePay > 0 ? 'text-emerald-600' : 'text-slate-200'}`}>
                            {overtimePay > 0 ? `+ SR ${overtimePay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                          </td>

                          <td className="px-6 py-4 text-right no-print">
                            <button
                              onClick={() => handleViewEmployee(emp.name)}
                              className="text-[10px] font-black uppercase text-indigo-600 hover:text-indigo-800 tracking-wider"
                            >
                              Log Details
                            </button>
                          </td>
                        </tr>
                      );
                    })}

                    <tr className="bg-slate-900 text-white font-black">
                      <td className="px-6 py-5 rounded-bl-3xl">TOTALS</td>
                      <td className="px-4 py-5 text-center">{totals.shifts}</td>
                      <td className="px-4 py-5 text-right font-mono">{totals.hours.toFixed(2)}</td>
                      <td colSpan={4}></td>
                      <td className="px-4 py-5 text-right font-mono text-rose-400">
                        -SR {totals.deductions.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-5 text-right font-mono text-emerald-400">
                        +SR {totals.overtime.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-5 rounded-br-3xl no-print"></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};

export default AdminReports;
