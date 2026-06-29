
import React, { useState, useEffect, useCallback, useRef } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { dataService } from './services/dataService';
import { AttendanceRecord, User } from './types';
import Dashboard from './components/Dashboard';
import History from './components/History';
import AdminReports from './components/AdminReports';
import Login from './components/Login';
import ActiveEmployees from './components/ActiveEmployees';
import AdminLocationSettings from './components/AdminLocationSettings';
import AdminUserManagement from './components/AdminUserManagement';
import AdminShiftManagement from './components/AdminShiftManagement';
import AdminBroadcastManagement from './components/AdminBroadcastManagement';
import AdminLogExport from './components/AdminLogExport';
import Settings from './components/Settings';
import { useLanguage } from './utils/LanguageContext';
import { LanguageSelector } from './components/LanguageSelector';
import { useDialog } from './utils/DialogContext';

const { HashRouter, Routes, Route, Link, useLocation, Navigate } = ReactRouterDOM as any;

const Navigation = ({ user, onLogout, onRefreshUser }: { user: User; onLogout: () => void; onRefreshUser?: () => void }) => {
  const location = useLocation();
  const navRef = useRef<HTMLDivElement>(null);
  const { t, isRtl } = useLanguage();
  const { showAlert } = useDialog();

  const handleCompanySwitch = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const cid = e.target.value;
    if (!cid || cid === user.companyId) return;
    try {
      await dataService.switchActiveCompany(cid);
      if (onRefreshUser) onRefreshUser();
    } catch (err: any) {
      await showAlert(err.message || 'Failed to switch company', t('error'), 'error');
    }
  };

  const links = [
    { path: '/', label: t('navHome'), icon: 'fa-house' },
    { path: '/history', label: t('navMyLogs'), icon: 'fa-list' },
  ];

  if (user.role === 'admin') {
    links.push({ path: '/admin', label: t('navReports'), icon: 'fa-chart-pie' });
    links.push({ path: '/admin/logs-export', label: t('navLogExport'), icon: 'fa-file-export' });
    links.push({ path: '/admin/active', label: t('navActive'), icon: 'fa-user-clock' });
    links.push({ path: '/admin/broadcasts', label: t('navNotices'), icon: 'fa-bullhorn' });
    links.push({ path: '/admin/users', label: t('navStaff'), icon: 'fa-users-gear' });
    links.push({ path: '/admin/shifts', label: t('navSchedules'), icon: 'fa-calendar-day' });
    links.push({ path: '/admin/location', label: t('navWorksite'), icon: 'fa-location-dot' });
  }

  // Settings is always the very last tab
  links.push({ path: '/settings', label: t('navSettings'), icon: 'fa-gears' });

  return (
    <>
      {/* Mobile Top Bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-white/95 backdrop-blur-md border-b border-slate-200 z-[90] flex items-center justify-between px-4 print:hidden shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-md">
            <i className="fa-solid fa-clock text-sm"></i>
          </div>
          <span className="font-black text-lg tracking-tighter text-slate-900">AttendancePro</span>
        </div>
        <LanguageSelector />
      </div>

      <nav className={`fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 z-[100] md:top-0 md:bottom-auto md:flex-col md:w-64 md:h-screen md:border-t-0 md:justify-start md:py-8 md:z-50 print:hidden shadow-[0_-4px_20px_rgba(0,0,0,0.05)] md:shadow-none pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] flex ${
        isRtl 
          ? 'md:right-0 md:left-auto md:border-l' 
          : 'md:left-0 md:right-auto md:border-r'
      }`}>
        <div className="hidden md:flex flex-col px-6 mb-6 flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
                <i className="fa-solid fa-clock text-lg"></i>
              </div>
              <span className="font-black text-xl tracking-tighter text-slate-900">AttendancePro</span>
            </div>
          </div>
          <div className="mb-4">
            <LanguageSelector />
          </div>
          <div className="p-4 bg-slate-50 rounded-[1.5rem] border border-slate-100 flex items-center gap-3">
            <img src={user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}`} className="w-9 h-9 rounded-full border-2 border-white shadow-sm object-cover" alt="U" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black text-slate-900 truncate">{user.name || 'User'}</p>
              <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">{user.role === 'admin' ? t('admin') : t('employee')}</p>
            </div>
          </div>
          {user.role === 'admin' && (
            <div className="mt-3 px-1 text-start">
              <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">{t('activeCompany') || "Active Company"}</label>
              <select
                value={user.companyId || 'ABSAR'}
                onChange={handleCompanySwitch}
                className="w-full px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl font-bold text-xs text-slate-700 outline-none cursor-pointer transition-all"
              >
                <option value={user.companyId}>{user.company || user.companyId}</option>
                {(user.allowedCompanies || []).filter(c => c !== user.companyId).map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div 
          ref={navRef}
          className="flex flex-row md:flex-col overflow-x-auto overflow-y-hidden md:overflow-y-auto md:overflow-x-hidden md:flex-1 no-scrollbar flex-nowrap items-center md:items-stretch px-2 md:px-3 py-1 md:py-0 w-full"
          style={{ WebkitOverflowScrolling: 'touch', justifyContent: 'flex-start' }}
        >
          {links.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className={`flex flex-col md:flex-row items-center justify-center md:justify-start space-y-1 md:space-y-0 md:gap-4 px-4 py-2.5 md:px-5 md:py-3.5 rounded-2xl transition-all duration-300 flex-shrink-0 md:flex-shrink-1 min-w-[80px] md:min-w-0 md:w-full ${
                location.pathname === link.path ? 'text-indigo-600 md:bg-indigo-50/80 font-bold scale-105 md:scale-100' : 'text-slate-400 hover:text-indigo-600 hover:bg-slate-50'
              }`}
            >
              <i className={`fa-solid ${link.icon} text-lg md:text-xl`}></i>
              <span className="text-[10px] md:text-[15px] font-bold md:font-semibold whitespace-nowrap tracking-tight">{link.label}</span>
            </Link>
          ))}
          
          <button onClick={onLogout} className="flex flex-col md:hidden items-center justify-center space-y-1 px-4 py-2.5 rounded-2xl text-rose-500 flex-shrink-0 min-w-[80px]">
            <i className="fa-solid fa-right-from-bracket text-lg"></i>
            <span className="text-[10px] font-bold whitespace-nowrap tracking-tight">{t('navSignOut')}</span>
          </button>
        </div>

        <div className="hidden md:block mt-auto px-6 pt-4 border-t border-slate-50 flex-shrink-0">
          <button onClick={onLogout} className="w-full flex items-center gap-4 px-5 py-3.5 rounded-2xl text-rose-500 hover:bg-rose-50 transition-all font-bold">
            <i className="fa-solid fa-right-from-bracket text-xl"></i>
            <span className="text-[15px] tracking-tight">{t('navSignOut')}</span>
          </button>
        </div>
      </nav>
    </>
  );
};

const App: React.FC = () => {
  const { isRtl } = useLanguage();
  const [user, setUser] = useState<User | null>(null);
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshData = useCallback(async () => {
    if (!user) return;
    try {
      const h = await dataService.getAttendanceHistory(user.id);
      setHistory(h);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const refreshUser = useCallback(async () => {
    if (!user) return;
    try {
      const updatedUser = await dataService.getCurrentUserDoc(user.id);
      if (updatedUser) {
        setUser(updatedUser);
      }
    } catch (err) {
      console.error("Failed to refresh user:", err);
    }
  }, [user]);

  useEffect(() => {
    dataService.initAuth((u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  // Background Heartbeat: Check for auto-closures every minute
  useEffect(() => {
    if (!user) return;

    const heartbeat = setInterval(async () => {
      let changed = false;
      if (user.role === 'admin') {
        changed = await dataService.processAllAutoClosures();
      } else {
        changed = await dataService.processAutoClosures(user.id);
      }
      
      // Force refresh if database was updated
      if (changed) {
        refreshData();
      }
    }, 60000); // 1 minute

    return () => clearInterval(heartbeat);
  }, [user, refreshData]);

  useEffect(() => {
    if (user) refreshData();
  }, [user, refreshData]);

  const handleLogout = () => {
    dataService.logout();
    setUser(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  return (
    <HashRouter>
      <div className="min-h-screen flex flex-col md:flex-row bg-slate-50">
        <Navigation user={user} onLogout={handleLogout} onRefreshUser={refreshUser} />
        <main className={`flex-1 pb-24 pt-16 md:pt-0 md:pb-8 min-w-0 md:min-h-screen ${isRtl ? 'md:pr-64 md:pl-0' : 'md:pl-64 md:pr-0'}`}>
          <div className="max-w-5xl mx-auto px-4 pt-6 md:pt-12">
            <Routes>
              <Route path="/" element={<Dashboard user={user} history={history} onAction={refreshData} />} />
              <Route path="/history" element={<History history={history} user={user} onRefresh={refreshData} />} />
              <Route path="/settings" element={<Settings user={user} onRefreshUser={refreshUser} />} />
              {user.role === 'admin' && (
                <>
                  <Route path="/admin" element={<AdminReports />} />
                  <Route path="/admin/logs-export" element={<AdminLogExport />} />
                  <Route path="/admin/active" element={<ActiveEmployees />} />
                  <Route path="/admin/location" element={<AdminLocationSettings />} />
                  <Route path="/admin/users" element={<AdminUserManagement currentUser={user} onRefreshUser={refreshUser} />} />
                  <Route path="/admin/shifts" element={<AdminShiftManagement />} />
                  <Route path="/admin/broadcasts" element={<AdminBroadcastManagement />} />
                </>
              )}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </main>
      </div>
    </HashRouter>
  );
};

export default App;
