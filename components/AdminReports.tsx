
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { dataService } from '../services/dataService';
import { MonthlyReport, AttendanceRecord, User, Project, Holiday } from '../types';
import History from './History';

const AdminReports: React.FC = () => {
  const [reports, setReports] = useState<MonthlyReport[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState<string>('all');
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState<string>('all');
  const [selectedProjectFilter, setSelectedProjectFilter] = useState<string>('all');
  
  const [selectedEmployee, setSelectedEmployee] = useState<{ user: User; records: AttendanceRecord[] } | null>(null);
  const [showHolidayModal, setShowHolidayModal] = useState(false);
  const [newHoliday, setNewHoliday] = useState({ name: '', date: '' });
  
  const [holidayToDelete, setHolidayToDelete] = useState<Holiday | null>(null);
  const [isDeletingHoliday, setIsDeletingHoliday] = useState(false);
  const [isSavingHoliday, setIsSavingHoliday] = useState(false);
  
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  
  const [globalRequiredHours, setGlobalRequiredHours] = useState<number>(225); 
  const [otherDeductions, setOtherDeductions] = useState<Record<string, number>>({});
  const [reimbursements, setReimbursements] = useState<Record<string, number>>({});

  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleValueChange = (setter: React.Dispatch<React.SetStateAction<Record<string, number>>>, name: string, value: number) => {
    setter(prev => ({ ...prev, [name]: value }));
  };

  const handlePrint = () => {
    setShowExportMenu(false);
    window.print();
  };

  const handleExportExcel = (report: MonthlyReport, visibleUsers: User[]) => {
    setShowExportMenu(false);
    const filename = `Payroll_${report.month}_${report.year}.csv`;
    const headers = ["Employee", "Gross Salary", "Deduction", "Overtime", "Other Ded.", "Reimb.", "Net Salary (SR)"];
    
    const rows = visibleUsers.map(user => {
      const stats = report.employees
        .filter(e => e.name === user.name)
        .reduce((acc, s) => ({
          totalHours: acc.totalHours + Number(s.totalHours || 0),
          shiftCount: acc.shiftCount + Number(s.shiftCount || 0),
        }), { totalHours: 0, shiftCount: 0 });

      const grossSalary = Number(user.grossSalary) || 0;
      const userTarget = Number(user.standardHours);
      const targetHours = (userTarget > 0) ? userTarget : Number(globalRequiredHours);
      const grossHourlyRate = grossSalary / 208;
      const basicHourlyRate = (grossSalary / 1.35) / 208;
      const overtimeHourlyRate = grossHourlyRate + (0.5 * basicHourlyRate);
      const diff = stats.totalHours - targetHours;
      
      const deductionAmount = (diff < -0.01 && user.disableDeductions === false) ? Math.abs(diff) * grossHourlyRate : 0;
      const overtimePay = (diff > 0.01 && user.disableOvertime === false) ? diff * overtimeHourlyRate : 0;
      const otherDed = Number(otherDeductions[user.name]) || 0;
      const reimb = Number(reimbursements[user.name]) || 0;
      const netSalary = grossSalary - deductionAmount + overtimePay - otherDed + reimb;

      return [
        user.name,
        grossSalary.toFixed(2),
        deductionAmount.toFixed(2),
        overtimePay.toFixed(2),
        otherDed.toFixed(2),
        reimb.toFixed(2),
        netSalary.toFixed(2)
      ];
    });

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleGlobalHoursChange = async (val: number) => {
    setGlobalRequiredHours(val);
    try {
      await dataService.saveGlobalSettings({ standardHours: val });
    } catch (err: any) {
      console.error("Critical Permission Error:", err);
    }
  };

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    const from = fromDate ? new Date(fromDate) : undefined;
    const to = toDate ? new Date(toDate) : undefined;
    try {
      const [reportData, userData, projectData, settings, holidayData] = await Promise.all([
        dataService.getMonthlyReports(from, to),
        dataService.getUsers(),
        dataService.getProjects(),
        dataService.getGlobalSettings(),
        dataService.getHolidays()
      ]);
      setReports(reportData);
      setUsers(userData);
      setProjects(projectData);
      setGlobalRequiredHours(settings.standardHours);
      setHolidays(holidayData.sort((a,b) => a.date.localeCompare(b.date)));
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

  const handleAddHoliday = async () => {
    if (!newHoliday.name || !newHoliday.date) return alert('Name and date required');
    setIsSavingHoliday(true);
    try {
      await dataService.saveHoliday(newHoliday);
      setNewHoliday({ name: '', date: '' });
      await fetch();
    } catch (err) { 
      alert('Failed to save holiday'); 
    } finally {
      setIsSavingHoliday(false);
    }
  };

  const handleConfirmDeleteHoliday = async () => {
    if (!holidayToDelete) return;
    setIsDeletingHoliday(true);
    try {
      await dataService.deleteHoliday(holidayToDelete.id);
      setHolidayToDelete(null);
      await fetch();
    } catch (err) { 
      alert('Failed to delete holiday'); 
    } finally {
      setIsDeletingHoliday(false);
    }
  };

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
        
        <div className="flex flex-wrap items-end gap-3 no-print bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
           <button 
            onClick={() => setShowHolidayModal(true)}
            className="px-4 py-2.5 bg-rose-50 text-rose-600 border border-rose-100 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-600 hover:text-white transition-all flex items-center space-x-2"
          >
            <i className="fa-solid fa-calendar-star"></i>
            <span>Manage Holidays</span>
          </button>
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest mb-1.5 ml-1 flex items-center">
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
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">From</label>
            <input 
              type="date" 
              value={fromDate} 
              onChange={(e) => setFromDate(e.target.value)} 
              className="px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all" 
            />
          </div>
          <div className="flex flex-col">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">To</label>
            <input 
              type="date" 
              value={toDate} 
              onChange={(e) => setToDate(e.target.value)} 
              className="px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all" 
            />
          </div>
          
          <button 
            onClick={handlePrint} 
            className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg flex items-center space-x-2 active:scale-95 transition-all"
          >
            <i className="fa-solid fa-print"></i>
            <span>Print</span>
          </button>

          <div className="relative" ref={exportMenuRef}>
            <button 
              onClick={() => setShowExportMenu(!showExportMenu)} 
              className="px-5 py-2.5 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg flex items-center space-x-2 active:scale-95 transition-all"
            >
              <i className="fa-solid fa-file-export"></i>
              <span>Export</span>
              <i className={`fa-solid fa-chevron-down ml-1 transition-transform ${showExportMenu ? 'rotate-180' : ''}`}></i>
            </button>
            
            {showExportMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-2xl shadow-2xl z-[150] overflow-hidden animate-fadeIn">
                <button 
                  onClick={handlePrint}
                  className="w-full text-left px-5 py-4 hover:bg-slate-50 flex items-center space-x-3 transition-colors"
                >
                  <i className="fa-solid fa-file-pdf text-rose-500"></i>
                  <span className="text-xs font-black uppercase tracking-widest text-slate-700">1. PDF Report</span>
                </button>
                <div className="h-px bg-slate-100"></div>
                <button 
                  onClick={() => reports[0] && handleExportExcel(reports[0], users)}
                  className="w-full text-left px-5 py-4 hover:bg-slate-50 flex items-center space-x-3 transition-colors"
                >
                  <i className="fa-solid fa-file-excel text-emerald-500"></i>
                  <span className="text-xs font-black uppercase tracking-widest text-slate-700">2. Excel / CSV</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* HOLIDAY MODAL */}
      {showHolidayModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[200] flex items-center justify-center p-6">
           <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-lg w-full overflow-hidden animate-fadeIn relative">
             {holidayToDelete && (
               <div className="absolute inset-0 bg-white/95 backdrop-blur-sm z-[210] flex items-center justify-center p-8 animate-fadeIn">
                 <div className="text-center space-y-6 max-w-xs">
                    <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-2">
                      <i className="fa-solid fa-calendar-xmark text-2xl"></i>
                    </div>
                    <h3 className="text-xl font-black text-slate-900 leading-tight">Delete Official Holiday?</h3>
                    <p className="text-xs font-bold text-slate-500 leading-relaxed uppercase tracking-wide">
                      This will remove <span className="text-rose-600">"{holidayToDelete.name}"</span> from the global calendar.
                    </p>
                    <div className="flex gap-3">
                      <button onClick={() => setHolidayToDelete(null)} disabled={isDeletingHoliday} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all">Cancel</button>
                      <button onClick={handleConfirmDeleteHoliday} disabled={isDeletingHoliday} className="flex-1 py-3 bg-rose-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg hover:bg-rose-700 transition-all">
                        {isDeletingHoliday ? <i className="fa-solid fa-circle-notch fa-spin"></i> : 'Confirm Delete'}
                      </button>
                    </div>
                 </div>
               </div>
             )}

             <div className="bg-rose-500 p-8 text-white flex justify-between items-center">
               <div>
                  <h2 className="text-xl font-black">Official Holidays</h2>
                  <p className="text-[10px] font-bold text-rose-100 uppercase tracking-widest mt-1">Non-Working Date Management</p>
               </div>
               <button onClick={() => setShowHolidayModal(false)} className="text-white/60 hover:text-white transition-colors">
                  <i className="fa-solid fa-circle-xmark text-2xl"></i>
               </button>
             </div>
             
             <div className="p-8 space-y-6">
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Holiday Name</label>
                        <input type="text" value={newHoliday.name} onChange={e => setNewHoliday({...newHoliday, name: e.target.value})} placeholder="e.g. Eid Al-Fitr" className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500" />
                      </div>
                      <div>
                        <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Date</label>
                        <input type="date" value={newHoliday.date} onChange={e => setNewHoliday({...newHoliday, date: e.target.value})} className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500" />
                      </div>
                   </div>
                   <button onClick={handleAddHoliday} disabled={isSavingHoliday} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg hover:bg-indigo-700 transition-all disabled:opacity-50">
                      {isSavingHoliday ? <i className="fa-solid fa-circle-notch fa-spin mr-2"></i> : <i className="fa-solid fa-plus mr-2"></i>}
                      Add to Calendar
                   </button>
                </div>

                <div className="max-h-[300px] overflow-y-auto pr-2 no-scrollbar space-y-2">
                   {holidays.length === 0 ? (
                      <div className="text-center py-10">
                        <i className="fa-solid fa-calendar-day text-3xl text-slate-100 mb-3 block"></i>
                        <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">No holidays scheduled.</p>
                      </div>
                   ) : holidays.map(h => (
                      <div key={h.id} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl shadow-sm group hover:border-rose-100 transition-all">
                        <div className="flex items-center space-x-4">
                          <div className="w-10 h-10 bg-rose-50 text-rose-500 rounded-xl flex items-center justify-center">
                            <i className="fa-solid fa-gift"></i>
                          </div>
                          <div>
                            <p className="font-black text-slate-900 text-xs">{h.name}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{new Date(h.date).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <button onClick={() => setHolidayToDelete(h)} className="w-8 h-8 rounded-lg bg-slate-50 text-slate-300 hover:bg-rose-50 hover:text-rose-600 transition-all">
                           <i className="fa-solid fa-trash-can text-xs"></i>
                        </button>
                      </div>
                   ))}
                </div>
             </div>
           </div>
        </div>
      )}

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
          <p className="text-slate-400 font-medium tracking-tight">No attendance data found.</p>
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
            <div key={`${report.year}-${report.month}`} className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden mb-12 card relative">
              <div className="px-8 py-6 bg-slate-50 border-b border-slate-100 flex flex-wrap gap-6 items-center justify-between no-print">
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

              <div className="overflow-x-auto no-scrollbar">
                <table className="w-full text-[10px] table-fixed min-w-[850px]">
                  <thead>
                    <tr className="bg-slate-50/50">
                      <th className="px-2 py-4 text-left font-black text-slate-400 uppercase text-[9px] tracking-widest w-[14%]">Employee</th>
                      <th className="px-1 py-4 text-center font-black text-slate-400 uppercase text-[9px] tracking-widest no-print w-[6%]">Shifts</th>
                      <th className="px-1 py-4 text-right font-black text-slate-400 uppercase text-[9px] tracking-widest no-print w-[8%]">Hours</th>
                      <th className="px-1 py-4 text-right font-black text-slate-400 uppercase text-[9px] tracking-widest no-print w-[8%]">Diff</th>
                      <th className="px-1 py-4 text-center font-black text-rose-500 uppercase text-[9px] tracking-widest no-print w-[6%]">Flags</th>
                      <th className="px-2 py-4 text-right font-black text-indigo-400 uppercase text-[9px] tracking-widest w-[10%]">Gross</th>
                      <th className="px-2 py-4 text-right font-black text-rose-400 uppercase text-[9px] tracking-widest w-[10%]">Deduc.</th>
                      <th className="px-2 py-4 text-right font-black text-emerald-400 uppercase text-[9px] tracking-widest w-[10%]">OT</th>
                      <th className="px-2 py-4 text-center font-black text-rose-600 uppercase text-[9px] tracking-widest w-[9%]">Other Ded.</th>
                      <th className="px-2 py-4 text-center font-black text-emerald-600 uppercase text-[9px] tracking-widest w-[9%]">Reimb.</th>
                      <th className="px-3 py-4 text-right font-black text-slate-900 uppercase text-[9px] tracking-widest w-[10%]">Net</th>
                      <th className="px-4 py-4 text-right no-print w-[5%]"></th>
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
                          <td className="px-2 py-2 truncate text-[10px]" title={user.name}>
                            <span className="font-bold text-slate-900">{user.name}</span>
                          </td>
                          <td className="px-1 py-2 text-center font-bold text-slate-500 no-print">{stats.shiftCount}</td>
                          <td className="px-1 py-2 text-right font-mono font-bold no-print">{stats.totalHours.toFixed(1)}</td>
                          <td className={`px-1 py-2 text-right font-mono font-bold no-print ${diff < -0.01 ? 'text-rose-500' : diff > 0.01 ? 'text-emerald-500' : 'text-slate-400'}`}>
                            {diff > 0 ? '+' : ''}{diff.toFixed(1)}
                          </td>
                          <td className="px-1 py-2 text-center no-print">
                            {stats.flaggedCount > 0 ? (
                               <span className="px-1.5 py-0.5 bg-rose-500 text-white rounded text-[8px] font-black">{stats.flaggedCount}F</span>
                            ) : <i className="fa-solid fa-circle-check text-emerald-400 text-[8px]"></i>}
                          </td>
                          <td className="px-2 py-2 text-right font-mono font-bold text-slate-600">{grossSalary.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                          <td className="px-2 py-2 text-right font-mono font-bold text-rose-600">
                             {deductionAmount > 0 ? `-${deductionAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '-'}
                          </td>
                          <td className="px-2 py-2 text-right font-mono font-bold text-emerald-600">
                             {overtimePay > 0 ? `+${overtimePay.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '-'}
                          </td>
                          <td className="px-2 py-2 text-center">
                            <input type="number" value={otherDeductions[user.name] || ''} onChange={(e) => handleValueChange(setOtherDeductions, user.name, parseFloat(e.target.value) || 0)} className="w-12 px-1 py-0.5 bg-rose-50 border border-rose-100 rounded text-right font-mono text-[9px] font-bold text-rose-700 outline-none no-print-input" />
                            <span className="hidden print:inline font-mono font-bold text-rose-700 text-[9px]">{otherDed > 0 ? `-${otherDed}` : '-'}</span>
                          </td>
                          <td className="px-2 py-2 text-center">
                            <input type="number" value={reimbursements[user.name] || ''} onChange={(e) => handleValueChange(setReimbursements, user.name, parseFloat(e.target.value) || 0)} className="w-12 px-1 py-0.5 bg-emerald-50 border border-emerald-100 rounded text-right font-mono text-[9px] font-bold text-emerald-700 outline-none no-print-input" />
                            <span className="hidden print:inline font-mono font-bold text-emerald-700 text-[9px]">{reimb > 0 ? `+${reimb}` : '-'}</span>
                          </td>
                          <td className="px-3 py-2 text-right">
                             <span className="font-mono font-black text-slate-900 bg-slate-100 px-1.5 py-1 rounded">
                               {netSalary.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                             </span>
                          </td>
                          <td className="px-4 py-2 text-right no-print">
                            <button onClick={() => handleViewEmployee(user.name)} className="w-6 h-6 rounded bg-slate-100 text-slate-400 hover:text-indigo-600 transition-colors" title="Logs"><i className="fa-solid fa-magnifying-glass-chart text-[8px]"></i></button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-slate-900 text-white font-black tfoot-print">
                    <tr>
                      <td className="px-2 py-4 uppercase text-[8px] tracking-widest overflow-hidden whitespace-nowrap">Group Totals</td>
                      <td className="px-1 py-4 no-print"></td>
                      <td className="px-1 py-4 text-right font-mono no-print text-[9px]">{totalPeriodHours.toFixed(1)}h</td>
                      <td className="px-1 py-4 no-print"></td>
                      <td className="px-1 py-4 no-print"></td>
                      <td className="px-2 py-4 text-right font-mono text-indigo-300 text-[9px]">SR {totalPeriodGross.toLocaleString(undefined, {maximumFractionDigits:0})}</td>
                      <td className="px-2 py-4 text-right font-mono text-rose-300 text-[9px]">-SR {totalPeriodDeduc.toLocaleString(undefined, {maximumFractionDigits:0})}</td>
                      <td className="px-2 py-4 text-right font-mono text-emerald-300 text-[9px]">+SR {totalPeriodOT.toLocaleString(undefined, {maximumFractionDigits:0})}</td>
                      <td className="px-2 py-4 text-center font-mono text-rose-400 text-[9px]">-SR {totalPeriodOtherDed.toLocaleString(undefined, {maximumFractionDigits:0})}</td>
                      <td className="px-2 py-4 text-center font-mono text-emerald-400 text-[9px]">+SR {totalPeriodReimb.toLocaleString(undefined, {maximumFractionDigits:0})}</td>
                      <td className="px-3 py-4 text-right font-mono whitespace-nowrap text-[10px] print-black-text text-indigo-100">SR {totalPeriodNet.toLocaleString(undefined, {maximumFractionDigits:0})}</td>
                      <td className="px-4 py-4 no-print"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          );
        })
      )}
      <style>{`
        @media print {
          .no-print-input { display: none !important; }
          .print-black-text { color: #000 !important; font-weight: 900 !important; }
          .tfoot-print tr td { color: #000 !important; background-color: #f8fafc !important; border-top: 2px solid #000 !important; }
          .card { border: 1px solid #ddd !important; box-shadow: none !important; border-radius: 0 !important; }
          table { width: 100% !important; min-width: auto !important; table-layout: fixed !important; }
          .font-mono { font-family: Courier, monospace !important; }
          .text-indigo-300, .text-rose-300, .text-emerald-300, .text-indigo-100 { color: #000 !important; }
        }
      `}</style>
    </div>
  );
};

export default AdminReports;
