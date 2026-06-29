import React, { useState, useEffect, useMemo } from 'react';
import { dataService } from '../services/dataService';
import { User } from '../types';
import { useLanguage } from '../utils/LanguageContext';
import { useDialog } from '../utils/DialogContext';
import UserEditModal from './UserEditModal';

interface Props {
  currentUser?: User;
  onRefreshUser?: () => void;
}

const AdminUserManagement: React.FC<Props> = ({ currentUser, onRefreshUser }) => {
  const { t, isRtl } = useLanguage();
  const { showAlert, showConfirm } = useDialog();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<Partial<User> | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await dataService.getUsers();
      setUsers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleDelete = async (id: string) => {
    const isConfirmed = await showConfirm(t('confirmDeleteUser'), t('warning'), 'warning');
    if (!isConfirmed) return;
    try {
      await dataService.deleteUser(id);
      setUsers(users.filter(u => u.id !== id));
    } catch (err) {
      await showAlert('Delete failed', t('error'), 'error');
    }
  };

  const filteredUsers = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return users.filter(u => 
      (u?.name || '').toLowerCase().includes(term) || 
      (u?.email || '').toLowerCase().includes(term) || 
      (u?.employeeId || '').toLowerCase().includes(term) ||
      (u?.department || '').toLowerCase().includes(term)
    ).sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || '')));
  }, [users, searchTerm]);

  if (loading) return (
    <div className="p-20 text-center">
      <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
      <p className="text-slate-400 font-black text-xs uppercase tracking-widest">{t('scanningPersonnel')}</p>
    </div>
  );

  return (
    <div className={`space-y-8 animate-fadeIn pb-20 ${isRtl ? 'text-right' : 'text-left'}`}>
      <div className={`flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${isRtl ? 'md:flex-row-reverse' : ''}`}>
        <div className="text-start">
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">{t('navStaff')}</h1>
          <p className="text-slate-500">{t('staffSub')}</p>
        </div>
        <button 
          onClick={() => {
            setEditingUser({ name: '', email: '', employeeId: '', role: 'employee', department: 'Operations', disabled: false });
            setSearchTerm('');
          }}
          className={`px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-lg hover:bg-indigo-700 transition-all flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}
        >
          <i className="fa-solid fa-user-plus"></i>
          <span>{t('addStaffBtn')}</span>
        </button>
      </div>

      <div className="space-y-6">
        <div className="relative group max-w-md">
          <i className={`fa-solid fa-magnifying-glass absolute ${isRtl ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-all`}></i>
          <input 
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t('searchStaffPlaceholder')}
            className={`w-full ${isRtl ? 'pr-11 pl-4' : 'pl-11 pr-4'} py-3.5 bg-white border border-slate-100 rounded-2xl font-bold shadow-sm outline-none transition-all focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600`}
          />
        </div>

        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/50 overflow-hidden" dir={isRtl ? 'rtl' : 'ltr'}>
          <div className="overflow-x-auto">
            <table className="w-full text-start">
              <thead>
                <tr className="bg-slate-50/50">
                  <th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest text-start">{t('employee')}</th>
                  <th className="px-6 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest text-start">{t('systemRole')}</th>
                  <th className="px-6 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest text-start">{t('emailAddress')}</th>
                  <th className="px-6 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">{t('status')}</th>
                  <th className={`px-8 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest ${isRtl ? 'text-start' : 'text-end'}`}></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-8 py-5 text-start">
                      <div className={`flex items-center gap-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
                        <img 
                          src={u.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=random`} 
                          className="w-11 h-11 rounded-2xl border border-slate-100 shadow-sm flex-shrink-0" 
                          alt="" 
                        />
                        <div className="text-start">
                          <p className="font-bold text-slate-900 leading-tight">{u.name}</p>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">{u.department} • {u.employeeId}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-start">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                        u.role === 'admin' ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {u.role === 'admin' ? t('adminSupervisor') : t('standardUser')}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-start">
                      <span className="font-bold text-slate-600 text-sm">{u.email}</span>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <span className={`inline-flex items-center px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest gap-2 ${
                        !u.disabled ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                      }`}>
                        <i className={`fa-solid ${!u.disabled ? 'fa-circle-check' : 'fa-circle-xmark'}`}></i>
                        {!u.disabled ? t('active') : t('suspended')}
                      </span>
                    </td>
                    <td className={`px-8 py-5 ${isRtl ? 'text-start' : 'text-end'}`}>
                      <div className={`flex gap-1 opacity-0 group-hover:opacity-100 transition-all ${isRtl ? 'flex-row-reverse justify-start' : 'justify-end'}`}>
                        <button onClick={() => setEditingUser(u)} className="w-9 h-9 rounded-xl bg-slate-50 text-slate-400 hover:text-indigo-600 transition-all">
                          <i className="fa-solid fa-pen-to-square text-xs"></i>
                        </button>
                        <button onClick={() => handleDelete(u.id)} className="w-9 h-9 rounded-xl bg-slate-50 text-slate-400 hover:text-rose-600 transition-all">
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

      {editingUser && (
        <UserEditModal 
          user={editingUser} 
          onClose={() => setEditingUser(null)} 
          onSave={() => {
            fetchUsers();
            if (editingUser.id === currentUser?.id && onRefreshUser) {
              onRefreshUser();
            }
          }} 
        />
      )}
    </div>
  );
};

export default AdminUserManagement;
