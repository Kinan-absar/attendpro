import React, { useState } from 'react';
import { User } from '../types';
import { dataService } from '../services/dataService';
import { useLanguage } from '../utils/LanguageContext';
import { useDialog } from '../utils/DialogContext';

interface Props {
  user: User;
  onRefreshUser: () => void;
}

const Settings: React.FC<Props> = ({ user, onRefreshUser }) => {
  const { t, isRtl } = useLanguage();
  const { showAlert, showConfirm } = useDialog();
  
  const [name, setName] = useState(user.name || '');
  const [department] = useState(user.department || 'Operations');
  const [avatar, setAvatar] = useState(user.avatar || '');
  
  // Banking information
  const [iqamaNumber, setIqamaNumber] = useState(user.iqamaNumber || '');
  const [bankCode, setBankCode] = useState(user.bankCode || '');
  const [ibanNumber, setIbanNumber] = useState(user.ibanNumber || '');

  // Password fields
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Company details (Admin only)
  const [companyId, setCompanyId] = useState(user.companyId || '');
  const [companyName, setCompanyName] = useState(user.company || '');
  const [savingCompany, setSavingCompany] = useState(false);
  const [companyMessage, setCompanyMessage] = useState<{ text: string; isError: boolean } | null>(null);

  // Multi-company switching (Admin only)
  const [linkCompanyId, setLinkCompanyId] = useState('');
  const [linkingCompany, setLinkingCompany] = useState(false);
  const [linkMessage, setLinkMessage] = useState<{ text: string; isError: boolean } | null>(null);

  const handleLinkCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setLinkMessage(null);
    const cid = linkCompanyId.trim().toUpperCase();
    if (!cid) return;

    setLinkingCompany(true);
    try {
      await dataService.linkAdditionalCompany(cid);
      setLinkMessage({ text: `Successfully linked Company ID "${cid}"! You can now switch to it instantly.`, isError: false });
      setLinkCompanyId('');
      onRefreshUser();
    } catch (err: any) {
      console.error(err);
      setLinkMessage({ text: err.message || 'Failed to link company.', isError: true });
    } finally {
      setLinkingCompany(false);
    }
  };

  const handleSwitchCompanyContext = async (cid: string) => {
    try {
      await dataService.switchActiveCompany(cid);
      onRefreshUser();
    } catch (err: any) {
      await showAlert(err.message || 'Failed to switch company context.', t('error'), 'error');
    }
  };

  const handleUnlinkCompany = async (cid: string) => {
    const isConfirmed = await showConfirm(t('unlinkConfirm') || "Are you sure you want to unlink this company?", t('warning'), 'warning');
    if (!isConfirmed) return;
    try {
      await dataService.unlinkCompany(cid);
      onRefreshUser();
    } catch (err: any) {
      await showAlert(err.message || 'Failed to unlink company.', t('error'), 'error');
    }
  };

  // UI state
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<{ text: string; isError: boolean } | null>(null);

  // System resetting state
  const [resetting, setResetting] = useState(false);

  const handleSystemReset = async () => {
    const confirm1 = await showConfirm(
      "⚠️ CRITICAL SYSTEM RESET WARNING ⚠️\n\n" +
      "Are you absolutely sure you want to delete all data and start fresh?\n\n" +
      "This action will permanently delete:\n" +
      "• All attendance logs and punch histories\n" +
      "• All registered employee/staff accounts (except yours)\n" +
      "• All active worksites and geofencing limits\n" +
      "• All holidays and announcements\n" +
      "• All payroll adjustments\n\n" +
      "This action IS IRREVERSIBLE. Press OK to verify.",
      "SYSTEM PURGE",
      "error"
    );
    if (!confirm1) return;

    const confirm2 = await showConfirm(
      "FINAL CONFIRMATION:\n\n" +
      "Are you 100% sure? All users and history will be permanently deleted and the app will reload fresh.\n\n" +
      "Click OK to execute the purge.",
      "EXECUTE PURGE",
      "error"
    );
    if (!confirm2) return;

    setResetting(true);
    try {
      await dataService.resetAllSystemData();
      await showAlert("Database Reset Complete! All records have been successfully purged, and your settings have been restored to default. Your admin account is fully retained.", "SUCCESS", "success");
      window.location.reload();
    } catch (err: any) {
      console.error(err);
      await showAlert("Database Purge Failed: " + (err.message || err), "ERROR", "error");
    } finally {
      setResetting(false);
    }
  };

  // Suggested preset avatars list
  const presetAvatars = [
    `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=random`,
    `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name || 'User')}`,
    `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(name || 'User')}`,
    `https://api.dicebear.com/7.x/pixel-art/svg?seed=${encodeURIComponent(name || 'User')}`
  ];

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMessage(null);
    
    if (!name.trim()) {
      setProfileMessage({ text: 'Full Name is required.', isError: true });
      return;
    }

    setSavingProfile(true);
    try {
      await dataService.updateOwnProfile(user.id, {
        name,
        department,
        avatar,
        iqamaNumber,
        bankCode,
        ibanNumber
      });
      setProfileMessage({ text: 'Your profile has been updated successfully!', isError: false });
      onRefreshUser();
    } catch (err: any) {
      console.error(err);
      setProfileMessage({ text: err.message || 'Failed to update profile details.', isError: true });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage(null);

    if (!newPassword) {
      setPasswordMessage({ text: 'Please enter a new security key (password).', isError: true });
      return;
    }

    if (newPassword.length < 6) {
      setPasswordMessage({ text: 'Security key must be at least 6 characters.', isError: true });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMessage({ text: 'Passwords do not match.', isError: true });
      return;
    }

    setSavingPassword(true);
    try {
      await dataService.changeOwnPassword(newPassword);
      setPasswordMessage({ text: 'Your security key has been updated successfully!', isError: false });
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      console.error(err);
      setPasswordMessage({ text: err.message || 'Failed to update security key. You may need to log out and log in again to perform this sensitive action.', isError: true });
    } finally {
      setSavingPassword(false);
    }
  };

  const handleUpdateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setCompanyMessage(null);

    const newId = companyId.trim().toUpperCase();
    const newName = companyName.trim();

    if (!newId) {
      setCompanyMessage({ text: 'Company ID cannot be empty.', isError: true });
      return;
    }
    if (!newName) {
      setCompanyMessage({ text: 'Company Name cannot be empty.', isError: true });
      return;
    }

    setSavingCompany(true);
    try {
      await dataService.updateCompanyDetails(user.companyId || '', newId, newName);
      setCompanyMessage({ text: 'Company details and all linked records updated successfully!', isError: false });
      onRefreshUser();
    } catch (err: any) {
      console.error(err);
      setCompanyMessage({ text: err.message || 'Failed to update company details.', isError: true });
    } finally {
      setSavingCompany(false);
    }
  };

  return (
    <div className="space-y-8 pb-10">
      {/* HEADER SECTION */}
      <div className={`bg-white p-8 rounded-[2.5rem] border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 animate-fadeIn ${isRtl ? 'md:flex-row-reverse text-right' : 'text-left'}`}>
        <div className="text-start">
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">{t('settingsHeader')}</h1>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">{t('settingsSub')}</p>
        </div>
        <div className={`px-6 py-4 bg-indigo-50/60 rounded-3xl border border-indigo-100/50 flex items-center gap-4 self-start md:self-auto ${isRtl ? 'flex-row-reverse' : ''}`}>
          <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white">
            <i className="fa-solid fa-building text-lg"></i>
          </div>
          <div className="text-start">
            <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">{t('activeCompany') || "Active Company"}</p>
            <p className="text-sm font-black text-slate-800 tracking-tight">{user.company || 'Absar Alomran Co.'}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('companyIdFieldLabel') || "Company ID:"} <span className="font-black text-indigo-600 select-all bg-indigo-100/50 px-1.5 py-0.5 rounded">{user.companyId || 'ABSAR'}</span></p>
          </div>
        </div>
      </div>

      {/* EDIT GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* LEFT AVATAR SELECTION PANEL */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200/80 shadow-sm space-y-6">
          <div className="flex flex-col items-center text-center space-y-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest w-full text-start ml-1">{t('profilePhotoLabel') || "Profile Photo"}</p>
            <div className="relative group">
              <img 
                src={avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}`} 
                className="w-32 h-32 rounded-[2.5rem] object-cover border-4 border-slate-50 shadow-md transition-transform group-hover:scale-105 duration-300"
                alt="Profile avatar" 
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-black/40 rounded-[2.5rem] opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer duration-300">
                <i className="fa-solid fa-camera text-white text-xl"></i>
              </div>
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-800 tracking-tight">{user.name}</h2>
              <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mt-0.5">{user.role === 'admin' ? t('admin') : t('employee')}</p>
              <p className="text-xs font-bold font-mono text-slate-400 mt-1 select-all">{user.email}</p>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-5 space-y-3">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-start ml-1">{t('selectPresetAvatar') || "Select Preset Avatar"}</p>
            <div className="grid grid-cols-4 gap-3">
              {presetAvatars.map((url, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setAvatar(url)}
                  className={`relative p-1 rounded-2xl border transition-all duration-300 hover:scale-110 overflow-hidden ${
                    avatar === url ? 'border-indigo-600 bg-indigo-50/50 shadow-md shadow-indigo-100' : 'border-slate-100 hover:border-slate-200 bg-slate-50'
                  }`}
                >
                  <img src={url} className="w-full h-10 rounded-xl object-contain" alt={`preset-${i}`} referrerPolicy="no-referrer" />
                  {avatar === url && (
                    <div className="absolute top-0 right-0 w-3.5 h-3.5 bg-indigo-600 text-white flex items-center justify-center rounded-bl-lg text-[7px]">
                      <i className="fa-solid fa-check"></i>
                    </div>
                  )}
                </button>
              ))}
            </div>

            <div className="pt-3">
              <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1 text-start">{t('customPhotoUrl') || "Custom Photo URL"}</label>
              <input 
                type="url" 
                placeholder="https://example.com/avatar.jpg"
                value={avatar.startsWith('http') && !presetAvatars.includes(avatar) ? avatar : ''}
                onChange={(e) => setAvatar(e.target.value)}
                className={`w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-slate-700 ${isRtl ? 'text-right' : 'text-left'}`}
              />
            </div>
          </div>
        </div>

        {/* RIGHT EDIT SECTIONS COLUMN */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* PROFILE FORM */}
          <form onSubmit={handleUpdateProfile} className={`bg-white p-8 rounded-[2.5rem] border border-slate-200/80 shadow-sm space-y-6 ${isRtl ? 'text-right' : 'text-left'}`}>
            <h2 className={`text-xl font-black text-slate-900 tracking-tight flex items-center gap-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
              <i className="fa-solid fa-circle-user text-indigo-600"></i>
              {t('personalInfoTitle')}
            </h2>

            {profileMessage && (
              <div className={`p-4 rounded-2xl border text-xs font-bold flex items-center gap-3 animate-fadeIn ${isRtl ? 'flex-row-reverse' : ''} ${
                profileMessage.isError ? 'bg-rose-50 border-rose-100 text-rose-600' : 'bg-emerald-50 border-emerald-100 text-emerald-600'
              }`}>
                <i className={`fa-solid ${profileMessage.isError ? 'fa-circle-exclamation' : 'fa-circle-check'} text-base`}></i>
                <span>{profileMessage.text}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1 text-start">{t('fullNameLabel')}</label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  className={`w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-slate-700 ${isRtl ? 'text-right' : 'text-left'}`} 
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1 text-start">{t('deptLabel')}</label>
                <input 
                  type="text" 
                  value={department} 
                  readOnly 
                  disabled 
                  className={`w-full px-5 py-3.5 bg-slate-100 border border-slate-200 rounded-2xl font-bold text-slate-500 cursor-not-allowed outline-none select-none ${isRtl ? 'text-right' : 'text-left'}`} 
                />
              </div>
            </div>

            {/* Saudi WPS Banking details (for normal employees as well) */}
            <div className="border-t border-slate-100 pt-6 space-y-4">
              <h3 className={`text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                <i className="fa-solid fa-building-columns"></i>
                {t('saudiWpsMudadBankingDetails') || "Saudi WPS / Mudad Banking Details"}
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1 text-start">{t('iqamaLabel') || "National ID / Iqama (10 digits)"}</label>
                  <input
                    type="text"
                    maxLength={10}
                    value={iqamaNumber}
                    onChange={(e) => setIqamaNumber(e.target.value.replace(/\D/g, ''))}
                    placeholder="e.g. 1023456789"
                    className={`w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-mono font-bold focus:ring-2 focus:ring-emerald-500 outline-none transition-all ${isRtl ? 'text-right' : 'text-left'}`}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1 text-start">{t('bankCodeLabel') || "Bank Code"}</label>
                  <select
                    value={bankCode}
                    onChange={(e) => setBankCode(e.target.value)}
                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none cursor-pointer focus:ring-2 focus:ring-emerald-500 transition-all text-slate-700"
                  >
                    <option value="">{t('selectBank') || "— Select Bank —"}</option>
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
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1 text-start">{t('ibanLabel') || "IBAN Number (24 chars starting with SA)"}</label>
                  <input
                    type="text"
                    maxLength={24}
                    value={ibanNumber}
                    onChange={(e) => setIbanNumber(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                    placeholder="e.g. SA1234567890123456789012"
                    className={`w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-mono font-bold focus:ring-2 focus:ring-emerald-500 outline-none transition-all ${isRtl ? 'text-right' : 'text-left'}`}
                  />
                </div>
              </div>
            </div>

            <div className={`flex justify-end border-t border-slate-100 pt-5 ${isRtl ? 'flex-row-reverse' : ''}`}>
              <button
                type="submit"
                disabled={savingProfile}
                className={`px-8 py-3.5 bg-indigo-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 disabled:opacity-50 flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}
              >
                {savingProfile ? (
                  <>
                    <i className="fa-solid fa-circle-notch fa-spin"></i>
                    {t('loading')}
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-circle-check"></i>
                    {t('saveProfileBtn')}
                  </>
                )}
              </button>
            </div>
          </form>

          {/* COMPANY SETTINGS FORM (Admin Only) */}
          {user.role === 'admin' && (
            <form onSubmit={handleUpdateCompany} className={`bg-white p-8 rounded-[2.5rem] border border-slate-200/80 shadow-sm space-y-6 animate-fadeIn ${isRtl ? 'text-right' : 'text-left'}`}>
              <h2 className={`text-xl font-black text-slate-900 tracking-tight flex items-center gap-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
                <i className="fa-solid fa-building text-indigo-600"></i>
                {t('companyProfileTitle')}
              </h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest -mt-4 ml-1 text-start">
                {t('companyProfileSub')}
              </p>

              {companyMessage && (
                <div className={`p-4 rounded-2xl border text-xs font-bold flex items-center gap-3 animate-fadeIn ${isRtl ? 'flex-row-reverse' : ''} ${
                  companyMessage.isError ? 'bg-rose-50 border-rose-100 text-rose-600' : 'bg-emerald-50 border-emerald-100 text-emerald-600'
                }`}>
                  <i className={`fa-solid ${companyMessage.isError ? 'fa-circle-exclamation' : 'fa-circle-check'} text-base`}></i>
                  <span>{companyMessage.text}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1 text-start">{t('companyDisplayName')}</label>
                  <input 
                    type="text" 
                    value={companyName} 
                    onChange={(e) => setCompanyName(e.target.value)} 
                    className={`w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-slate-700 ${isRtl ? 'text-right' : 'text-left'}`} 
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1 text-start">{t('companyRegId')}</label>
                  <input 
                    type="text" 
                    value={companyId} 
                    onChange={(e) => setCompanyId(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} 
                    className={`w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold font-mono focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-slate-700 ${isRtl ? 'text-right' : 'text-left'}`} 
                  />
                  <p className="text-[9px] text-slate-400 mt-1.5 ml-1 leading-relaxed text-start">
                    <span className="font-bold text-amber-500">{t('warning')}:</span> {t('companyWarning')}
                  </p>
                </div>
              </div>

              <div className={`flex justify-end border-t border-slate-100 pt-5 ${isRtl ? 'flex-row-reverse' : ''}`}>
                <button
                  type="submit"
                  disabled={savingCompany}
                  className={`px-8 py-3.5 bg-indigo-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 disabled:opacity-50 flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}
                >
                  {savingCompany ? (
                    <>
                      <i className="fa-solid fa-circle-notch fa-spin"></i>
                      {t('savingCompany')}
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-floppy-disk"></i>
                      {t('saveCompanyBtn')}
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* MULTI-COMPANY MANAGER (Admin Only) */}
          {user.role === 'admin' && (
            <div className={`bg-white p-8 rounded-[2.5rem] border border-slate-200/80 shadow-sm space-y-6 animate-fadeIn ${isRtl ? 'text-right' : 'text-left'}`}>
              <h2 className={`text-xl font-black text-slate-900 tracking-tight flex items-center gap-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
                <i className="fa-solid fa-arrows-spin text-emerald-600"></i>
                {t('multiCompanyTitle') || "Multi-Company switching"}
              </h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest -mt-4 ml-1 text-start">
                {t('multiCompanySub') || "Switch between multiple registered companies instantly, or link additional company accounts to manage."}
              </p>

              {/* Company list / Context switch */}
              <div className="space-y-3">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1 text-start">{t('linkedCompanies') || "Your Linked Companies"}</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Active Company */}
                  <div className="p-4 bg-emerald-50/60 border border-emerald-100/80 rounded-2xl flex items-center justify-between">
                    <div className="text-start">
                      <span className="inline-flex px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-[8px] font-black rounded uppercase tracking-widest mb-1">{t('activeContext') || "Active Context"}</span>
                      <p className="font-bold text-xs text-slate-800">{user.company || 'Main Company'}</p>
                      <p className="text-[10px] font-mono font-bold text-slate-400 mt-0.5">{user.companyId}</p>
                    </div>
                    <span className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                      <i className="fa-solid fa-check"></i>
                    </span>
                  </div>

                  {/* Linked inactive companies */}
                  {(user.allowedCompanies || []).filter(cid => cid !== user.companyId).map(cid => (
                    <div
                      key={cid}
                      className="p-4 bg-slate-50/80 hover:bg-slate-100/80 border border-slate-200/50 hover:border-slate-300 rounded-2xl flex items-center justify-between group transition-all"
                    >
                      <button
                        type="button"
                        onClick={() => handleSwitchCompanyContext(cid)}
                        className="flex-1 text-start outline-none"
                      >
                        <span className="inline-flex px-1.5 py-0.5 bg-slate-200 text-slate-600 text-[8px] font-black rounded uppercase tracking-widest mb-1">{t('clickToSwitch')}</span>
                        <p className="font-bold text-xs text-slate-800">{cid}</p>
                      </button>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleSwitchCompanyContext(cid)}
                          title={t('clickToSwitch')}
                          className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-indigo-50 flex items-center justify-center text-slate-400 hover:text-indigo-600 transition-all"
                        >
                          <i className="fa-solid fa-right-left text-xs"></i>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUnlinkCompany(cid)}
                          title={t('unlinkBtn')}
                          className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-rose-50 flex items-center justify-center text-slate-400 hover:text-rose-600 transition-all"
                        >
                          <i className="fa-solid fa-link-slash text-xs"></i>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Form to link a new company */}
              <form onSubmit={handleLinkCompany} className="border-t border-slate-100 pt-6 space-y-4">
                <h3 className={`text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-2`}>
                  <i className="fa-solid fa-circle-plus"></i>
                  {t('linkAnotherCompany')}
                </h3>

                {linkMessage && (
                  <div className={`p-4 rounded-2xl border text-xs font-bold flex items-center gap-3 animate-fadeIn ${
                    linkMessage.isError ? 'bg-rose-50 border-rose-100 text-rose-600' : 'bg-emerald-50 border-emerald-100 text-emerald-600'
                  }`}>
                    <i className={`fa-solid ${linkMessage.isError ? 'fa-circle-exclamation' : 'fa-circle-check'} text-base`}></i>
                    <span>{linkMessage.text}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1 text-start">{t('companyIdFieldLinkLabel')}</label>
                    <input
                      type="text"
                      placeholder="e.g. COMPANY2"
                      value={linkCompanyId}
                      onChange={(e) => setLinkCompanyId(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                      className={`w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold font-mono text-xs focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-slate-700 ${isRtl ? 'text-right' : 'text-left'}`}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={linkingCompany || !linkCompanyId.trim()}
                    className={`w-full px-6 py-3.5 bg-indigo-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 disabled:opacity-40 flex items-center justify-center gap-2`}
                  >
                    {linkingCompany ? (
                      <>
                        <i className="fa-solid fa-circle-notch fa-spin"></i>
                        {t('linking')}
                      </>
                    ) : (
                      <>
                        <i className="fa-solid fa-link"></i>
                        {t('linkBtn')}
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* PASSWORD RESET FORM */}
          <form onSubmit={handleUpdatePassword} className={`bg-white p-8 rounded-[2.5rem] border border-slate-200/80 shadow-sm space-y-6 ${isRtl ? 'text-right' : 'text-left'}`}>
            <h2 className={`text-xl font-black text-slate-900 tracking-tight flex items-center gap-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
              <i className="fa-solid fa-shield-halved text-rose-500"></i>
              {t('passResetTitle')}
            </h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest -mt-4 ml-1 text-start">{t('passResetSub')}</p>

            {passwordMessage && (
              <div className={`p-4 rounded-2xl border text-xs font-bold flex items-center gap-3 animate-fadeIn ${isRtl ? 'flex-row-reverse' : ''} ${
                passwordMessage.isError ? 'bg-rose-50 border-rose-100 text-rose-600' : 'bg-emerald-50 border-emerald-100 text-emerald-600'
              }`}>
                <i className={`fa-solid ${passwordMessage.isError ? 'fa-circle-exclamation' : 'fa-circle-check'} text-base`}></i>
                <span>{passwordMessage.text}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1 text-start">{t('newPassLabel')}</label>
                <input 
                  type="password" 
                  placeholder="Min. 6 characters"
                  value={newPassword} 
                  onChange={(e) => setNewPassword(e.target.value)} 
                  className={`w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:ring-2 focus:ring-rose-500 outline-none transition-all ${isRtl ? 'text-right' : 'text-left'}`} 
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1 text-start">{t('confirmPassLabel')}</label>
                <input 
                  type="password" 
                  placeholder="Repeat new password"
                  value={confirmPassword} 
                  onChange={(e) => setConfirmPassword(e.target.value)} 
                  className={`w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:ring-2 focus:ring-rose-500 outline-none transition-all ${isRtl ? 'text-right' : 'text-left'}`} 
                />
              </div>
            </div>

            <div className={`flex justify-end border-t border-slate-100 pt-5 ${isRtl ? 'flex-row-reverse' : ''}`}>
              <button
                type="submit"
                disabled={savingPassword}
                className={`px-8 py-3.5 bg-rose-500 text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-rose-600 transition-all shadow-xl shadow-rose-100 disabled:opacity-50 flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}
              >
                {savingPassword ? (
                  <>
                    <i className="fa-solid fa-circle-notch fa-spin"></i>
                    {t('savingPass')}
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-key"></i>
                    {t('savePassBtn')}
                  </>
                )}
              </button>
            </div>
          </form>

        </div>

      </div>

      {/* 🚨 DANGER ZONE (Admin Only) */}
      {user.role === 'admin' && (
        <div className={`mt-8 p-8 bg-rose-50/40 border border-rose-100 rounded-[2.5rem] space-y-6 ${isRtl ? 'text-right' : 'text-left'}`}>
          <div>
            <h2 className={`text-xl font-black text-rose-950 tracking-tight flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
              <i className="fa-solid fa-triangle-exclamation text-rose-600"></i>
              {t('dangerZoneTitle')}
            </h2>
            <p className="text-rose-700/80 text-xs font-semibold mt-1 text-start">
              {t('dangerZoneSub')}
            </p>
          </div>

          <div className={`flex flex-col md:flex-row md:items-center justify-between p-6 bg-white border border-rose-100 rounded-2xl gap-4 shadow-sm ${isRtl ? 'md:flex-row-reverse' : ''}`}>
            <div className="space-y-1 text-start">
              <h3 className="font-bold text-slate-950 text-sm">{t('resetSystemTitle')}</h3>
              <p className="text-slate-500 text-xs max-w-xl leading-relaxed">
                {t('resetSystemSub')}
              </p>
            </div>
            <button
              onClick={handleSystemReset}
              disabled={resetting}
              className="px-6 py-3 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-lg shadow-rose-100 transition-all flex-shrink-0 disabled:opacity-50"
            >
              {resetting ? (
                <span className={`flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                  <i className="fa-solid fa-circle-notch fa-spin"></i>
                  {t('resettingText')}
                </span>
              ) : (
                t('resetDbBtn')
              )}
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default Settings;
