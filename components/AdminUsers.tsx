
import React, { useState, useEffect } from 'react';
import { dataService } from '../services/dataService';
import { User, UserRole } from '../types';

const AdminUsers: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newUser, setNewUser] = useState({
    username: '',
    password: '',
    name: '',
    employeeId: '',
    department: '',
    role: 'employee' as UserRole
  });

  const fetchUsers = async () => {
    setLoading(true);
    const u = await dataService.getUsers();
    setUsers(u);
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    await dataService.addUser(newUser);
    await fetchUsers();
    setShowForm(false);
    setNewUser({
      username: '',
      password: '',
      name: '',
      employeeId: '',
      department: '',
      role: 'employee'
    });
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">User Management</h1>
          <p className="text-slate-500">Add or manage employee access</p>
        </div>
        <button 
          onClick={() => setShowForm(!showForm)}
          className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"
        >
          <i className={`fa-solid ${showForm ? 'fa-xmark' : 'fa-plus'} mr-2`}></i>
          {showForm ? 'Cancel' : 'Add Employee'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAddUser} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4 animate-fadeIn">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="text"
              required
              placeholder="Full Name"
              className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
              value={newUser.name}
              onChange={e => setNewUser({...newUser, name: e.target.value})}
            />
            <input
              type="text"
              required
              placeholder="Employee ID (e.g. EMP-001)"
              className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
              value={newUser.employeeId}
              onChange={e => setNewUser({...newUser, employeeId: e.target.value})}
            />
            <input
              type="text"
              required
              placeholder="Username"
              className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
              value={newUser.username}
              onChange={e => setNewUser({...newUser, username: e.target.value})}
            />
            <input
              type="password"
              required
              placeholder="Password"
              className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
              value={newUser.password}
              onChange={e => setNewUser({...newUser, password: e.target.value})}
            />
            <input
              type="text"
              placeholder="Department"
              className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
              value={newUser.department}
              onChange={e => setNewUser({...newUser, department: e.target.value})}
            />
            <select
              className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
              value={newUser.role}
              onChange={e => setNewUser({...newUser, role: e.target.value as UserRole})}
            >
              <option value="employee">Employee Role</option>
              <option value="admin">Admin Role</option>
            </select>
          </div>
          <button type="submit" className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl hover:bg-slate-800 transition-all">
            Save User
          </button>
        </form>
      )}

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden min-h-[200px]">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50/50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase">User</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase">Department</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase">ID</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-slate-400 uppercase">Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-3">
                      <img src={u.avatar} className="w-8 h-8 rounded-full" alt="" />
                      <div>
                        <p className="font-bold text-slate-900">{u.name}</p>
                        <p className="text-xs text-slate-400">@{u.username}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">{u.department}</td>
                  <td className="px-6 py-4 text-sm text-slate-600 font-mono">{u.employeeId}</td>
                  <td className="px-6 py-4 text-right">
                    <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase ${u.role === 'admin' ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-600'}`}>
                      {u.role}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default AdminUsers;
