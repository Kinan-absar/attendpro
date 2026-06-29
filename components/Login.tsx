import React, { useState } from 'react';
import { dataService } from '../services/dataService';
import { User } from '../types';
import { useLanguage } from '../utils/LanguageContext';
import { LanguageSelector } from './LanguageSelector';

interface Props {
  onLogin: (user: User) => void;
}

const Login: React.FC<Props> = ({ onLogin }) => {
  const { t, isRtl } = useLanguage();
  
  // Navigation tabs: 'signin' | 'signup'
  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin');
  
  // Form fields
  const [companyId, setCompanyId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isNewCompany, setIsNewCompany] = useState(false);
  const [companyName, setCompanyName] = useState('');

  // States
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showFixModal, setShowFixModal] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const normalizedEmail = email.trim().toLowerCase();
    const cleanCompanyId = companyId.trim().toUpperCase();

    if (!cleanCompanyId) {
      setError(t('companyIdRequired'));
      setLoading(false);
      return;
    }

    try {
      if (activeTab === 'signin') {
        const user = await dataService.login(cleanCompanyId, normalizedEmail, password);
        if (user) {
          onLogin(user);
        }
      } else {
        // Sign Up Flow
        if (!name.trim()) {
          throw new Error(t('fullNameRequired'));
        }
        if (isNewCompany && !companyName.trim()) {
          throw new Error(t('companyNameRequired'));
        }

        const user = await dataService.signUp(
          cleanCompanyId,
          normalizedEmail,
          password,
          name,
          isNewCompany ? 'ADMIN' : 'Pending',
          isNewCompany ? 'Administration' : 'Pending',
          isNewCompany,
          isNewCompany ? companyName : undefined
        );
        if (user) {
          onLogin(user);
        }
      }
    } catch (err: any) {
      console.error("Authentication action failed:", err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError(t('incorrectCredentialsError'));
      } else if (err.code === 'auth/email-already-in-use') {
        setError(t('emailAlreadyInUseError'));
      } else if (err.code === 'auth/weak-password') {
        setError(t('weakPasswordError'));
      } else if (err.code === 'permission-denied' || err.message?.includes('permission')) {
        setError(t('firestorePermissionError'));
      } else {
        setError(err.message || t('unexpectedError'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-100 p-4 md:p-8 relative" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Floating Language Selection Widget in Top-Right Corner */}
      <div className={`absolute top-4 ${isRtl ? 'left-4' : 'right-4'} z-50`}>
        <LanguageSelector />
      </div>

      <div className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200 overflow-hidden transition-all duration-500 animate-fadeIn">
        
        {/* HEADER SECTION */}
        <div className="bg-indigo-600 p-8 text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full -ml-12 -mb-12"></div>
          
          <div className="w-14 h-14 bg-white rounded-3xl flex items-center justify-center text-indigo-600 mx-auto mb-3 shadow-xl shadow-indigo-900/20 relative z-10">
            <i className="fa-solid fa-clock text-xl"></i>
          </div>
          <h1 className="text-xl font-black text-white relative z-10 tracking-tight">Attendance Pro</h1>
          <p className="text-indigo-100 text-[9px] mt-0.5 font-bold uppercase tracking-[0.2em] opacity-80 relative z-10">
            Workforce Identity
          </p>
        </div>

        {/* TAB SELECTOR */}
        <div className="flex border-b border-slate-100">
          <button
            type="button"
            onClick={() => {
              setActiveTab('signin');
              setError('');
            }}
            className={`flex-1 py-4 text-xs font-black uppercase tracking-wider text-center border-b-2 transition-all ${
              activeTab === 'signin'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            {t('navLogin')}
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('signup');
              setError('');
            }}
            className={`flex-1 py-4 text-xs font-black uppercase tracking-wider text-center border-b-2 transition-all ${
              activeTab === 'signup'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            {t('navRegister')}
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-8 pb-6 space-y-5">
          {error && (
            <div className="p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl text-xs font-bold flex flex-col animate-fadeIn">
              <div className={`flex items-start ${isRtl ? 'flex-row-reverse' : ''}`}>
                <i className={`fa-solid fa-circle-exclamation ${isRtl ? 'ml-3' : 'mr-3'} mt-0.5 text-base flex-shrink-0`}></i>
                <span className="text-start">{error}</span>
              </div>
              {(error.includes('Permission') || error.includes('permission') || error.includes('رفض')) && (
                <button type="button" onClick={() => setShowFixModal(true)} className="mt-2 py-2 px-3 bg-rose-600 text-white rounded-lg text-[9px] uppercase font-black tracking-widest text-center hover:bg-rose-700 transition-all shadow-md">
                  <i className={`fa-solid fa-screwdriver-wrench ${isRtl ? 'ml-2' : 'mr-2'}`}></i>
                  {t('fixDatabaseRulesBtn')}
                </button>
              )}
            </div>
          )}

          <div className="space-y-4">
            {/* COMPANY ID (Required for both sign-in and sign-up) */}
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1 text-start">{t('companyIdLabel')}</label>
              <div className="relative group">
                <i className={`fa-solid fa-building absolute ${isRtl ? 'right-5' : 'left-5'} top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors`}></i>
                <input
                  type="text"
                  required
                  className={`w-full ${isRtl ? 'pr-12 pl-5' : 'pl-12 pr-5'} py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold text-slate-700 uppercase ${isRtl ? 'text-right' : 'text-left'}`}
                  placeholder={activeTab === 'signup' && isNewCompany ? t('chooseCompanyCode') : t('enterCompanyCode')}
                  value={companyId}
                  onChange={e => setCompanyId(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                />
              </div>
              <p className="mt-1.5 text-[9px] font-black text-indigo-500 uppercase tracking-wide ml-1 leading-normal text-start">
                {activeTab === 'signin' && t('loginInfoSub')}
                {activeTab === 'signup' && isNewCompany && t('registerNewCompanySub')}
                {activeTab === 'signup' && !isNewCompany && t('joinExistingCompanySub')}
              </p>
            </div>

            {/* SIGN UP EXTRAS */}
            {activeTab === 'signup' && (
              <>
                {/* Mode Selector for Sign Up */}
                <div className="p-1 bg-slate-100 rounded-xl flex">
                  <button
                    type="button"
                    onClick={() => setIsNewCompany(false)}
                    className={`flex-1 py-2 text-[10px] font-bold rounded-lg transition-all ${
                      !isNewCompany ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400'
                    }`}
                  >
                    {t('joinExistingCompany')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsNewCompany(true)}
                    className={`flex-1 py-2 text-[10px] font-bold rounded-lg transition-all ${
                      isNewCompany ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400'
                    }`}
                  >
                    {t('registerNewCompany')}
                  </button>
                </div>

                {/* Company Name (only if Register New Company) */}
                {isNewCompany && (
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1 text-start">{t('companyNameLabel')}</label>
                    <div className="relative group">
                      <i className={`fa-solid fa-signature absolute ${isRtl ? 'right-5' : 'left-5'} top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors`}></i>
                      <input
                        type="text"
                        required={isNewCompany}
                        className={`w-full ${isRtl ? 'pr-12 pl-5' : 'pl-12 pr-5'} py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold text-slate-700 ${isRtl ? 'text-right' : 'text-left'}`}
                        placeholder={t('enterCompanyName')}
                        value={companyName}
                        onChange={e => setCompanyName(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                {/* Full Name */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1 text-start">{t('fullNameLabel')}</label>
                  <div className="relative group">
                    <i className={`fa-solid fa-user absolute ${isRtl ? 'right-5' : 'left-5'} top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors`}></i>
                    <input
                      type="text"
                      required
                      className={`w-full ${isRtl ? 'pr-12 pl-5' : 'pl-12 pr-5'} py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold text-slate-700 ${isRtl ? 'text-right' : 'text-left'}`}
                      placeholder={t('enterFullName')}
                      value={name}
                      onChange={e => setName(e.target.value)}
                    />
                  </div>
                </div>
              </>
            )}

            {/* EMAIL */}
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1 text-start">{t('emailLabel')}</label>
              <div className="relative group">
                <i className={`fa-solid fa-envelope absolute ${isRtl ? 'right-5' : 'left-5'} top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors`}></i>
                <input
                  type="email"
                  required
                  className={`w-full ${isRtl ? 'pr-12 pl-5' : 'pl-12 pr-5'} py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold text-slate-700 ${isRtl ? 'text-right' : 'text-left'}`}
                  placeholder="name@company.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>
            </div>

            {/* PASSWORD / SECURITY KEY */}
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1 text-start">
                {t('securityKeyPassword')}
              </label>
              <div className="relative group">
                <i className={`fa-solid fa-lock absolute ${isRtl ? 'right-5' : 'left-5'} top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors`}></i>
                <input
                  type="password"
                  required
                  className={`w-full ${isRtl ? 'pr-12 pl-5' : 'pl-12 pr-5'} py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold text-slate-700 ${isRtl ? 'text-right' : 'text-left'}`}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white font-black py-4 rounded-2xl hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 active:scale-[0.98] disabled:opacity-50 mt-4 text-xs uppercase tracking-wider"
          >
            {loading ? (
              <i className="fa-solid fa-circle-notch fa-spin"></i>
            ) : activeTab === 'signin' ? (
              t('signInBtn')
            ) : (
              t('signUpBtn')
            )}
          </button>

          {/* CORPORATE BRANDING FOOTER */}
          <div className="pt-6 text-center border-t border-slate-50">
            <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">
              Smart Attendance Cloud System
            </p>
          </div>
        </form>
      </div>

      {/* PWA INSTRUCTIONS */}
      <div className="mt-8 px-4 text-center max-w-sm animate-fadeIn">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
          {t('pwaNotice')}
        </p>
      </div>

      {showFixModal && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-xl z-[500] flex items-center justify-center p-6" dir={isRtl ? 'rtl' : 'ltr'}>
          <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-2xl w-full overflow-hidden animate-fadeIn">
            <div className="bg-rose-600 p-8 text-white flex justify-between items-center">
              <div className="text-start">
                <h2 className="text-xl font-black flex items-center gap-3">
                  <i className="fa-solid fa-shield-halved"></i>
                  {t('permissionFixTitle')}
                </h2>
                <p className="text-xs text-rose-100 uppercase tracking-widest font-bold mt-1">{t('databaseAccessSub')}</p>
              </div>
              <button onClick={() => setShowFixModal(false)} className="text-rose-200 hover:text-white transition-colors">
                <i className="fa-solid fa-circle-xmark text-2xl"></i>
              </button>
            </div>
            <div className="p-8 space-y-6">
              <pre className="bg-slate-50 p-6 rounded-2xl border border-slate-200 text-[10px] font-mono text-slate-600 overflow-x-auto select-all max-h-[250px] leading-relaxed text-left" dir="ltr">
                {dataService.getRecommendedRules()}
              </pre>
              <div className={`flex justify-end pt-4 border-t border-slate-100 ${isRtl ? 'flex-row-reverse' : ''}`}>
                <button onClick={() => setShowFixModal(false)} className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg">
                  {t('publishedRulesBtn')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
