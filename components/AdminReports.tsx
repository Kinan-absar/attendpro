
import React, { useState, useEffect, useCallback } from 'react';
import { dataService } from '../services/dataService';
import { MonthlyReport, AttendanceRecord, User, Project } from '../types';
import History from './History';

const AdminReports: React.FC = () => {
  const [reports, setReports] = useState<MonthlyReport[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState<string>('all');
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState<string>('all');
  const [selectedProjectFilter, setSelectedProjectFilter] = useState<string>('all');
  
  const [selectedEmployee, setSelectedEmployee] = useState<{ user: User; records: AttendanceRecord[] } | null>(null);
  
  // Date range state - harmonized with History.tsx
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  
  const [globalRequiredHours, setGlobalRequiredHours] = useState<number>(225); 
  const [otherDeductions, setOtherDeductions] = useState<Record<string, number>>({});
  const [reimbursements, setReimbursements] = useState<Record<string, number>>({});

  const handleValueChange = (setter: React.Dispatch<React.SetStateAction<Record<string, number>>>, name: string, value: number) => {
    setter(prev => ({ ...prev, [name]: value }));
  };

  const handlePrint = () => window.print();

  const handleGlobalHoursChange = async (val: number) => {
    setGlobalRequiredHours(val);
    try {
      await dataService.saveGlobalSettings({ standardHours: val });
    } catch (err: any) {
      console.error("Critical Permission Error:", err);
      if (err.message?.includes("PERMISSION_DENIED") || err.code === 'permission-denied') {
        alert("PERMISSION ERROR: Your account lacks write access to '/settings'. Update your Firestore Security Rules.");
      }
    }
  };

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    const from = fromDate ? new Date(fromDate) : undefined;
    const to = toDate ? new Date(toDate) : undefined;
    try {
      const [reportData, userData, projectData, settings] = await Promise.all([
        dataService.getMonthlyReports(from, to),
        dataService.getUsers(),
        dataService.getProjects(),
        dataService.getGlobalSettings()
      ]);
      setReports(reportData);
      setUsers(userData);
      setProjects(projectData);
      setGlobalRequiredHours(settings.standardHours);
    } catch (err: any) {
      console.error("Report load failed:", err);
      if (err.message?.includes("PERMISSION_DENIED") || err.code === 'permission-denied') {
        setError("Missing or insufficient permissions. Check your role or Firestore rules.");
      } else {
        setError("Failed to generate reports.");
      }
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => {
    fetch();
  }, [fetch]);

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
        <p className="text-slate-500 font-medium tracking-tight">Syncing Payroll Data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-20 text-center space-y-4 max-w-xl mx-auto">
        <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4">
           <i className="fa-solid fa-shield-halved text-2xl"></i>
        </div>
        <h2 className="text-xl font-black text-slate-900 uppercase">Access Denied</h2>
        <p className="text-slate-500 text-sm font-medium leading-relaxed">{error}</p>
        <button onClick={fetch} className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg">Retry Sync</button>
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
        <History history={selectedEmployee.records} user={selectedEmployee.user} onRefresh={async () => {
          const logs = await dataService.getAttendanceHistory(selectedEmployee.user.id);
          setSelectedEmployee({ ...selectedEmployee, records: logs });
        }} />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12 animate-fadeIn">
      {/* HEADER SECTION */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Payroll Oversight</h1>
          <p className="text-slate-500">Review billable hours and shift flags</p>
        </div>
        
        {/* IMPROVED DATE CONTROLS - MATCHING HISTORY.TSX */}
        <div className="flex flex-wrap items-end gap-3 no-print bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest mb-1 ml-1 flex items-center">
              <i className="fa-solid fa-clock-rotate-left mr-1"></i> Std. Hours
            </span>
            <input
              type="number"
              value={globalRequiredHours}
              onChange={(e) => handleGlobalHoursChange(parseFloat(e.target.value) || 0)}
              className="px-3 py-2 w-20 bg-indigo-50 border border-indigo-100 rounded-xl text-xs font-bold text-indigo-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">From Date</label>
            <input 
              type="date" 
              value={fromDate} 
              onChange={(e) => setFromDate(e.target.value)} 
              className="px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all" 
            />
          </div>
          <div className="flex flex-col">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">To Date</label>
            <input 
              type="date" 
              value={toDate} 
              onChange={(e) => setToDate(e.target.value)} 
              className="px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all" 
            />
          </div>
          <div className="flex gap-2">
            {(fromDate || toDate) && (
              <button 
                onClick={() => { setFromDate(''); setToDate(''); }}
                className="px-4 py-2 bg-slate-100 text-slate-500 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all"
                title="Clear Filters"
              >
                Clear
              </button>
            )}
            <button 
              onClick={handlePrint} 
              className="px-5 py-2.5 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg flex items-center space-x-2 active:scale-95 transition-all"
            >
              <i className="fa-solid fa-print"></i>
              <span>Print Report</span>
            </button>
          </div>
        </div>
      </div>

      {/* FILTER CONTROLS */}
      <div className="flex flex-wrap gap-4 no-print p-6 bg-slate-50 rounded-[1.5rem] border border-slate-200">
         <div className="flex flex-col min-w-[150px]">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Company</label>
            <select value={selectedCompanyFilter} onChange={(e) => setSelectedCompanyFilter(e.target.value)} className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer">
              <option value="all">All Companies</option>
              {[...new Set(users.map(u => u.company || 'Absar Alomran'))].sort().map(company => (
                <option key={company} value={company}>{company}</option>
              ))}
            </select>
         </div>
         <div className="flex flex-col min-w-[150px]">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Project / Site</label>
            <select value={selectedProjectFilter} onChange={(e) => setSelectedProjectFilter(e.target.value)} className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer">
              <option value="all">All Projects</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
              <option value="none">Unassigned Site</option>
            </select>
         </div>
         <div className="flex flex-col min-w-[150px]">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Staff Member</label>
            <select value={selectedEmployeeFilter} onChange={(e) => setSelectedEmployeeFilter(e.target.value)} className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer">
              <option value="all">All Employees</option>
              {[...new Set(users.map(u => u.name))].sort().map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
         </div>
      </div>

      {reports.length === 0 ? (
        <div className="bg-white p-20 rounded-3xl border border-dashed border-slate-300 text-center">
          <i className="fa-solid fa-file-invoice-dollar text-4xl text-slate-200 mb-4"></i>
          <p className="text-slate-400 font-medium tracking-tight">No attendance data found for the selected period.</p>
        </div>
      ) : (
        reports.map((report) => {
          const visibleUsers = users.filter(u => {
            const matchesEmployee = selectedEmployeeFilter === 'all' || u.name === selectedEmployeeFilter;
            const matchesCompany = selectedCompanyFilter === 'all' || (u.company || 'Absar Alomran') === selectedCompanyFilter;
            let matchesProject = false;
            const userAssignedProjectIds = projects.filter(p => p.assignedUserIds.includes(u.id)).map(p => p.id);
            if (selectedProjectFilter === 'all') matchesProject = true;
            else if (selectedProjectFilter === 'none') matchesProject = userAssignedProjectIds.length === 0;
            else matchesProject = userAssignedProjectIds.includes(selectedProjectFilter) || report.employees.some(emp => emp.name === u.name && emp.projectId === selectedProjectFilter);
            return matchesEmployee && matchesCompany && matchesProject;
          }).sort((a, b) => a.name.localeCompare(b.name));

          if (visibleUsers.length === 0) return null;

          let totalPeriodHours = 0;
          let totalPeriodGross = 0;
          let totalPeriodDeduc = 0;
          let totalPeriodOT = 0;
          let totalPeriodOtherDed = 0;
          let totalPeriodReimb = 0;
          let totalPeriodNet = 0;

          return (
            <div key={`${report.year}-${report.month}`} className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden mb-12 card">
              <div className="px-8 py-6 bg-slate-50 border-b border-slate-100 flex flex-wrap gap-6 items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
                    <i className="fa-solid fa-calendar-check text-xl"></i>
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 leading-none mb-1">{report.month} {report.year}</h3>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                      {selectedCompanyFilter !== 'all' ? selectedCompanyFilter : 'Payroll Analysis'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50/50">
                      <th className="px-6 py-4 text-left font-black text-slate-400 uppercase text-[10px] tracking-widest">Employee</th>
                      <th className="px-4 py-4 text-center font-black text-slate-400 uppercase text-[10px] tracking-widest">Shifts</th>
                      <th className="px-4 py-4 text-right font-black text-slate-400 uppercase text-[10px] tracking-widest">Hours</th>
                      <th className="px-4 py-4 text-right font-black text-slate-400 uppercase text-[10px] tracking-widest">Diff</th>
                      <th className="px-4 py-4 text-center font-black text-rose-500 uppercase text-[10px] tracking-widest">Flags</th>
                      <th className="px-4 py-4 text-right font-black text-indigo-400 uppercase text-[10px] tracking-widest">Gross</th>
                      <th className="px-4 py-4 text-right font-black text-rose-400 uppercase text-[10px] tracking-widest">Deduc.</th>
                      <th className="px-4 py-4 text-right font-black text-emerald-400 uppercase text-[10px] tracking-widest">OT</th>
                      <th className="px-4 py-4 text-center font-black text-rose-600 uppercase text-[10px] tracking-widest no-print">Other Ded.</th>
                      <th className="px-4 py-4 text-center font-black text-emerald-600 uppercase text-[10px] tracking-widest no-print">Reimb.</th>
                      <th className="px-6 py-4 text-right font-black text-slate-900 uppercase text-[10px] tracking-widest">Net (SR)</th>
                      <th className="px-6 py-4 text-right no-print"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {visibleUsers.map((user) => {
                      const stats = report.employees
                        .filter(e => e.name === user.name)
                        .reduce((acc, s) => ({
                          totalHours: acc.totalHours + Number(s.totalHours || 0),
                          shiftCount: acc.shiftCount + Number(s.shiftCount || 0),
                          flaggedCount: acc.flaggedCount + (Number(s.flaggedCount) || 0)
                        }), { totalHours: 0, shiftCount: 0, flaggedCount: 0 });

                      const grossSalary = Number(user.grossSalary) || 0;
                      const basicSalary = grossSalary / 1.35;
                      const userTarget = Number(user.standardHours);
                      const targetHours = (userTarget > 0) ? userTarget : Number(globalRequiredHours);

                      const grossHourlyRate = grossSalary / 208;
                      const basicHourlyRate = basicSalary / 208;
                      const overtimeHourlyRate = grossHourlyRate + (0.5 * basicHourlyRate);

                      const diff = stats.totalHours - targetHours;
                      const otEnabled = user.disableOvertime === false;
                      const dedEnabled = user.disableDeductions === false;

                      const deductionAmount = (diff < -0.01 && dedEnabled) ? Math.abs(diff) * grossHourlyRate : 0;
                      const overtimePay = (diff > 0.01 && otEnabled) ? diff * overtimeHourlyRate : 0;
                      
                      const otherDed = Number(otherDeductions[user.name]) || 0;
                      const reimb = Number(reimbursements[user.name]) || 0;
                      const netSalary = grossSalary - deductionAmount + overtimePay - otherDed + reimb;

                      totalPeriodHours += stats.totalHours;
                      totalPeriodGross += grossSalary;
                      totalPeriodDeduc += deductionAmount;
                      totalPeriodOT += overtimePay;
                      totalPeriodOtherDed += otherDed;
                      totalPeriodReimb += reimb;
                      totalPeriodNet += netSalary;

                      return (
                        <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4">
                            <span className="font-bold text-slate-900">{user.name}</span>
                          </td>
                          <td className="px-4 py-4 text-center font-bold text-slate-500">{stats.shiftCount}</td>
                          <td className="px-4 py-4 text-right font-mono font-bold">{stats.totalHours.toFixed(2)}</td>
                          <td className={`px-4 py-4 text-right font-mono font-bold ${diff < -0.01 ? 'text-rose-500' : diff > 0.01 ? 'text-emerald-500' : 'text-slate-400'}`}>
                            {diff > 0 ? '+' : ''}{diff.toFixed(1)}
                          </td>
                          <td className="px-4 py-4 text-center">
                            {stats.flaggedCount > 0 ? (
                               <span className="px-2 py-0.5 bg-rose-500 text-white rounded text-[9px] font-black">{stats.flaggedCount} FLAG</span>
                            ) : <i className="fa-solid fa-circle-check text-emerald-400"></i>}
                          </td>
                          <td className="px-4 py-4 text-right font-mono font-bold text-slate-600">{grossSalary.toLocaleString()}</td>
                          <td className="px-4 py-4 text-right font-mono font-bold text-rose-600">
                             {deductionAmount > 0 ? `-${deductionAmount.toLocaleString(undefined, { maximumFractionDigits: 1 })}` : '-'}
                          </td>
                          <td className="px-4 py-4 text-right font-mono font-bold text-emerald-600">
                             {overtimePay > 0 ? `+${overtimePay.toLocaleString(undefined, { maximumFractionDigits: 1 })}` : '-'}
                          </td>
                          <td className="px-4 py-4 text-center no-print">
                            <input type="number" value={otherDeductions[user.name] || ''} onChange={(e) => handleValueChange(setOtherDeductions, user.name, parseFloat(e.target.value) || 0)} className="w-20 px-2 py-1 bg-rose-50 border border-rose-100 rounded text-right font-mono text-xs font-bold text-rose-700 outline-none" />
                          </td>
                          <td className="px-4 py-4 text-center no-print">
                            <input type="number" value={reimbursements[user.name] || ''} onChange={(e) => handleValueChange(setReimbursements, user.name, parseFloat(e.target.value) || 0)} className="w-20 px-2 py-1 bg-emerald-50 border border-emerald-100 rounded text-right font-mono text-xs font-bold text-emerald-700 outline-none" />
                          </td>
                          <td className="px-6 py-4 text-right">
                             <span className="font-mono font-black text-slate-900 bg-slate-100 px-3 py-1.5 rounded-xl">
                               SR {netSalary.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                             </span>
                          </td>
                          <td className="px-6 py-4 text-right no-print">
                            <button onClick={() => handleViewEmployee(user.name)} className="w-8 h-8 rounded-lg bg-slate-100 text-slate-400 hover:text-indigo-600"><i className="fa-solid fa-magnifying-glass-chart text-xs"></i></button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-slate-900 text-white font-black">
                    <tr>
                      <td colSpan={2} className="px-6 py-5 uppercase text-[10px] tracking-widest">Group Totals</td>
                      <td className="px-4 py-5 text-right font-mono">{totalPeriodHours.toFixed(1)}h</td>
                      <td className="px-4 py-5 text-right font-mono">--</td>
                      <td className="px-4 py-5 text-center font-mono">--</td>
                      <td className="px-4 py-5 text-right font-mono text-indigo-300">SR {totalPeriodGross.toLocaleString()}</td>
                      <td className="px-4 py-5 text-right font-mono text-rose-300">-SR {totalPeriodDeduc.toLocaleString(undefined, {maximumFractionDigits:0})}</td>
                      <td className="px-4 py-5 text-right font-mono text-emerald-300">+SR {totalPeriodOT.toLocaleString(undefined, {maximumFractionDigits:0})}</td>
                      <td className="px-4 py-5 text-center font-mono text-rose-400 no-print">-SR {totalPeriodOtherDed.toLocaleString(undefined, {maximumFractionDigits:0})}</td>
                      <td className="px-4 py-5 text-center font-mono text-emerald-400 no-print">+SR {totalPeriodReimb.toLocaleString(undefined, {maximumFractionDigits:0})}</td>
                      <td className="px-6 py-5 text-right font-mono text-indigo-100">SR {totalPeriodNet.toLocaleString(undefined, {maximumFractionDigits:0})}</td>
                      <td className="px-6 py-5 no-print"></td>
                    </tr>
                  </tfoot>
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
