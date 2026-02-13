
import React, { useState, useEffect } from 'react';
import { dataService } from '../services/dataService';
import { ShiftSchedule, User } from '../types';

const AdminShiftManagement: React.FC = () => {
  const [shifts, setShifts] = useState<ShiftSchedule[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingShift, setEditingShift] = useState<Partial<ShiftSchedule> | null>(null);
  const [saving, setSaving] = useState(false);

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
    if (!editingShift?.name) return alert('Shift name is required');
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
    if (!confirm('Delete this schedule?')) return;
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

  if (loading) return (
    <div className="p-20 text-center">
      <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
      <p className="text-slate-400 font-black text-xs uppercase tracking-widest">Loading Schedules...</p>
    </div>
  );

  return (
    <div className="space-y-8 animate-fadeIn pb-20">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Shift Schedules</h1>
          <p className="text-slate-500">Define working hours and assign staff to rotations</p>
        </div>
        {!editingShift && (
          <button 
            onClick={() => setEditingShift({ name: '', startTime: '08:00', endTime: '17:00', workingDays: ["Mon", "Tue", "Wed", "Thu", "Fri"], assignedUserIds: [] })}
            className="px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-lg hover:bg-indigo-700 transition-all flex items-center space-x-2"
          >
            <i className="fa-solid fa-calendar-plus"></i>
            <span>Create Shift</span>
          </button>
        )}
      </div>

      {editingShift ? (
        <div className="max-w-4xl bg-white rounded-3xl border border-slate-100 shadow-xl p-8 space-y-8 animate-fadeIn">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-black text-slate-900">{editingShift.id ? 'Edit Shift' : 'New Shift Configuration'}</h2>
            <button onClick={() => setEditingShift(null)} className="text-slate-400 hover:text-slate-600">
              <i className="fa-solid fa-xmark text-xl"></i>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Shift Label</label>
                <input 
                  type="text"
                  value={editingShift.name}
                  onChange={(e) => setEditingShift({ ...editingShift, name: e.target.value })}
                  placeholder="e.g. Morning Shift - Site A"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Start Time</label>
                  <input 
                    type="time"
                    value={editingShift.startTime}
                    onChange={(e) => setEditingShift({ ...editingShift, startTime: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">End Time</label>
                  <input 
                    type="time"
                    value={editingShift.endTime}
                    onChange={(e) => setEditingShift({ ...editingShift, endTime: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Working Days</label>
                <div className="flex flex-wrap gap-2">
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
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 ml-1">Assigned Personnel</label>
              <div className="flex-1 overflow-y-auto max-h-[300px] border border-slate-100 rounded-2xl bg-slate-50 p-2 space-y-1">
                {users.map(user => {
                  const isAssigned = (editingShift.assignedUserIds || []).includes(user.id);
                  return (
                    <button
                      key={user.id}
                      onClick={() => toggleUser(user.id)}
                      className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${
                        isAssigned ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-100'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <img src={user.avatar || `https://ui-avatars.com/api/?name=${user.name}`} className="w-6 h-6 rounded-full border border-white/20" />
                        <p className="text-xs font-bold leading-none">{user.name}</p>
                      </div>
                      {isAssigned && <i className="fa-solid fa-check text-[10px]"></i>}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100">
            <button 
              onClick={handleSave}
              disabled={saving}
              className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-lg hover:bg-indigo-700 transition-all disabled:opacity-50"
            >
              {saving ? <i className="fa-solid fa-circle-notch fa-spin"></i> : 'Apply Schedule Configuration'}
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {shifts.map(shift => (
            <div key={shift.id} className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-all flex flex-col group">
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <i className="fa-solid fa-business-time text-xl"></i>
                </div>
                <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-all">
                  <button onClick={() => setEditingShift(shift)} className="w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-indigo-600">
                    <i className="fa-solid fa-pen-to-square text-xs"></i>
                  </button>
                  <button onClick={() => handleDelete(shift.id)} className="w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-rose-600">
                    <i className="fa-solid fa-trash-can text-xs"></i>
                  </button>
                </div>
              </div>

              <h3 className="text-xl font-black text-slate-900 mb-1">{shift.name}</h3>
              <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-widest text-indigo-500 mb-4">
                <i className="fa-solid fa-clock"></i>
                <span>{shift.startTime} — {shift.endTime}</span>
              </div>

              <div className="flex flex-wrap gap-1 mb-6">
                {shift.workingDays.map(d => (
                  <span key={d} className="text-[9px] font-black uppercase text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                    {d}
                  </span>
                ))}
              </div>

              <div className="mt-auto pt-4 border-t border-slate-50 flex items-center justify-between">
                <div className="flex -space-x-2">
                  {(shift.assignedUserIds || []).slice(0, 4).map(uid => {
                    const u = users.find(user => user.id === uid);
                    return u ? (
                      <img key={uid} src={u.avatar || `https://ui-avatars.com/api/?name=${u.name}`} className="w-6 h-6 rounded-full border-2 border-white" />
                    ) : null;
                  })}
                </div>
                <span className="text-[10px] font-black text-slate-300 uppercase">
                  {(shift.assignedUserIds || []).length} Assigned
                </span>
              </div>
            </div>
          ))}
          {shifts.length === 0 && (
             <div className="col-span-full py-20 bg-white rounded-3xl border border-dashed border-slate-200 text-center">
                <i className="fa-solid fa-calendar-xmark text-4xl text-slate-100 mb-4 block"></i>
                <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No active shift schedules.</p>
             </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminShiftManagement;
