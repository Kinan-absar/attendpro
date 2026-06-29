import React, { useState } from 'react';
import { User } from '../types';
import { dataService } from '../services/dataService';
import { useLanguage } from '../utils/LanguageContext';
import { useDialog } from '../utils/DialogContext';

interface Props {
  user: Partial<User>;
  onClose: () => void;
  onSave: () => void;
}

const UserEditModal: React.FC<Props> = ({ user: initialUser, onClose, onSave }) => {
  const { t, isRtl } = useLanguage();
  const { showAlert } = useDialog();
  const [editingUser, setEditingUser] = useState<Partial<User>>(initialUser);
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!editingUser?.name || !editingUser?.email || !editingUser?.employeeId) {
      await showAlert(t('mandatoryFieldsError'), t('warning'), 'warning');
      return;
    }

    if (!editingUser.id) {
      if (!password) {
        await showAlert(t('securityKeyError'), t('warning'), 'warning');
        return;
      }
      if (password.length < 6) {
        await showAlert(t('securityKeyLengthError'), t('warning'), 'warning');
        return;
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
      await showAlert(err.message || t('updateFailed'), t('error'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[200] flex items-center justify-center p-4 no-print">
      <div 
        className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden animate-fadeIn flex flex-col"
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        {/* HEADER - STICKY / FIXED */}
        <div className="bg-indigo-600 p-6 text-white shrink-0">
          <div className="flex justify-between items-center">
            <div className="text-start">
              <h2 className="text-xl font-black">{editingUser.id ? t('editProfileTitle') : t('addNewStaff')}</h2>
              <p className="text-[9px] font-bold text-indigo-100 uppercase tracking-[0.2em] mt-0.5">{t('personnelInfoPolicies')}</p>
            </div>
            <button type="button" onClick={onClose} className="text-white/60 hover:text-white transition-colors">
               <i className="fa-solid fa-circle-xmark text-xl"></i>
            </button>
          </div>
        </div>
        
        {/* BODY - SCROLLABLE */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 text-slate-700">
          {/* SECTION 1: IDENTITY & ACCESS */}
          <div className="space-y-3">
            <h3 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest border-b border-indigo-50 pb-2 text-start">{t('identityAccess')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1 text-start">{t('fullLegalName')}</label>
                <input type="text" value={editingUser.name || ''} onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })} className={`w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-xs ${isRtl ? 'text-right' : 'text-left'}`} />
              </div>
              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1 text-start">{t('corporateEmail')}</label>
                <input type="email" value={editingUser.email || ''} onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })} className={`w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-xs ${isRtl ? 'text-right' : 'text-left'}`} />
              </div>
              {!editingUser.id && (
                <div>
                  <label className="block text-[9px] font-black text-rose-500 uppercase tracking-widest mb-1 ml-1 text-start">{t('securityKeyPassword')}</label>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t('minChars')} className={`w-full px-4 py-2.5 bg-rose-50/50 border border-rose-100 rounded-xl font-bold focus:ring-2 focus:ring-rose-500 outline-none transition-all text-xs ${isRtl ? 'text-right' : 'text-left'}`} />
                </div>
              )}
            </div>
          </div>

          {/* SECTION 2: EMPLOYMENT */}
          <div className="space-y-3">
            <h3 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest border-b border-indigo-50 pb-2 text-start">{t('employmentDetails')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1 text-start">{t('staffId')}</label>
                <input type="text" value={editingUser.employeeId || ''} onChange={(e) => setEditingUser({ ...editingUser, employeeId: e.target.value })} className={`w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs focus:ring-2 focus:ring-indigo-500 outline-none ${isRtl ? 'text-right' : 'text-left'}`} />
              </div>
              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1 text-start">{t('department')}</label>
                <input type="text" value={editingUser.department || ''} onChange={(e) => setEditingUser({ ...editingUser, department: e.target.value })} className={`w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs focus:ring-2 focus:ring-indigo-500 outline-none ${isRtl ? 'text-right' : 'text-left'}`} />
              </div>
              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1 text-start">{t('companyEntity')}</label>
                <input 
                  type="text" 
                  value={editingUser.company || dataService.getCurrentUser()?.company || ''} 
                  disabled 
                  className={`w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl font-bold text-xs text-slate-500 outline-none cursor-not-allowed ${isRtl ? 'text-right' : 'text-left'}`} 
                />
              </div>
              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1 text-start">{t('systemRole')}</label>
                <select value={editingUser.role || 'employee'} onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value as any })} className={`w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs outline-none cursor-pointer focus:ring-2 focus:ring-indigo-500 ${isRtl ? 'text-right' : 'text-left'}`}>
                  <option value="employee">{t('employee')}</option>
                  <option value="admin">{t('admin')}</option>
                </select>
              </div>
            </div>
          </div>

          {/* SECTION 3: PAYROLL & POLICY */}
          <div className="space-y-3">
            <h3 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest border-b border-indigo-50 pb-2 text-start">{t('payrollAttendancePolicy')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1 text-start">{t('grossSalarySR')}</label>
                <input type="number" value={editingUser.grossSalary || ''} onChange={(e) => setEditingUser({ ...editingUser, grossSalary: parseFloat(e.target.value) || 0 })} className={`w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs focus:ring-2 focus:ring-indigo-500 outline-none ${isRtl ? 'text-right' : 'text-left'}`} />
              </div>
              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1 text-start">{t('targetMonthlyHours')}</label>
                <input type="number" value={editingUser.standardHours || ''} onChange={(e) => setEditingUser({ ...editingUser, standardHours: parseFloat(e.target.value) || 0 })} placeholder={t('globalDefaultPlaceholder')} className={`w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs focus:ring-2 focus:ring-indigo-500 outline-none ${isRtl ? 'text-right' : 'text-left'}`} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              <div className={`p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between ${isRtl ? 'flex-row-reverse' : ''}`}>
                <div className="text-start">
                  <p className="text-xs font-black text-slate-900 uppercase">{t('disableOvertime')}</p>
                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">{t('noPayExtraHours')}</p>
                </div>
                <button 
                  type="button"
                  onClick={() => setEditingUser({ ...editingUser, disableOvertime: !editingUser.disableOvertime })}
                  className={`w-12 h-6 rounded-full relative transition-all duration-300 ${editingUser.disableOvertime ? 'bg-rose-500' : 'bg-slate-300'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 shadow-sm ${editingUser.disableOvertime ? (isRtl ? 'right-7' : 'left-7') : (isRtl ? 'right-1' : 'left-1')}`}></div>
                </button>
              </div>
              <div className={`p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between ${isRtl ? 'flex-row-reverse' : ''}`}>
                <div className="text-start">
                  <p className="text-xs font-black text-slate-900 uppercase">{t('disableDeductions')}</p>
                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">{t('noPenaltyShortHours')}</p>
                </div>
                <button 
                  type="button"
                  onClick={() => setEditingUser({ ...editingUser, disableDeductions: !editingUser.disableDeductions })}
                  className={`w-12 h-6 rounded-full relative transition-all duration-300 ${editingUser.disableDeductions ? 'bg-rose-500' : 'bg-slate-300'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 shadow-sm ${editingUser.disableDeductions ? (isRtl ? 'right-7' : 'left-7') : (isRtl ? 'right-1' : 'left-1')}`}></div>
                </button>
              </div>
            </div>

            {/* SUSPEND ACCESS TOGGLE */}
            <div className={`p-4 bg-rose-50/50 rounded-xl border border-rose-100 flex items-center justify-between ${isRtl ? 'flex-row-reverse' : ''}`}>
              <div className="text-start">
                <p className="text-xs font-black text-rose-950 uppercase">{t('suspendAccess')}</p>
                <p className="text-[8px] font-bold text-rose-600 uppercase tracking-tighter">{t('preventUserClocking')}</p>
              </div>
              <button 
                type="button"
                onClick={() => setEditingUser({ ...editingUser, disabled: !editingUser.disabled })}
                className={`w-12 h-6 rounded-full relative transition-all duration-300 ${editingUser.disabled ? 'bg-rose-600' : 'bg-slate-300'}`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 shadow-sm ${editingUser.disabled ? (isRtl ? 'right-7' : 'left-7') : (isRtl ? 'right-1' : 'left-1')}`}></div>
              </button>
            </div>

            {/* LEAVE STATUS */}
            <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 space-y-4">
              <div className={`flex items-center justify-between ${isRtl ? 'flex-row-reverse' : ''}`}>
                <div className={`flex items-center gap-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${editingUser.isOnLeave ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-400'}`}>
                    <i className="fa-solid fa-plane-departure text-xs"></i>
                  </div>
                  <div className="text-start">
                    <p className="text-xs font-black text-slate-900 uppercase tracking-tight">{t('onLeaveStatus')}</p>
                    <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">{t('markAwaySub')}</p>
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={() => setEditingUser({ ...editingUser, isOnLeave: !editingUser.isOnLeave })}
                  className={`w-12 h-6 rounded-full relative transition-all duration-300 ${editingUser.isOnLeave ? 'bg-indigo-600' : 'bg-slate-300'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 shadow-md ${editingUser.isOnLeave ? (isRtl ? 'right-7' : 'left-7') : (isRtl ? 'right-1' : 'left-1')}`}></div>
                </button>
              </div>

              {editingUser.isOnLeave && (
                <div className="grid grid-cols-2 gap-3 animate-fadeIn">
                  <div>
                    <label className="block text-[8px] font-black text-indigo-600 uppercase tracking-widest mb-1.5 ml-1 text-start">{t('leaveStartDate')}</label>
                    <input 
                      type="date" 
                      value={editingUser.leaveStartDate || ''} 
                      onChange={(e) => setEditingUser({ ...editingUser, leaveStartDate: e.target.value })} 
                      className={`w-full px-3 py-2 bg-white border border-indigo-100 rounded-xl font-bold text-xs focus:ring-2 focus:ring-indigo-500 outline-none transition-all ${isRtl ? 'text-right' : 'text-left'}`} 
                    />
                  </div>
                  <div>
                    <label className="block text-[8px] font-black text-indigo-600 uppercase tracking-widest mb-1.5 ml-1 text-start">{t('leaveEndDate')}</label>
                    <input 
                      type="date" 
                      value={editingUser.leaveEndDate || ''} 
                      onChange={(e) => setEditingUser({ ...editingUser, leaveEndDate: e.target.value })} 
                      className={`w-full px-3 py-2 bg-white border border-indigo-100 rounded-xl font-bold text-xs focus:ring-2 focus:ring-indigo-500 outline-none transition-all ${isRtl ? 'text-right' : 'text-left'}`} 
                    />
                  </div>
                </div>
              )}
            </div>
          </div>


          {/* SECTION 4: WPS / MUDAD BANKING */}
          <div className="space-y-3">
            <h3 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest border-b border-emerald-50 pb-2 flex items-center gap-2 text-start">
              <i className="fa-solid fa-building-columns text-xs"></i>
              {t('wpsMudadBankingInfo')}
            </h3>
            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest -mt-2 text-start">{t('wpsSub')}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1 text-start">
                  {t('iqamaNationalId')} <span className="text-rose-400">({t('tenDigits')})</span>
                </label>
                <input
                  type="text"
                  maxLength={10}
                  value={editingUser.iqamaNumber || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, iqamaNumber: e.target.value.replace(/\D/g, '') })}
                  placeholder="1023456789"
                  className={`w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-xs focus:ring-2 focus:ring-emerald-500 outline-none transition-all ${isRtl ? 'text-right' : 'text-left'}`}
                />
              </div>
              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1 text-start">{t('bankShortCode')}</label>
                <select
                  value={editingUser.bankCode || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, bankCode: e.target.value })}
                  className={`w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs outline-none cursor-pointer focus:ring-2 focus:ring-emerald-500 transition-all ${isRtl ? 'text-right' : 'text-left'}`}
                >
                  <option value="">{t('selectBank')}</option>
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
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1 text-start">
                  {t('iban')} <span className="text-rose-400">({t('saCharsRequirement')})</span>
                </label>
                <input
                  type="text"
                  maxLength={24}
                  value={editingUser.ibanNumber || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, ibanNumber: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })}
                  placeholder="SA1234567890123456789012"
                  className={`w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-xs focus:ring-2 focus:ring-emerald-500 outline-none transition-all ${isRtl ? 'text-right' : 'text-left'}`}
                />
                {editingUser.ibanNumber && (editingUser.ibanNumber.length !== 24 || !editingUser.ibanNumber.startsWith('SA')) && (
                  <p className="text-[9px] font-black text-rose-500 uppercase tracking-widest ml-1 mt-1 text-start">⚠ {t('ibanWarning')}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1 text-start">{t('basicSalarySR')}</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editingUser.basicSalary ?? ''}
                  onChange={(e) => setEditingUser({ ...editingUser, basicSalary: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                  className={`w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-xs focus:ring-2 focus:ring-emerald-500 outline-none transition-all ${isRtl ? 'text-right' : 'text-left'}`}
                />
              </div>
              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1 text-start">{t('housingAllowanceSR')}</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editingUser.housingAllowance ?? ''}
                  onChange={(e) => setEditingUser({ ...editingUser, housingAllowance: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                  className={`w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-xs focus:ring-2 focus:ring-emerald-500 outline-none transition-all ${isRtl ? 'text-right' : 'text-left'}`}
                />
              </div>
              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1 text-start">{t('otherAllowancesSR')}</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editingUser.otherAllowances ?? ''}
                  onChange={(e) => setEditingUser({ ...editingUser, otherAllowances: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                  className={`w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-xs focus:ring-2 focus:ring-emerald-500 outline-none transition-all ${isRtl ? 'text-right' : 'text-left'}`}
                />
              </div>
            </div>

            {/* WPS preview row */}
            {(editingUser.iqamaNumber || editingUser.bankCode || editingUser.ibanNumber) && (
              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100 animate-fadeIn">
                <p className="text-[8px] font-black text-emerald-600 uppercase tracking-widest mb-1.5 text-start">{t('wpsFilePreview')}</p>
                <code className="text-[10px] font-mono text-emerald-900 break-all block text-start">
                  {editingUser.iqamaNumber || '??????????'},{editingUser.bankCode || '????'},{editingUser.ibanNumber || 'SA????????????????????????'},{(editingUser.basicSalary || 0).toFixed(2)},{(editingUser.housingAllowance || 0).toFixed(2)},{(editingUser.otherAllowances || 0).toFixed(2)},0.00,{((editingUser.basicSalary || 0) + (editingUser.housingAllowance || 0) + (editingUser.otherAllowances || 0)).toFixed(2)}
                </code>
              </div>
            )}
          </div>
        </div>

        {/* FOOTER - STICKY / FIXED */}
        <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-4 shrink-0">
          <button type="button" onClick={onClose} className="flex-1 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-100 transition-all">{t('cancel')}</button>
          <button type="button" onClick={handleSave} disabled={saving} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg hover:bg-indigo-700 transition-all disabled:opacity-50">
            {saving ? <i className="fa-solid fa-circle-notch fa-spin"></i> : (editingUser.id ? t('applyChangesBtn') : t('createStaffProfileBtn'))}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserEditModal;
