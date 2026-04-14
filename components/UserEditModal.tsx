import React, { useState } from 'react';
import { User } from '../types';
import { dataService } from '../services/dataService';

interface Props {
  user: Partial<User>;
  onClose: () => void;
  onSave: () => void;
}

const UserEditModal: React.FC<Props> = ({ user: initialUser, onClose, onSave }) => {
  const [editingUser, setEditingUser] = useState<Partial<User>>(initialUser);
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);

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
      } as User;

      if (editingUser.id) {
        await dataService.saveUser(sanitizedUser);
      } else {
        await dataService.adminCreateUser(sanitizedUser, password);
      }
      onSave();
      onClose();
    } catch (err: any) {
      console.error("Staff update error:", err);
      alert(err.message || 'Failed to process staff update.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[200] flex items-center justify-center p-4 no-print overflow-y-auto">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl my-8 overflow-hidden animate-fadeIn flex flex-col">
        <div className="bg-indigo-600 p-8 text-white">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-black">{editingUser.id ? 'Edit Profile' : 'Add New Staff'}</h2>
              <p className="text-[10px] font-bold text-indigo-100 uppercase tracking-[0.2em] mt-1">Personnel Information & Policies</p>
            </div>
            <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
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

            {/* LEAVE STATUS */}
            <div className="p-6 bg-indigo-50/50 rounded-[2rem] border border-indigo-100 space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${editingUser.isOnLeave ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-400'}`}>
                    <i className="fa-solid fa-plane-departure"></i>
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-900 uppercase tracking-tight">On Leave Status</p>
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Mark employee as currently away</p>
                  </div>
                </div>
                <button 
                  onClick={() => setEditingUser({ ...editingUser, isOnLeave: !editingUser.isOnLeave })}
                  className={`w-14 h-7 rounded-full relative transition-all duration-300 ${editingUser.isOnLeave ? 'bg-indigo-600' : 'bg-slate-300'}`}
                >
                  <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all duration-300 shadow-md ${editingUser.isOnLeave ? 'left-8' : 'left-1'}`}></div>
                </button>
              </div>

              {editingUser.isOnLeave && (
                <div className="grid grid-cols-2 gap-4 animate-fadeIn">
                  <div>
                    <label className="block text-[9px] font-black text-indigo-600 uppercase tracking-widest mb-1.5 ml-1">Leave Start Date</label>
                    <input 
                      type="date" 
                      value={editingUser.leaveStartDate || ''} 
                      onChange={(e) => setEditingUser({ ...editingUser, leaveStartDate: e.target.value })} 
                      className="w-full px-4 py-3 bg-white border border-indigo-100 rounded-xl font-bold text-xs focus:ring-2 focus:ring-indigo-500 outline-none transition-all" 
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-indigo-600 uppercase tracking-widest mb-1.5 ml-1">Leave End Date</label>
                    <input 
                      type="date" 
                      value={editingUser.leaveEndDate || ''} 
                      onChange={(e) => setEditingUser({ ...editingUser, leaveEndDate: e.target.value })} 
                      className="w-full px-4 py-3 bg-white border border-indigo-100 rounded-xl font-bold text-xs focus:ring-2 focus:ring-indigo-500 outline-none transition-all" 
                    />
                  </div>
                </div>
              )}
            </div>
          </div>


          {/* SECTION 4: WPS / MUDAD BANKING */}
          <div className="space-y-4">
            <h3 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest border-b border-emerald-50 pb-2 flex items-center gap-2">
              <i className="fa-solid fa-building-columns"></i>
              WPS / Mudad Banking Info
            </h3>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest -mt-2">Required for Saudi Wage Protection System export</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Iqama / National ID <span className="text-rose-400">10 digits</span></label>
                <input
                  type="text"
                  maxLength={10}
                  value={editingUser.iqamaNumber || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, iqamaNumber: e.target.value.replace(/\D/g, '') })}
                  placeholder="1023456789"
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-mono font-bold focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Bank Short Code</label>
                <select
                  value={editingUser.bankCode || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, bankCode: e.target.value })}
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none cursor-pointer focus:ring-2 focus:ring-emerald-500 transition-all"
                >
                  <option value="">— Select Bank —</option>
                  <option value="RJHI">Al Rajhi Bank (RJHI)</option>
                  <option value="SNB">Saudi National Bank (SNB)</option>
                  <option value="INMA">Alinma Bank (INMA)</option>
                  <option value="RIBL">Riyad Bank (RIBL)</option>
                  <option value="ALBI">Bank Albilad (ALBI)</option>
                  <option value="ANB">Arab National Bank (ANB)</option>
                  <option value="BSF">Banque Saudi Fransi (BSF)</option>
                  <option value="SAB">SAB / Alawwal (SAB)</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">IBAN <span className="text-rose-400">24 chars starting with SA</span></label>
                <input
                  type="text"
                  maxLength={24}
                  value={editingUser.ibanNumber || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, ibanNumber: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })}
                  placeholder="SA1234567890123456789012"
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-mono font-bold focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                />
                {editingUser.ibanNumber && (editingUser.ibanNumber.length !== 24 || !editingUser.ibanNumber.startsWith('SA')) && (
                  <p className="text-[9px] font-black text-rose-500 uppercase tracking-widest ml-1 mt-1">⚠ Must be 24 characters and start with SA</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-1">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Basic Salary (SR)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editingUser.basicSalary ?? ''}
                  onChange={(e) => setEditingUser({ ...editingUser, basicSalary: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-mono font-bold focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Housing Allowance (SR)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editingUser.housingAllowance ?? ''}
                  onChange={(e) => setEditingUser({ ...editingUser, housingAllowance: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-mono font-bold focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Other Allowances (SR)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editingUser.otherAllowances ?? ''}
                  onChange={(e) => setEditingUser({ ...editingUser, otherAllowances: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-mono font-bold focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                />
              </div>
            </div>

            {/* WPS preview row */}
            {(editingUser.iqamaNumber || editingUser.bankCode || editingUser.ibanNumber) && (
              <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 animate-fadeIn">
                <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-2">WPS File Preview (this employee)</p>
                <code className="text-[10px] font-mono text-emerald-900 break-all">
                  {editingUser.iqamaNumber || '??????????'},{editingUser.bankCode || '????'},{editingUser.ibanNumber || 'SA????????????????????????'},{(editingUser.basicSalary || 0).toFixed(2)},{(editingUser.housingAllowance || 0).toFixed(2)},{(editingUser.otherAllowances || 0).toFixed(2)},0.00,{((editingUser.basicSalary || 0) + (editingUser.housingAllowance || 0) + (editingUser.otherAllowances || 0)).toFixed(2)}
                </code>
              </div>
            )}
          </div>

          {/* SAVE BUTTONS */}
          <div className="pt-6 flex gap-4">
            <button type="button" onClick={onClose} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all">Cancel</button>
            <button type="button" onClick={handleSave} disabled={saving} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all disabled:opacity-50">
              {saving ? <i className="fa-solid fa-circle-notch fa-spin"></i> : (editingUser.id ? 'Apply Changes' : 'Create Staff Profile')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserEditModal;