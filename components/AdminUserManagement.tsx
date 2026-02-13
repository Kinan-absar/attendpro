
import React, { useState, useEffect } from 'react';
import { dataService } from '../services/dataService';
import { User, AttendanceRecord, ShiftSchedule } from '../types';
import History from './History';

const AdminUserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [shifts, setShifts] = useState<ShiftSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<Partial<User> | null>(null);
  const [viewingLogs, setViewingLogs] = useState<{ user: User; records: AttendanceRecord[] } | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [fixing, setFixing] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [u, s] = await Promise.all([
        dataService.getUsers(),
        dataService.getShiftSchedules()
      ]);
      setUsers(u);
      setShifts(s);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSave = async () => {
    if (!editingUser?.name || !editingUser?.email || !editingUser?.employeeId) {
      return alert('Mandatory Fields: Full Name, Email, and Staff ID are required.');
    }
    setSaving(true);
    try {
      await dataService.saveUser(editingUser);
      await fetchData();
      setEditingUser(null);
    } catch (err: any) {
      alert(err.message || 'Failed to save user.');
    } finally {
      setSaving(false);
    }
  };

  const handleBulkFix = async () => {
    if (!confirm('This will fix data types for all users and apply default policies (OT disabled) to any missing records. Continue?')) return;
    setFixing(true);
    try {
      await dataService.bulkUpdateDefaultRules();
      await fetchData();
      alert('All staff profiles have been corrected and aligned with standard policies.');
    } catch (err) {
      alert('Fix failed.');
    } finally {
      setFixing(false);
    }
  };

  const handleViewLogs = async (user: User) => {
    setLoading(true);
    try {
      const logs = await dataService.getAttendanceHistory(user.id);
      setViewingLogs({ user, records: logs });
    } catch (err) {
      alert("Failed to fetch logs for this user.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Permanently remove staff profile?')) return;
    try {
      await dataService.deleteUser(id);
      setUsers(users.filter(u => u.id !== id));
    } catch (err) {
      alert('Delete failed');
    }
  };

  const getUserShift = (userId: string) => {
    return shifts.find(s => s.assignedUserIds.includes(userId));
  };

  const filteredUsers = users.filter(u => {
    const s = search.toLowerCase();
    const name = (u.name || '').toLowerCase();
    const email = (u.email || '').toLowerCase();
    const empId = (u.employeeId || '').toLowerCase();
    return name.includes(s) || email.includes(s) || empId.includes(s);
  });

  if (viewingLogs) {
    return (
      <div className="space-y-6 animate-fadeIn">
        <div className="flex items-center justify-between">
          <button onClick={() => setViewingLogs(null)} className="flex items-center text-indigo-600 font-bold hover:text-indigo-800 transition-colors">
            <i className="fa-solid fa-arrow-left mr-2"></i>
            Back to Staff List
          </button>
          <div className="text-right">
            <h2 className="text-lg font-black text-slate-900">{viewingLogs.user.name}</h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Employee Logs</p>
          </div>
        </div>
        <History 
          history={viewingLogs.records} 
          user={dataService.getCurrentUser()!} 
          onRefresh={async () => {
             const updatedLogs = await dataService.getAttendanceHistory(viewingLogs.user.id);
             setViewingLogs({ ...viewingLogs, records: updatedLogs });
          }}
        />
      </div>
    );
  }

  if (loading && users.length === 0) return (
    <div className="p-20 text-center">
      <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
      <p className="text-slate-400 font-black text-xs uppercase tracking-widest">Loading Staff Directory...</p>
    </div>
  );

  return (
    <div className="space-y-8 animate-fadeIn pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Staff Management</h1>
          <p className="text-slate-500">Manage employee profiles, salaries, and work rules</p>
        </div>
        <div className="flex gap-2">
           <button onClick={handleBulkFix} disabled={fixing} className="px-5 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-sm hover:bg-slate-50 transition-all flex items-center space-x-2">
            {fixing ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-wand-magic-sparkles"></i>}
            <span>Verify All Data</span>
          </button>
          <button onClick={() => setEditingUser({ name: '', email: '', employeeId: '', department: '', role: 'employee', grossSalary: 0, company: 'Absar Alomran', disableOvertime: true, disableDeductions: false, standardHours: 0 })} className="px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-lg hover:bg-indigo-700 transition-all flex items-center space-x-2">
            <i className="fa-solid fa-user-plus"></i>
            <span>Add New Staff</span>
          </button>
        </div>
      </div>

      <div className="relative group max-w-md">
        <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
        <input type="text" placeholder="Search by name, ID, or email..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm" />
      </div>

      {editingUser && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden animate-fadeIn">
            <div className="bg-indigo-600 p-8 text-white">
              <div className="flex justify-between items-center mb-2">
                <h2 className="text-2xl font-black">{editingUser.id ? 'Edit Profile' : 'Add New Staff'}</h2>
                <button onClick={() => setEditingUser(null)} className="text-white/60 hover:text-white transition-colors">
                   <i className="fa-solid fa-circle-xmark text-2xl"></i>
                </button>
              </div>
            </div>
            
            <div className="p-8 space-y-6 max-h-[75vh] overflow-y-auto no-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                {/* Clean Symmetrical Grid */}
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Full Name</label>
                  <input type="text" value={editingUser.name || ''} onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm" />
                </div>
                
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Corporate Email</label>
                  <input type="email" value={editingUser.email || ''} onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm" />
                </div>
                
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Staff ID</label>
                  <input type="text" value={editingUser.employeeId || ''} onChange={(e) => setEditingUser({ ...editingUser, employeeId: e.target.value })} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Department</label>
                  <input type="text" value={editingUser.department || ''} onChange={(e) => setEditingUser({ ...editingUser, department: e.target.value })} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm" />
                </div>
                
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Company</label>
                  <input type="text" value={editingUser.company || ''} onChange={(e) => setEditingUser({ ...editingUser, company: e.target.value })} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Role</label>
                  <select value={editingUser.role || 'employee'} onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value as any })} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm cursor-pointer appearance-none">
                    <option value="employee">Employee</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Gross Salary (SR)</label>
                  <input type="number" value={editingUser.grossSalary || ''} onChange={(e) => setEditingUser({ ...editingUser, grossSalary: parseFloat(e.target.value) || 0 })} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Standard Hours</label>
                  <input type="number" value={editingUser.standardHours || ''} onChange={(e) => setEditingUser({ ...editingUser, standardHours: parseFloat(e.target.value) || 0 })} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm" placeholder="e.g. 236" />
                </div>

                <div className="md:col-span-2 flex items-center justify-between p-5 bg-slate-50 rounded-[1.5rem] border border-slate-200 shadow-inner mt-2">
                  <div>
                    <p className="text-xs font-black text-slate-900 uppercase tracking-tight">Disable Overtime</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.1em] mt-0.5">Pay extra if hours {'>'} standard</p>
                  </div>
                  <button onClick={() => setEditingUser({ ...editingUser, disableOvertime: !editingUser.disableOvertime })} className={`w-14 h-7 rounded-full relative transition-all duration-300 ${editingUser.disableOvertime ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                    <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all duration-300 shadow-sm ${editingUser.disableOvertime ? 'left-8' : 'left-1'}`}></div>
                  </button>
                </div>
                
                <div className="md:col-span-2 flex items-center justify-between p-5 bg-slate-50 rounded-[1.5rem] border border-slate-200 shadow-inner">
                  <div>
                    <p className="text-xs font-black text-slate-900 uppercase tracking-tight">Disable Deductions</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.1em] mt-0.5">Deduct if hours {'<'} standard</p>
                  </div>
                  <button onClick={() => setEditingUser({ ...editingUser, disableDeductions: !editingUser.disableDeductions })} className={`w-14 h-7 rounded-full relative transition-all duration-300 ${editingUser.disableDeductions ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                    <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all duration-300 shadow-sm ${editingUser.disableDeductions ? 'left-8' : 'left-1'}`}></div>
                  </button>
                </div>
              </div>

              <div className="pt-6 flex gap-4">
                <button type="button" onClick={() => setEditingUser(null)} className="flex-1 py-5 bg-slate-100 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all">Cancel</button>
                <button type="button" onClick={handleSave} disabled={saving} className="flex-1 py-5 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all disabled:opacity-50">
                  {saving ? <i className="fa-solid fa-circle-notch fa-spin"></i> : 'Save Staff Profile'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50/50 border-b border-slate-100">
              <tr>
                <th className="px-8 py-5 text-left font-black text-slate-400 uppercase text-[10px] tracking-widest">Employee</th>
                <th className="px-6 py-5 text-left font-black text-slate-400 uppercase text-[10px] tracking-widest">Shift</th>
                <th className="px-6 py-5 text-center font-black text-slate-400 uppercase text-[10px] tracking-widest">Std Hours</th>
                <th className="px-6 py-5 text-right font-black text-slate-400 uppercase text-[10px] tracking-widest">Salary</th>
                <th className="px-8 py-5 text-right font-black text-slate-400 uppercase text-[10px] tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredUsers.map(u => {
                const userShift = getUserShift(u.id);
                return (
                  <tr key={u.id} className="hover:bg-slate-50/30 transition-colors">
                    <td className="px-8 py-5">
                      <div className="flex items-center space-x-4">
                        <img src={u.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=random`} className="w-11 h-11 rounded-2xl border border-slate-100 shadow-sm" />
                        <div>
                          <p className="font-bold text-slate-900 leading-tight">{u.name}</p>
                          <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mt-0.5">{u.employeeId} • {u.company || 'Absar'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      {userShift ? (
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider">{userShift.name}</span>
                          <span className="text-[9px] font-bold text-slate-400 uppercase">{userShift.startTime} - {userShift.endTime}</span>
                        </div>
                      ) : (
                        <span className="text-[9px] font-black text-slate-300 uppercase tracking-tighter">No Shift</span>
                      )}
                    </td>
                    <td className="px-6 py-5 text-center">
                      <span className="px-3 py-1 bg-slate-100 rounded-lg text-[10px] font-black text-slate-600 uppercase">
                        {Number(u.standardHours) > 0 ? `${u.standardHours}h` : 'Default'}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <span className="font-mono font-bold text-indigo-600 text-sm">SR {(Number(u.grossSalary) || 0).toLocaleString()}</span>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => handleViewLogs(u)} className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all"><i className="fa-solid fa-list-check text-[10px]"></i></button>
                        <button onClick={() => setEditingUser(u)} className="w-9 h-9 rounded-xl bg-slate-50 text-slate-400 hover:text-indigo-600 transition-all shadow-sm"><i className="fa-solid fa-pen-to-square text-[10px]"></i></button>
                        <button onClick={() => handleDelete(u.id)} className="w-9 h-9 rounded-xl bg-slate-50 text-slate-400 hover:text-rose-600 transition-all shadow-sm"><i className="fa-solid fa-trash-can text-[10px]"></i></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminUserManagement;
