
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { dataService } from '../services/dataService';
import { User, AttendanceRecord, ShiftSchedule, Project } from '../types';
import History from './History';

const AdminUserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [shifts, setShifts] = useState<ShiftSchedule[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<Partial<User> | null>(null);
  const [password, setPassword] = useState('');
  const [viewingLogs, setViewingLogs] = useState<{ user: User; records: AttendanceRecord[] } | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('all');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  
  // Deletion State
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [u, s, p] = await Promise.all([
        dataService.getUsers(),
        dataService.getShiftSchedules(),
        dataService.getProjects()
      ]);
      setUsers(u);
      setShifts(s);
      setProjects(p);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSave = async () => {
    if (!editingUser?.name || !editingUser?.email || !editingUser?.employeeId) {
      return alert('Mandatory Fields: Full Name, Email, and Staff ID are required.');
    }

    if (!editingUser.id) {
      if (!password) {
        return alert('Please set an initial security key (password) for the new user account.');
      }
      if (password.length < 6) {
        return alert('Security key must be at least 6 characters long.');
      }
    }

    setSaving(true);
    try {
      const sanitizedUser = {
        ...editingUser,
        grossSalary: Number(editingUser.grossSalary || 0),
        standardHours: Number(editingUser.standardHours || 0)
      };

      if (editingUser.id) {
        await dataService.saveUser(sanitizedUser);
      } else {
        await dataService.adminCreateUser(sanitizedUser, password);
        setPassword('');
      }
      await fetchData();
      setEditingUser(null);
    } catch (err: any) {
      console.error("Staff update error:", err);
      alert(err.message || 'Failed to process staff update.');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingUser) return;
    setIsDeleting(true);
    try {
      await dataService.deleteUser(deletingUser.id);
      setUsers(prev => prev.filter(u => u.id !== deletingUser.id));
      setDeletingUser(null);
    } catch (err: any) {
      alert(err.message || "Failed to delete staff profile.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExportCSV = () => {
    setShowExportMenu(false);
    const headers = ["Name", "Staff ID", "Email", "Department", "Company", "Role", "Salary", "Std Hours"];
    const rows = filteredUsers.map(u => [
      u.name,
      u.employeeId,
      u.email,
      u.department,
      u.company || 'Absar Alomran',
      u.role,
      u.grossSalary,
      u.standardHours
    ]);
    
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Staff_Directory_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const handlePrint = () => {
    setShowExportMenu(false);
    window.print();
  };

  const handleViewLogs = async (user: User) => {
    setLoading(true);
    try {
      const logs = await dataService.getAttendanceHistory(user.id);
      setViewingLogs({ user, records: logs });
    } catch (err) {
      alert("Failed to fetch logs.");
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const s = search.toLowerCase();
      const matchesSearch = (u.name || '').toLowerCase().includes(s) || 
                            (u.email || '').toLowerCase().includes(s) || 
                            (u.employeeId || '').toLowerCase().includes(s);
      
      let matchesProject = true;
      if (projectFilter !== 'all') {
        const project = projects.find(p => p.id === projectFilter);
        matchesProject = project?.assignedUserIds.includes(u.id) || false;
      }
      
      return matchesSearch && matchesProject;
    });
  }, [users, search, projectFilter, projects]);

  if (viewingLogs) {
    return (
      <div className="space-y-6 animate-fadeIn">
        <div className="flex items-center justify-between">
          <button onClick={() => setViewingLogs(null)} className="flex items-center text-indigo-600 font-bold hover:text-indigo-800 transition-colors">
            <i className="fa-solid fa-arrow-left mr-2"></i>
            Back to Staff List
          </button>
        </div>
        <History 
          history={viewingLogs.records} 
          user={viewingLogs.user} 
          onRefresh={async () => {
             const updatedLogs = await dataService.getAttendanceHistory(viewingLogs.user.id);
             setViewingLogs({ ...viewingLogs, records: updatedLogs });
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fadeIn pb-20">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-print">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Staff Management</h1>
          <p className="text-slate-500">Manage {users.length} employee profiles and policies</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setEditingUser({ 
              name: '', 
              email: '', 
              employeeId: '', 
              department: 'Operations', 
              role: 'employee', 
              grossSalary: 0, 
              company: 'Absar Alomran', 
              disableOvertime: true, 
              disableDeductions: false, 
              standardHours: 225 
            })} 
            className="px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-lg hover:bg-indigo-700 transition-all flex items-center space-x-2"
          >
            <i className="fa-solid fa-user-plus"></i>
            <span>Add New Staff</span>
          </button>
        </div>
      </div>

      {/* FILTERS & EXPORT */}
      <div className="flex flex-wrap items-end gap-4 no-print bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
        <div className="flex-1 min-w-[240px]">
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Search Directory</label>
          <div className="relative">
            <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"></i>
            <input 
              type="text" 
              placeholder="Name, ID, or email..." 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
              className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold text-sm" 
            />
          </div>
        </div>

        <div className="w-full md:w-auto">
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Filter by Site</label>
          <select 
            value={projectFilter} 
            onChange={(e) => setProjectFilter(e.target.value)} 
            className="w-full md:w-56 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
          >
            <option value="all">All Worksites</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        <div className="relative" ref={exportMenuRef}>
          <button 
            onClick={() => setShowExportMenu(!showExportMenu)}
            className="px-5 py-3 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg flex items-center space-x-2 active:scale-95 transition-all"
          >
            <i className="fa-solid fa-file-export"></i>
            <span>Export List</span>
            <i className={`fa-solid fa-chevron-down ml-1 transition-transform ${showExportMenu ? 'rotate-180' : ''}`}></i>
          </button>
          
          {showExportMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-2xl shadow-2xl z-[150] overflow-hidden animate-fadeIn">
              <button onClick={handlePrint} className="w-full text-left px-5 py-4 hover:bg-slate-50 flex items-center space-x-3 transition-colors">
                <i className="fa-solid fa-file-pdf text-rose-500"></i>
                <span className="text-xs font-black uppercase tracking-widest text-slate-700">PDF Report</span>
              </button>
              <div className="h-px bg-slate-100"></div>
              <button onClick={handleExportCSV} className="w-full text-left px-5 py-4 hover:bg-slate-50 flex items-center space-x-3 transition-colors">
                <i className="fa-solid fa-file-excel text-emerald-500"></i>
                <span className="text-xs font-black uppercase tracking-widest text-slate-700">Excel / CSV</span>
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl overflow-hidden card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-8 py-5 text-left font-black text-slate-400 uppercase text-[10px] tracking-widest">Employee</th>
                <th className="px-6 py-5 text-left font-black text-slate-400 uppercase text-[10px] tracking-widest">Site Assignments</th>
                <th className="px-6 py-5 text-center font-black text-slate-400 uppercase text-[10px] tracking-widest">Std Hours</th>
                <th className="px-6 py-5 text-right font-black text-slate-400 uppercase text-[10px] tracking-widest">Gross Salary</th>
                <th className="px-8 py-5 text-right font-black text-slate-400 uppercase text-[10px] tracking-widest no-print">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredUsers.map(u => {
                const assignedProjects = projects.filter(p => p.assignedUserIds.includes(u.id));
                return (
                  <tr key={u.id} className="hover:bg-slate-50/30 transition-colors">
                    <td className="px-8 py-5">
                      <div className="flex items-center space-x-4">
                        <img src={u.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=random`} className="w-11 h-11 rounded-2xl border border-slate-100" />
                        <div>
                          <p className="font-bold text-slate-900 leading-tight">{u.name}</p>
                          <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mt-0.5">{u.employeeId} • {u.department}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-wrap gap-1">
                        {assignedProjects.length > 0 ? assignedProjects.map(p => (
                          <span key={p.id} className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[8px] font-black uppercase rounded border border-indigo-100">{p.name}</span>
                        )) : <span className="text-[9px] font-black text-slate-300 uppercase tracking-tighter">No Sites Assigned</span>}
                      </div>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <span className="px-3 py-1 bg-slate-100 rounded-lg text-[10px] font-black text-slate-600 uppercase">
                        {Number(u.standardHours) > 0 ? `${u.standardHours}h` : 'Default'}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <span className="font-mono font-bold text-slate-900 text-sm">SR {(Number(u.grossSalary) || 0).toLocaleString()}</span>
                    </td>
                    <td className="px-8 py-5 text-right no-print">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => handleViewLogs(u)} className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all"><i className="fa-solid fa-list-check text-[10px]"></i></button>
                        <button onClick={() => setEditingUser(u)} className="w-9 h-9 rounded-xl bg-slate-50 text-slate-400 hover:text-indigo-600 transition-all"><i className="fa-solid fa-pen-to-square text-[10px]"></i></button>
                        <button onClick={() => setDeletingUser(u)} className="w-9 h-9 rounded-xl bg-slate-50 text-slate-400 hover:text-rose-600 transition-all"><i className="fa-solid fa-trash-can text-[10px]"></i></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {editingUser && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[200] flex items-center justify-center p-4 no-print overflow-y-auto">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl my-8 overflow-hidden animate-fadeIn flex flex-col">
            <div className="bg-indigo-600 p-8 text-white">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-black">{editingUser.id ? 'Edit Profile' : 'Add New Staff'}</h2>
                  <p className="text-[10px] font-bold text-indigo-100 uppercase tracking-[0.2em] mt-1">Personnel Information & Policies</p>
                </div>
                <button onClick={() => setEditingUser(null)} className="text-white/60 hover:text-white transition-colors">
                   <i className="fa-solid fa-circle-xmark text-2xl"></i>
                </button>
              </div>
            </div>
            
            <div className="p-8 space-y-8 overflow-y-auto no-scrollbar">
              {/* SECTION 1: IDENTITY */}
              <div className="space-y-4">
                <h3 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest border-b border-indigo-50 pb-2">Identity & Access</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Full Legal Name</label>
                    <input type="text" value={editingUser.name || ''} onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Corporate Email</label>
                    <input type="email" value={editingUser.email || ''} onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
                  </div>
                  {!editingUser.id && (
                    <div>
                      <label className="block text-[10px] font-black text-rose-500 uppercase tracking-widest mb-1.5 ml-1">Security Key (Password)</label>
                      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min. 6 chars" className="w-full px-5 py-4 bg-rose-50 border border-rose-100 rounded-2xl font-bold focus:ring-2 focus:ring-rose-500 outline-none transition-all" />
                    </div>
                  )}
                </div>
              </div>

              {/* SECTION 2: EMPLOYMENT */}
              <div className="space-y-4">
                <h3 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest border-b border-indigo-50 pb-2">Employment Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Staff ID</label>
                    <input type="text" value={editingUser.employeeId || ''} onChange={(e) => setEditingUser({ ...editingUser, employeeId: e.target.value })} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Department</label>
                    <input type="text" value={editingUser.department || ''} onChange={(e) => setEditingUser({ ...editingUser, department: e.target.value })} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Company Entity</label>
                    <input type="text" value={editingUser.company || ''} onChange={(e) => setEditingUser({ ...editingUser, company: e.target.value })} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">System Role</label>
                    <select value={editingUser.role || 'employee'} onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value as any })} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none cursor-pointer">
                      <option value="employee">Employee</option>
                      <option value="admin">Administrator</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* SECTION 3: PAYROLL & POLICY */}
              <div className="space-y-4">
                <h3 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest border-b border-indigo-50 pb-2">Payroll & Attendance Policy</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Gross Salary (SR)</label>
                    <input type="number" value={editingUser.grossSalary || ''} onChange={(e) => setEditingUser({ ...editingUser, grossSalary: parseFloat(e.target.value) || 0 })} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Target Monthly Hours</label>
                    <input type="number" value={editingUser.standardHours || ''} onChange={(e) => setEditingUser({ ...editingUser, standardHours: parseFloat(e.target.value) || 0 })} placeholder="0 = Global Default" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-black text-slate-900 uppercase">Disable Overtime</p>
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">No pay for extra hours</p>
                    </div>
                    <button 
                      onClick={() => setEditingUser({ ...editingUser, disableOvertime: !editingUser.disableOvertime })}
                      className={`w-12 h-6 rounded-full relative transition-all duration-300 ${editingUser.disableOvertime ? 'bg-rose-500' : 'bg-slate-300'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 shadow-sm ${editingUser.disableOvertime ? 'left-7' : 'left-1'}`}></div>
                    </button>
                  </div>
                  <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-black text-slate-900 uppercase">Disable Deductions</p>
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">No penalty for short hours</p>
                    </div>
                    <button 
                      onClick={() => setEditingUser({ ...editingUser, disableDeductions: !editingUser.disableDeductions })}
                      className={`w-12 h-6 rounded-full relative transition-all duration-300 ${editingUser.disableDeductions ? 'bg-rose-500' : 'bg-slate-300'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 shadow-sm ${editingUser.disableDeductions ? 'left-7' : 'left-1'}`}></div>
                    </button>
                  </div>
                </div>
              </div>

              {/* SAVE BUTTONS */}
              <div className="pt-6 flex gap-4">
                <button type="button" onClick={() => setEditingUser(null)} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all">Cancel</button>
                <button type="button" onClick={handleSave} disabled={saving} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all disabled:opacity-50">
                  {saving ? <i className="fa-solid fa-circle-notch fa-spin"></i> : (editingUser.id ? 'Apply Changes' : 'Create Staff Profile')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deletingUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[300] flex items-center justify-center p-6 no-print">
          <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-sm w-full overflow-hidden animate-fadeIn text-center p-8">
              <div className="w-20 h-20 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <i className="fa-solid fa-user-slash text-3xl"></i>
              </div>
              <h2 className="text-xl font-black text-slate-900">Remove Staff?</h2>
              <p className="text-sm text-slate-500 font-medium mt-2">Delete profile for <b>{deletingUser.name}</b>?</p>
              <div className="flex gap-3 mt-8">
                <button onClick={() => setDeletingUser(null)} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest">Cancel</button>
                <button onClick={handleConfirmDelete} disabled={isDeleting} className="flex-1 py-4 bg-rose-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-rose-600">
                  {isDeleting ? <i className="fa-solid fa-circle-notch fa-spin"></i> : 'Delete'}
                </button>
              </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUserManagement;
