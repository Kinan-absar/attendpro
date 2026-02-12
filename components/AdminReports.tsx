
import React, { useState, useEffect } from 'react';
import { dataService } from '../services/dataService';
import { MonthlyReport, AttendanceRecord, User } from '../types';
import History from './History';

const AdminReports: React.FC = () => {
  const [reports, setReports] = useState<MonthlyReport[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState<string>('all');
  const [selectedEmployee, setSelectedEmployee] = useState<{ user: User; records: AttendanceRecord[] } | null>(null);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  
  // Financial Adjustment State (Manual Columns)
  const [globalRequiredHours, setGlobalRequiredHours] = useState<number>(160); // Default to 160
  const [otherDeductions, setOtherDeductions] = useState<Record<string, number>>({});
  const [reimbursements, setReimbursements] = useState<Record<string, number>>({});

  const handleValueChange = (setter: React.Dispatch<React.SetStateAction<Record<string, number>>>, name: string, value: number) => {
    setter(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePrint = () => {
    window.print();
  };

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const from = fromDate ? new Date(fromDate) : undefined;
      const to = toDate ? new Date(toDate) : undefined;
      const [reportData, userData] = await Promise.all([
        dataService.getMonthlyReports(from, to),
        dataService.getUsers()
      ]);
      setReports(reportData);
      setUsers(userData);
      setLoading(false);
    };
    fetch();
  }, [fromDate, toDate]);

  const handleViewEmployee = async (employeeName: string) => {
    const user = users.find(u => u.name === employeeName);
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
          className="flex items-center text-indigo-600 font-bold hover:text-indigo-800 transition-colors no-print"
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
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Payroll & Reports</h1>
          <p className="text-slate-500">Manage hours, rates, and financial adjustments</p>
        </div>
        
        <div className="flex flex-wrap items-end gap-4 no-print bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-indigo-600 uppercase mb-1 ml-1 flex items-center">
              <i className="fa-solid fa-clock-rotate-left mr-1"></i> Std. Hours
            </span>
            <input
              type="number"
              value={globalRequiredHours}
              onChange={(e) => setGlobalRequiredHours(parseFloat(e.target.value) || 0)}
              className="px-4 py-2 w-24 bg-indigo-50 border border-indigo-100 rounded-xl text-sm font-bold text-indigo-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">From</span>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">To</span>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
          </div>
          <button onClick={handlePrint} className="px-6 py-2.5 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg flex items-center space-x-2 active:scale-95 transition-all">
            <i className="fa-solid fa-print"></i>
            <span>Print Report</span>
          </button>
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
            const user = users.find(u => u.name === e.name);
            const grossSalary = user?.grossSalary || 0;
            const basicSalary = grossSalary / 1.35;
            const basicHourlyRate = basicSalary / 208;
            const grossHourlyRate = grossSalary / 208;
            const overtimeHourlyRate = grossHourlyRate + (0.5 * basicHourlyRate);

            const diff = e.totalHours - globalRequiredHours;
            const deduction = diff < 0 ? Math.abs(diff) * grossHourlyRate : 0;
            const otPay = diff > 0 ? diff * overtimeHourlyRate : 0;
            
            const otherDed = otherDeductions[e.name] || 0;
            const reimb = reimbursements[e.name] || 0;
            const netSalary = grossSalary - deduction + otPay - otherDed + reimb;

            return {
              shifts: acc.shifts + e.shiftCount,
              hours: acc.hours + e.totalHours,
              diff: acc.diff + diff,
              deductions: acc.deductions + deduction,
              overtime: acc.overtime + otPay,
              otherDeductions: acc.otherDeductions + otherDed,
              reimbursements: acc.reimbursements + reimb,
              netSalary: acc.netSalary + netSalary
            };
          }, { shifts: 0, hours: 0, diff: 0, deductions: 0, overtime: 0, otherDeductions: 0, reimbursements: 0, netSalary: 0 });

          return (
            <div key={`${report.year}-${report.month}`} className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden mb-12 card">
              <div className="px-8 py-6 bg-slate-50 border-b border-slate-100 flex flex-wrap gap-6 items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
                    <i className="fa-solid fa-calendar-check text-xl"></i>
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 leading-none mb-1">{report.month} {report.year}</h3>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Standard: {globalRequiredHours} Hrs</p>
                  </div>
                </div>
                <div className="no-print">
                  <select value={selectedEmployeeFilter} onChange={(e) => setSelectedEmployeeFilter(e.target.value)} className="pl-4 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none appearance-none cursor-pointer">
                    <option value="all">All Employees</option>
                    {report.employees.map(emp => <option key={emp.name} value={emp.name}>{emp.name}</option>)}
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
                      <th className="px-4 py-4 text-right font-black text-slate-400 uppercase text-[10px] tracking-widest">Diff</th>
                      <th className="px-4 py-4 text-right font-black text-indigo-400 uppercase text-[10px] tracking-widest">Gross Salary</th>
                      <th className="px-4 py-4 text-right font-black text-indigo-400 uppercase text-[10px] tracking-widest">Gross Rate</th>
                      <th className="px-4 py-4 text-right font-black text-indigo-400 uppercase text-[10px] tracking-widest">OT Rate</th>
                      <th className="px-4 py-4 text-right font-black text-rose-400 uppercase text-[10px] tracking-widest">Deduction</th>
                      <th className="px-4 py-4 text-right font-black text-emerald-400 uppercase text-[10px] tracking-widest">OT Pay</th>
                      <th className="px-4 py-4 text-right font-black text-rose-400 uppercase text-[10px] tracking-widest no-print">Other Ded.</th>
                      <th className="px-4 py-4 text-right font-black text-emerald-400 uppercase text-[10px] tracking-widest no-print">Reimb.</th>
                      <th className="px-6 py-4 text-right font-black text-slate-900 uppercase text-[10px] tracking-widest">Net Salary</th>
                      <th className="px-6 py-4 text-right font-black text-slate-400 uppercase text-[10px] tracking-widest no-print">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredEmployees.map((emp) => {
                      const user = users.find(u => u.name === emp.name);
                      const grossSalary = user?.grossSalary || 0;
                      const basicSalary = grossSalary / 1.35;
                      const basicHourlyRate = basicSalary / 208;
                      const grossHourlyRate = grossSalary / 208;
                      const overtimeHourlyRate = grossHourlyRate + (0.5 * basicHourlyRate);

                      const diff = emp.totalHours - globalRequiredHours;
                      const deductionAmount = diff < 0 ? Math.abs(diff) * grossHourlyRate : 0;
                      const overtimePay = diff > 0 ? diff * overtimeHourlyRate : 0;
                      
                      const otherDed = otherDeductions[emp.name] || 0;
                      const reimb = reimbursements[emp.name] || 0;
                      const netSalary = grossSalary - deductionAmount + overtimePay - otherDed + reimb;

                      return (
                        <tr key={emp.name} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4"><span className="font-bold text-slate-900">{emp.name}</span></td>
                          <td className="px-4 py-4 text-center"><span className="px-2 py-1 bg-slate-100 rounded text-xs font-black text-slate-500">{emp.shiftCount}</span></td>
                          <td className="px-4 py-4 text-right font-mono font-bold text-slate-700">{emp.totalHours.toFixed(2)}</td>
                          <td className={`px-4 py-4 text-right font-mono font-bold ${diff < 0 ? 'text-rose-500' : diff > 0 ? 'text-emerald-500' : 'text-slate-400'}`}>
                            {diff > 0 ? '+' : ''}{diff.toFixed(2)}
                          </td>
                          <td className="px-4 py-4 text-right font-mono font-bold text-indigo-600">
                            {grossSalary.toLocaleString()}
                          </td>
                          <td className="px-4 py-4 text-right font-mono text-[10px] text-slate-400">
                            {grossHourlyRate.toFixed(2)}
                          </td>
                          <td className="px-4 py-4 text-right font-mono text-[10px] text-slate-400">
                            {overtimeHourlyRate.toFixed(2)}
                          </td>
                          <td className={`px-4 py-4 text-right font-mono font-black ${deductionAmount > 0 ? 'text-rose-600' : 'text-slate-200'}`}>
                            {deductionAmount > 0 ? `-SR ${deductionAmount.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}` : '-'}
                          </td>
                          <td className={`px-4 py-4 text-right font-mono font-black ${overtimePay > 0 ? 'text-emerald-600' : 'text-slate-200'}`}>
                            {overtimePay > 0 ? `+SR ${overtimePay.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}` : '-'}
                          </td>
                          <td className="px-4 py-4 text-right no-print">
                            <input type="number" step="1" value={otherDeductions[emp.name] ?? ''} onChange={(e) => handleValueChange(setOtherDeductions, emp.name, parseFloat(e.target.value) || 0)} className="w-16 text-right px-1 py-1 bg-white border border-rose-100 rounded font-mono text-[10px] outline-none text-rose-600 font-bold" placeholder="0" />
                          </td>
                          <td className="px-4 py-4 text-right no-print">
                            <input type="number" step="1" value={reimbursements[emp.name] ?? ''} onChange={(e) => handleValueChange(setReimbursements, emp.name, parseFloat(e.target.value) || 0)} className="w-16 text-right px-1 py-1 bg-white border border-emerald-100 rounded font-mono text-[10px] outline-none text-emerald-600 font-bold" placeholder="0" />
                          </td>
                          <td className="px-6 py-4 text-right">
                             <span className="font-mono font-black text-slate-900 bg-slate-100 px-3 py-1.5 rounded-xl">
                               SR {netSalary.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                             </span>
                          </td>
                          <td className="px-6 py-4 text-right no-print">
                            <button onClick={() => handleViewEmployee(emp.name)} className="text-[10px] font-black uppercase text-indigo-600 hover:text-indigo-800 tracking-wider">Logs</button>
                          </td>
                        </tr>
                      );
                    })}
                    {/* TOTALS FOOTER ROW - Fixed Alignment */}
                    <tr className="bg-slate-900 text-white font-black">
                      <td className="px-6 py-5">TOTALS</td>
                      <td className="px-4 py-5 text-center">{totals.shifts}</td>
                      <td className="px-4 py-5 text-right font-mono">{totals.hours.toFixed(2)}</td>
                      <td className={`px-4 py-5 text-right font-mono ${totals.diff < 0 ? 'text-rose-400' : totals.diff > 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
                        {totals.diff > 0 ? '+' : ''}{totals.diff.toFixed(2)}
                      </td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td className="px-4 py-5 text-right font-mono text-rose-400">
                        -SR {totals.deductions.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                      </td>
                      <td className="px-4 py-5 text-right font-mono text-emerald-400">
                        +SR {totals.overtime.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                      </td>
                      <td className="no-print"></td>
                      <td className="no-print"></td>
                      <td className="px-6 py-5 text-right font-mono text-white">
                        SR {totals.netSalary.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                      </td>
                      <td className="no-print"></td>
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
