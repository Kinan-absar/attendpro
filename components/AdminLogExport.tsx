
import React, { useState, useEffect } from 'react';
import { dataService } from '../services/dataService';
import { User, AttendanceRecord } from '../types';

const AdminLogExport: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [fromDate, setFromDate] = useState<string>(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  );
  const [toDate, setToDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const u = await dataService.getUsers();
      setUsers(u.sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedUserIds(u.map(user => user.id)); // Default select all
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const toggleUser = (userId: string) => {
    setSelectedUserIds(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId) 
        : [...prev, userId]
    );
  };

  const selectAll = () => setSelectedUserIds(users.map(u => u.id));
  const selectNone = () => setSelectedUserIds([]);

  const handleExport = async () => {
    if (selectedUserIds.length === 0) {
      alert("Please select at least one employee.");
      return;
    }

    setExporting(true);
    try {
      const allLogs = await dataService.getAllAttendance();
      
      const start = new Date(fromDate + 'T00:00:00');
      start.setHours(0, 0, 0, 0);
      const end = new Date(toDate + 'T23:59:59');
      end.setHours(23, 59, 59, 999);

      const filteredLogs = allLogs.filter(log => {
        const logDate = log.checkIn;
        if (!logDate) return false;
        const isWithinDate = logDate >= start && logDate <= end;
        const isSelectedUser = selectedUserIds.includes(log.userId);
        return isWithinDate && isSelectedUser;
      });

      if (filteredLogs.length === 0) {
        alert("No logs found for the selected criteria.");
        return;
      }

      // Sort by date then by user name
      filteredLogs.sort((a, b) => {
        const dateA = a.checkIn?.getTime() || 0;
        const dateB = b.checkIn?.getTime() || 0;
        if (dateA !== dateB) return dateA - dateB;
        
        const userA = users.find(u => u.id === a.userId)?.name || '';
        const userB = users.find(u => u.id === b.userId)?.name || '';
        return userA.localeCompare(userB);
      });

      // Format for CSV
      const headers = ["Employee/Database ID", "Check In", "Check Out", "Worked Hours"];
      const rows = filteredLogs.map(log => {
        const user = users.find(u => u.id === log.userId);
        const clockIn = log.checkIn ? formatDate(log.checkIn) : "";
        const clockOut = log.checkOut ? formatDate(log.checkOut) : "STILL IN";
        const durationHours = log.duration ? (log.duration / 60).toFixed(2) : "0.00";
        
        return [
          `"${user?.employeeId || ''}"`,
          `"${clockIn}"`,
          `"${clockOut}"`,
          `"${durationHours}"`
        ];
      });

      const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `Consolidated_Logs_${fromDate}_to_${toDate}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

    } catch (err: any) {
      alert("Export failed: " + err.message);
    } finally {
      setExporting(false);
    }
  };

  const formatDate = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    const ss = String(date.getSeconds()).padStart(2, '0');
    return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tighter text-slate-900 mb-2">Consolidated Logs</h1>
          <p className="text-slate-500 font-medium">Export all employee logsheets into one report</p>
        </div>
        
        <button
          onClick={handleExport}
          disabled={exporting}
          className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center space-x-3 disabled:opacity-50"
        >
          <i className={`fa-solid ${exporting ? 'fa-spinner fa-spin' : 'fa-file-excel'}`}></i>
          <span>{exporting ? 'Generating Report...' : 'Export Consolidated Excel'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Date Filters */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100">
            <h3 className="text-lg font-black text-slate-900 mb-6 flex items-center space-x-2">
              <i className="fa-solid fa-calendar-range text-indigo-500"></i>
              <span>Date Range</span>
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">From Date</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">To Date</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Employee Selection */}
        <div className="lg:col-span-2">
          <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-black text-slate-900 flex items-center space-x-2">
                <i className="fa-solid fa-users text-indigo-500"></i>
                <span>Select Employees</span>
              </h3>
              <div className="flex space-x-2">
                <button 
                  onClick={selectAll}
                  className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-all"
                >
                  Select All
                </button>
                <button 
                  onClick={selectNone}
                  className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:bg-slate-50 px-3 py-1.5 rounded-lg transition-all"
                >
                  Clear
                </button>
              </div>
            </div>

            {loading ? (
              <div className="flex-1 flex items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {users.map(user => (
                  <label 
                    key={user.id}
                    className={`flex items-center p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                      selectedUserIds.includes(user.id) 
                        ? 'border-indigo-600 bg-indigo-50/50' 
                        : 'border-slate-50 bg-slate-50/50 hover:border-slate-200'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="hidden"
                      checked={selectedUserIds.includes(user.id)}
                      onChange={() => toggleUser(user.id)}
                    />
                    <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center mr-4 transition-all ${
                      selectedUserIds.includes(user.id) ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 bg-white'
                    }`}>
                      {selectedUserIds.includes(user.id) && <i className="fa-solid fa-check text-[10px] text-white"></i>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-slate-900 truncate">{user.name}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">ID: {user.employeeId || 'N/A'}</p>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminLogExport;
