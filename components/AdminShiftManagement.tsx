import React, { useState, useEffect, useMemo } from 'react';
import { dataService } from '../services/dataService';
import { ShiftSchedule, User } from '../types';
import { useLanguage } from '../utils/LanguageContext';

const AdminShiftManagement: React.FC = () => {
  const { t, isRtl } = useLanguage();
  const [shifts, setShifts] = useState<ShiftSchedule[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingShift, setEditingShift] = useState<Partial<ShiftSchedule> | null>(null);
  const [saving, setSaving] = useState(false);
  const [userSearch, setUserSearch] = useState('');

  const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const fetchData = async () => {
    setLoading(true);
    try {
      const [s, u] = await Promise.all([
        dataService.getShiftSchedules(),
        dataService.getUsers()
      ]);
      setShifts(s);
      setUsers(u);
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
    if (!editingShift?.name) return alert(t('shiftNameRequired'));
    setSaving(true);
    try {
      await dataService.saveShiftSchedule(editingShift);
      await fetchData();
      setEditingShift(null);
    } catch (err) {
      alert('Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('deleteScheduleConfirm'))) return;
    try {
      await dataService.deleteShiftSchedule(id);
      setShifts(shifts.filter(s => s.id !== id));
    } catch (err) {
      alert('Delete failed');
    }
  };

  const toggleDay = (day: string) => {
    const current = editingShift?.workingDays || [];
    const updated = current.includes(day)
      ? current.filter(d => d !== day)
      : [...current, day];
    setEditingShift(prev => ({ ...prev, workingDays: updated }));
  };

  const toggleUser = (userId: string) => {
    const current = editingShift?.assignedUserIds || [];
    const updated = current.includes(userId)
      ? current.filter(id => id !== userId)
      : [...current, userId];
    setEditingShift(prev => ({ ...prev, assignedUserIds: updated }));
  };

  const filteredUsers = useMemo(() => {
    const s = userSearch.toLowerCase();
    return users.filter(u => 
      (u?.name || '').toLowerCase().includes(s) || 
      (u?.employeeId || '').toLowerCase().includes(s)
    ).sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || '')));
  }, [users, userSearch]);

  if (loading) return (
    <div className="p-20 text-center">
      <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
      <p className="text-slate-400 font-black text-xs uppercase tracking-widest">{t('loadingSchedules')}</p>
    </div>
  );

  return (
    <div className={`space-y-8 animate-fadeIn pb-20 ${isRtl ? 'text-right' : 'text-left'}`}>
      <div className={`flex justify-between items-center ${isRtl ? 'flex-row-reverse' : ''}`}>
        <div className="text-start">
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">{t('shiftSchedules')}</h1>
          <p className="text-slate-500">{t('defineWorkingHours')}</p>
        </div>
        {!editingShift && (
          <button 
            onClick={() => {
              setEditingShift({ name: '', startTime: '08:00', endTime: '17:00', workingDays: ["Mon", "Tue", "Wed", "Thu", "Fri"], assignedUserIds: [], disableAutoClose: false });
              setUserSearch('');
            }}
            className={`px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-lg hover:bg-indigo-700 transition-all flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}
          >
            <i className="fa-solid fa-calendar-plus"></i>
            <span>{t('createShift')}</span>
          </button>
        )}
      </div>

      {editingShift ? (
        <div className="max-w-4xl bg-white rounded-3xl border border-slate-100 shadow-xl p-8 space-y-8 animate-fadeIn">
          <div className={`flex justify-between items-center ${isRtl ? 'flex-row-reverse' : ''}`}>
            <h2 className="text-xl font-black text-slate-900">{editingShift.id ? t('editShift') : t('newShiftConfig')}</h2>
            <button onClick={() => setEditingShift(null)} className="text-slate-400 hover:text-slate-600">
              <i className="fa-solid fa-xmark text-xl"></i>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1 text-start">{t('shiftLabel')}</label>
                <input 
                  type="text"
                  value={editingShift.name}
                  onChange={(e) => setEditingShift({ ...editingShift, name: e.target.value })}
                  placeholder="e.g. Night Shift - Site A"
                  className={`w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm ${isRtl ? 'text-right' : 'text-left'}`}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1 text-start">{t('startTime')}</label>
                  <input 
                    type="time"
                    value={editingShift.startTime}
                    onChange={(e) => setEditingShift({ ...editingShift, startTime: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1 text-start">{t('endTime')}</label>
                  <input 
                    type="time"
                    value={editingShift.endTime}
                    onChange={(e) => setEditingShift({ ...editingShift, endTime: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono text-sm"
                  />
                </div>
              </div>

              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
                 <div className={`flex items-center justify-between ${isRtl ? 'flex-row-reverse' : ''}`}>
                    <div className="text-start">
                      <p className="text-xs font-black text-slate-900 uppercase">{t('disableMidnightAutoClose')}</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">{t('allowSessionsMidnight')}</p>
                    </div>
                    <button 
                      onClick={() => setEditingShift({ ...editingShift, disableAutoClose: !editingShift.disableAutoClose })}
                      className={`w-12 h-6 rounded-full relative transition-all duration-300 ${editingShift.disableAutoClose ? 'bg-rose-500' : 'bg-slate-300'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 shadow-sm ${editingShift.disableAutoClose ? (isRtl ? 'right-7' : 'left-7') : (isRtl ? 'right-1' : 'left-1')}`}></div>
                    </button>
                 </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1 text-start">{t('workingDays')}</label>
                <div className={`flex flex-wrap ${isRtl ? 'flex-row-reverse justify-end' : ''} gap-2`}>
                  {daysOfWeek.map(day => {
                    const active = (editingShift.workingDays || []).includes(day);
                    return (
                      <button
                        key={day}
                        onClick={() => toggleDay(day)}
                        className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase transition-all border ${
                          active ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white border-slate-200 text-slate-400'
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex flex-col">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 ml-1 text-start">{t('assignedPersonnel')}</label>
              
              <div className="mb-3 relative group">
                <i className={`fa-solid fa-magnifying-glass absolute ${isRtl ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors`}></i>
                <input 
                  type="text" 
                  placeholder={t('findStaffPlaceholder')} 
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className={`w-full ${isRtl ? 'pr-9 pl-3 text-right' : 'pl-9 pr-3 text-left'} py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none`}
                />
              </div>

              <div className="flex-1 overflow-y-auto max-h-[300px] border border-slate-100 rounded-2xl bg-slate-50 p-2 space-y-1 shadow-inner no-scrollbar">
                {filteredUsers.length === 0 ? (
                  <div className="py-10 text-center opacity-40">
                    <p className="text-[10px] font-black uppercase tracking-widest">{t('noMatchingStaff')}</p>
                  </div>
                ) : filteredUsers.map(user => {
                  const isAssigned = (editingShift.assignedUserIds || []).includes(user.id);
                  return (
                    <button
                      key={user.id}
                      onClick={() => toggleUser(user.id)}
                      className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${isRtl ? 'flex-row-reverse' : ''} ${
                        isAssigned ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-100'
                      }`}
                    >
                      <div className={`flex items-center gap-3 text-start ${isRtl ? 'flex-row-reverse' : ''}`}>
                        <img src={user.avatar || `https://ui-avatars.com/api/?name=${user.name}`} className="w-6 h-6 rounded-full border border-white/20" alt="" />
                        <div className="text-start">
                          <p className="text-xs font-bold leading-none">{user.name}</p>
                          <p className={`text-[8px] font-black uppercase tracking-tighter mt-0.5 ${isAssigned ? 'text-indigo-200' : 'text-slate-400'}`}>{user.employeeId}</p>
                        </div>
                      </div>
                      {isAssigned && <i className="fa-solid fa-check text-[10px]"></i>}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className={`pt-6 border-t border-slate-100 flex gap-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
             <button onClick={() => setEditingShift(null)} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all">{t('cancel')}</button>
             <button 
              onClick={handleSave}
              disabled={saving}
              className="flex-2 py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all disabled:opacity-50"
            >
              {saving ? <i className="fa-solid fa-circle-notch fa-spin"></i> : t('applyScheduleConfig')}
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {shifts.map(shift => (
            <div key={shift.id} className={`bg-white rounded-3xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-all flex flex-col group ${isRtl ? 'text-right' : 'text-left'}`}>
              <div className={`flex justify-between items-start mb-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${shift.disableAutoClose ? 'bg-rose-50 text-rose-500 ring-2 ring-rose-100' : 'bg-indigo-50 text-indigo-600'}`}>
                  <i className={`fa-solid ${shift.disableAutoClose ? 'fa-moon' : 'fa-business-time'} text-xl`}></i>
                </div>
                <div className={`flex gap-1 opacity-0 group-hover:opacity-100 transition-all ${isRtl ? 'flex-row-reverse' : ''}`}>
                  <button onClick={() => { setEditingShift(shift); setUserSearch(''); }} className="w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-indigo-600">
                    <i className="fa-solid fa-pen-to-square text-xs"></i>
                  </button>
                  <button onClick={() => handleDelete(shift.id)} className="w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-rose-600">
                    <i className="fa-solid fa-trash-can text-xs"></i>
                  </button>
                </div>
              </div>

              <h3 className="text-xl font-black text-slate-900 mb-1 text-start">{shift.name}</h3>
              <div className={`flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-indigo-500 mb-2 ${isRtl ? 'flex-row-reverse justify-end' : 'justify-start'}`}>
                <i className="fa-solid fa-clock"></i>
                <span>{shift.startTime} — {shift.endTime}</span>
              </div>
              
              {shift.disableAutoClose && (
                <div className={`mb-4 inline-flex items-center gap-1.5 px-2 py-1 bg-rose-50 text-rose-600 text-[8px] font-black uppercase tracking-widest rounded border border-rose-100 w-fit ${isRtl ? 'flex-row-reverse' : ''}`}>
                   <i className="fa-solid fa-moon"></i>
                   <span>{t('midnightClosureDisabled')}</span>
                </div>
              )}

              <div className={`flex flex-wrap ${isRtl ? 'flex-row-reverse justify-end' : ''} gap-1 mb-6`}>
                {shift.workingDays.map(d => (
                  <span key={d} className="text-[9px] font-black uppercase text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                    {d}
                  </span>
                ))}
              </div>

              <div className={`mt-auto pt-4 border-t border-slate-50 flex items-center justify-between ${isRtl ? 'flex-row-reverse' : ''}`}>
                <div className={`flex ${isRtl ? 'flex-row-reverse space-x-reverse -space-x-2' : '-space-x-2'}`}>
                  {(shift.assignedUserIds || []).slice(0, 4).map(uid => {
                    const u = users.find(user => user.id === uid);
                    return u ? (
                      <img key={uid} src={u.avatar || `https://ui-avatars.com/api/?name=${u.name}`} className="w-6 h-6 rounded-full border-2 border-white shadow-sm" title={u.name} alt="" />
                    ) : null;
                  })}
                </div>
                <span className="text-[10px] font-black text-slate-300 uppercase tracking-tighter text-start">
                  {(shift.assignedUserIds || []).length} {t('personnel')}
                </span>
              </div>
            </div>
          ))}
          {shifts.length === 0 && (
             <div className="col-span-full py-20 bg-white rounded-3xl border border-dashed border-slate-200 text-center">
                <i className="fa-solid fa-calendar-xmark text-4xl text-slate-100 mb-4 block"></i>
                <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">{t('noActiveShiftSchedules')}</p>
             </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminShiftManagement;
