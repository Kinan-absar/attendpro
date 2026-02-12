
import React, { useState, useEffect } from 'react';
import { dataService } from '../services/dataService';
import { User, AttendanceRecord } from '../types';
import History from './History';

const AdminUserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<Partial<User> | null>(null);
  const [viewingLogs, setViewingLogs] = useState<{ user: User; records: AttendanceRecord[] } | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [showSecurityGuide, setShowSecurityGuide] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const u = await dataService.getUsers();
      setUsers(u);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleSave = async () => {
    if (!editingUser?.name || !editingUser?.email || !editingUser?.employeeId) {
      return alert('Mandatory Fields: Full Name, Email, and Staff ID are required.');
    }
    setSaving(true);
    try {
      await dataService.saveUser(editingUser);
      await fetchUsers();
      setEditingUser(null);
    } catch (err: any) {
      console.error(err);
      if (err.code === 'permission-denied' || err.message?.includes('permission')) {
        alert('Permission Denied: Ensure Firestore Security Rules allow admins to write to the users collection.');
      } else {
        alert(err.message || 'Failed to save user.');
      }
    } finally {
      setSaving(false);
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
    if (!confirm('Are you sure? This will remove their Firestore profile.')) return;
    try {
      await dataService.deleteUser(id);
      setUsers(users.filter(u => u.id !== id));
    } catch (err) {
      console.error(err);
      alert('Failed to delete user.');
    }
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
          <button
            onClick={() => setViewingLogs(null)}
            className="flex items-center text-indigo-600 font-bold hover:text-indigo-800 transition-colors"
          >
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
      <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Loading Staff Directory...</p>
    </div>
  );

  return (
    <div className="space-y-8 animate-fadeIn pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Staff Management</h1>
          <p className="text-slate-500">Create and manage employee profiles in Firestore</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowSecurityGuide(true)}
            className="w-12 h-12 bg-white border border-slate-200 rounded-2xl flex items-center justify-center text-slate-400 hover:text-indigo-600 transition-all shadow-sm"
            title="Fix Permissions"
          >
            <i className="fa-solid fa-shield-halved"></i>
          </button>
          <button 
            onClick={() => setEditingUser({ name: '', email: '', employeeId: '', department: '', role: 'employee', grossSalary: 0, company: 'Absar Alomran', disableOvertime: true, disableDeductions: false, standardHours: 225 })}
            className="px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center space-x-2"
          >
            <i className="fa-solid fa-user-plus"></i>
            <span>Add New Staff</span>
          </button>
        </div>
      </div>

      {/* SEARCH BAR */}
      <div className="relative group max-w-md">
        <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
        <input 
          type="text"
          placeholder="Search by name, ID, or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm"
        />
      </div>

      {/* MODAL / FORM */}
      {editingUser && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden animate-fadeIn">
            <div className="bg-indigo-600 p-8 text-white">
              <div className="flex justify-between items-center mb-2">
                <h2 className="text-2xl font-black">{editingUser.id ? 'Edit Profile' : 'Add New Staff'}</h2>
                <button onClick={() => setEditingUser(null)} className="text-white/60 hover:text-white transition-colors">
                  <i className="fa-solid fa-circle-xmark text-2xl"></i>
                </button>
              </div>
              <p className="text-indigo-100 text-sm opacity-80">
                {editingUser.id ? `Managing ${editingUser.name}'s account` : 'Creating a new workforce identity in Firestore'}
              </p>
            </div>

            <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
                    Full Name <span className="text-rose-500">*</span>
                  </label>
                  <input 
                    type="text"
                    required
                    value={editingUser.name || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                    className={`w-full px-4 py-3 bg-slate-50 border rounded-xl font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all ${!editingUser.name ? 'border-rose-200' : 'border-slate-200'}`}
                    placeholder="e.g. Mitchell Admin"
                  />
                </div>
                <div className="col-span-2">
                   <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
                    Corporate Email <span className="text-rose-500">*</span>
                  </label>
                  <input 
                    type="email"
                    required
                    value={editingUser.email || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                    className={`w-full px-4 py-3 bg-slate-50 border rounded-xl font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all ${!editingUser.email ? 'border-rose-200' : 'border-slate-200'}`}
                    placeholder="name@company.com"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
                    Staff ID <span className="text-rose-500">*</span>
                  </label>
                  <input 
                    type="text"
                    required
                    value={editingUser.employeeId || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, employeeId: e.target.value })}
                    className={`w-full px-4 py-3 bg-slate-50 border rounded-xl font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all ${!editingUser.employeeId ? 'border-rose-200' : 'border-slate-200'}`}
                    placeholder="EMP-000"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Department</label>
                  <input 
                    type="text"
                    value={editingUser.department || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, department: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    placeholder="e.g. Operations"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Company / Branch</label>
                  <input 
                    type="text"
                    value={editingUser.company || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, company: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    placeholder="e.g. Absar Alomran Construction"
                  />
                </div>

                <div className="pt-4 border-t border-slate-100 col-span-2">
                  <h3 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-4">Payroll Flexibility Settings</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Monthly Gross (SR)</label>
                      <input 
                        type="number"
                        value={editingUser.grossSalary || ''}
                        onChange={(e) => setEditingUser({ ...editingUser, grossSalary: parseFloat(e.target.value) || 0 })}
                        className="w-full px-4 py-3 bg-indigo-50/50 border border-indigo-100 rounded-xl font-black text-indigo-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Personal Std. Hours</label>
                      <input 
                        type="number"
                        value={editingUser.standardHours || ''}
                        onChange={(e) => setEditingUser({ ...editingUser, standardHours: parseFloat(e.target.value) || 0 })}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                        placeholder="Default 225"
                      />
                    </div>
                    <div className="col-span-2 space-y-3">
                      <button 
                        type="button"
                        onClick={() => setEditingUser({ ...editingUser, disableOvertime: !editingUser.disableOvertime })}
                        className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${
                          editingUser.disableOvertime 
                            ? 'bg-rose-50 border-rose-500 text-rose-700' 
                            : 'bg-white border-slate-100 text-slate-400'
                        }`}
                      >
                        <div className="text-left">
                          <p className="text-xs font-black uppercase tracking-tight">Disable Overtime Pay</p>
                          <p className="text-[10px] font-medium opacity-70">Overtime hours will not be compensated</p>
                        </div>
                        <i className={`fa-solid ${editingUser.disableOvertime ? 'fa-toggle-on text-rose-600 text-2xl' : 'fa-toggle-off text-slate-300 text-2xl'}`}></i>
                      </button>

                      <button 
                        type="button"
                        onClick={() => setEditingUser({ ...editingUser, disableDeductions: !editingUser.disableDeductions })}
                        className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${
                          editingUser.disableDeductions 
                            ? 'bg-rose-50 border-rose-500 text-rose-700' 
                            : 'bg-white border-slate-100 text-slate-400'
                        }`}
                      >
                        <div className="text-left">
                          <p className="text-xs font-black uppercase tracking-tight">Disable Attendance Deduction</p>
                          <p className="text-[10px] font-medium opacity-70">Missing hours will not be deducted from salary</p>
                        </div>
                        <i className={`fa-solid ${editingUser.disableDeductions ? 'fa-toggle-on text-rose-600 text-2xl' : 'fa-toggle-off text-slate-300 text-2xl'}`}></i>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="col-span-2 pt-4">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">System Role</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      type="button"
                      onClick={() => setEditingUser({ ...editingUser, role: 'employee' })}
                      className={`py-3 rounded-xl text-xs font-black uppercase tracking-widest border-2 transition-all ${editingUser.role === 'employee' ? 'bg-indigo-50 border-indigo-600 text-indigo-700' : 'bg-white border-slate-100 text-slate-400'}`}
                    >
                      Employee
                    </button>
                    <button 
                      type="button"
                      onClick={() => setEditingUser({ ...editingUser, role: 'admin' })}
                      className={`py-3 rounded-xl text-xs font-black uppercase tracking-widest border-2 transition-all ${editingUser.role === 'admin' ? 'bg-indigo-50 border-indigo-600 text-indigo-700' : 'bg-white border-slate-100 text-slate-400'}`}
                    >
                      Admin
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-4 flex gap-4">
                <button 
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-sm hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all disabled:opacity-50"
                >
                  {saving ? <i className="fa-solid fa-circle-notch fa-spin"></i> : (editingUser.id ? 'Update Profile' : 'Create Profile')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* USER LIST */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50/50">
              <tr>
                <th className="px-6 py-4 text-left font-black text-slate-400 uppercase text-[10px] tracking-widest">Employee</th>
                <th className="px-6 py-4 text-left font-black text-slate-400 uppercase text-[10px] tracking-widest">Company</th>
                <th className="px-6 py-4 text-center font-black text-slate-400 uppercase text-[10px] tracking-widest">Std Hours</th>
                <th className="px-6 py-4 text-right font-black text-slate-400 uppercase text-[10px] tracking-widest">Gross Salary</th>
                <th className="px-6 py-4 text-center font-black text-slate-400 uppercase text-[10px] tracking-widest">Exceptions</th>
                <th className="px-6 py-4 text-right font-black text-slate-400 uppercase text-[10px] tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredUsers.map(u => (
                <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-3">
                      <img 
                        src={u.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name || 'User')}&background=random`} 
                        className="w-10 h-10 rounded-2xl border border-slate-100" 
                        alt="" 
                      />
                      <div>
                        <p className="font-bold text-slate-900">{u.name || 'Unnamed Employee'}</p>
                        <p className="text-[10px] font-black text-indigo-500 uppercase tracking-tighter">ID: {u.employeeId || 'N/A'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-xs font-black text-slate-500 uppercase tracking-wider">{u.company || 'Absar Alomran'}</p>
                    <p className="text-[10px] text-slate-400">{u.email}</p>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="px-3 py-1 bg-slate-100 rounded-lg text-xs font-black text-slate-600">
                      {u.standardHours || '--'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="font-mono font-bold text-indigo-600">
                      SR {(u.grossSalary || 0).toLocaleString()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex flex-col items-center gap-1">
                      {u.disableOvertime && (
                        <span className="px-2 py-0.5 bg-rose-100 text-rose-700 rounded-full text-[8px] font-black uppercase tracking-widest">
                          No OT
                        </span>
                      )}
                      {u.disableDeductions && (
                        <span className="px-2 py-0.5 bg-rose-100 text-rose-700 rounded-full text-[8px] font-black uppercase tracking-widest">
                          No Ded
                        </span>
                      )}
                      {!u.disableOvertime && !u.disableDeductions && (
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-400 rounded-full text-[8px] font-black uppercase tracking-widest">
                          Standard
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => handleViewLogs(u)}
                        className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all"
                        title="View Shift Logs"
                      >
                        <i className="fa-solid fa-list-check text-xs"></i>
                      </button>
                      <button 
                        onClick={() => setEditingUser(u)}
                        className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-all"
                        title="Edit Profile"
                      >
                        <i className="fa-solid fa-pen-to-square text-xs"></i>
                      </button>
                      <button 
                        onClick={() => handleDelete(u.id)}
                        className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-all"
                        title="Delete User"
                      >
                        <i className="fa-solid fa-trash-can text-xs"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminUserManagement;
