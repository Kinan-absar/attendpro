
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

const { HashRouter, Routes, Route, Link, useLocation, Navigate } = ReactRouterDOM as any;

const Navigation = ({ user, onLogout }: { user: User; onLogout: () => void }) => {
  const location = useLocation();
  const navRef = useRef<HTMLDivElement>(null);

  const links = [
    { path: '/', label: 'Home', icon: 'fa-house' },
    { path: '/history', label: 'My Logs', icon: 'fa-list' },
  ];

  if (user.role === 'admin') {
    links.push({ path: '/admin', label: 'Reports', icon: 'fa-chart-pie' });
    links.push({ path: '/admin/active', label: 'Active', icon: 'fa-user-clock' });
    links.push({ path: '/admin/broadcasts', label: 'Notices', icon: 'fa-bullhorn' });
    links.push({ path: '/admin/users', label: 'Staff', icon: 'fa-users-gear' });
    links.push({ path: '/admin/shifts', label: 'Schedules', icon: 'fa-calendar-day' });
    links.push({ path: '/admin/location', label: 'Worksite', icon: 'fa-location-dot' });
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 z-[100] md:top-0 md:bottom-auto md:flex-col md:w-64 md:h-screen md:border-r md:border-t-0 md:justify-start md:py-8 md:z-50 print:hidden shadow-[0_-4px_20px_rgba(0,0,0,0.05)] md:shadow-none pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
      <div className="hidden md:flex flex-col px-6 mb-10">
        <div className="flex items-center space-x-3 mb-8">
          <div className="w-11 h-11 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
            <i className="fa-solid fa-clock text-xl"></i>
          </div>
          <span className="font-black text-2xl tracking-tighter text-slate-900">AttendancePro</span>
        </div>
        <div className="p-4 bg-slate-50 rounded-[1.5rem] border border-slate-100 flex items-center space-x-3">
          <img src={user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}`} className="w-9 h-9 rounded-full border-2 border-white shadow-sm" alt="U" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-black text-slate-900 truncate">{user.name || 'User'}</p>
            <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">{user.role || 'Employee'}</p>
          </div>
        </div>
      </div>

      <div 
        ref={navRef}
        className="flex flex-row md:flex-col overflow-x-auto overflow-y-hidden md:overflow-y-visible no-scrollbar flex-nowrap items-center md:items-stretch px-2 md:px-3 py-1 md:py-0 w-full"
        style={{ 
          WebkitOverflowScrolling: 'touch',
          justifyContent: 'flex-start'
        }}
      >
        {links.map((link) => (
          <Link
            key={link.path}
            to={link.path}
            className={`flex flex-col md:flex-row items-center justify-center space-y-1 md:space-y-0 md:space-x-4 px-4 py-2.5 md:px-5 md:py-3.5 rounded-2xl transition-all duration-300 flex-shrink-0 md:flex-shrink-1 min-w-[80px] md:min-w-0 ${
              location.pathname === link.path
                ? 'text-indigo-600 md:bg-indigo-50/80 font-bold scale-105 md:scale-100'
                : 'text-slate-400 hover:text-indigo-600 hover:bg-slate-50'
            }`}
          >
            <i className={`fa-solid ${link.icon} text-lg md:text-xl`}></i>
            <span className="text-[10px] md:text-[15px] font-bold md:font-semibold whitespace-nowrap tracking-tight">{link.label}</span>
          </Link>
        ))}
        
        <button
          onClick={onLogout}
          className="flex flex-col md:hidden items-center justify-center space-y-1 px-4 py-2.5 rounded-2xl text-rose-500 flex-shrink-0 min-w-[80px]"
        >
          <i className="fa-solid fa-right-from-bracket text-lg"></i>
          <span className="text-[10px] font-bold whitespace-nowrap tracking-tight">Logout</span>
        </button>
      </div>

      <div className="hidden md:block mt-auto px-6 pt-4 border-t border-slate-50">
        <button
          onClick={onLogout}
          className="w-full flex items-center space-x-4 px-5 py-3.5 rounded-2xl text-rose-500 hover:bg-rose-50 transition-all font-bold"
        >
          <i className="fa-solid fa-right-from-bracket text-xl"></i>
          <span className="text-[15px] tracking-tight">Sign Out</span>
        </button>
      </div>
    </nav>
  );
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpdateToast, setShowUpdateToast] = useState(false);

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

  useEffect(() => {
    dataService.initAuth((u) => {
      setUser(u);
      setLoading(false);
    });

    if ('serviceWorker' in navigator) {
      const handleUpdate = () => setShowUpdateToast(true);
      window.addEventListener('sw-update-available', handleUpdate);
      return () => window.removeEventListener('sw-update-available', handleUpdate);
    }
  }, []);

  useEffect(() => {
    if (user) refreshData();
  }, [user, refreshData]);

  const handleLogout = () => {
    dataService.logout();
    setUser(null);
  };

  const handleUpdateApp = () => {
    window.location.reload();
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
        <Navigation user={user} onLogout={handleLogout} />
        <main className="flex-1 pb-24 md:pb-8 md:pl-64 min-w-0 md:min-h-screen">
          <div className="max-w-5xl mx-auto px-4 pt-6 md:pt-12">
            {showUpdateToast && (
              <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[1000] w-[90%] max-sm animate-fadeIn no-print update-toast">
                <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between border border-white/10">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center animate-pulse">
                      <i className="fa-solid fa-cloud-arrow-down text-xs"></i>
                    </div>
                    <p className="text-xs font-bold tracking-tight">App Update Found</p>
                  </div>
                  <button onClick={handleUpdateApp} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors">Reload</button>
                </div>
              </div>
            )}

            <Routes>
              <Route path="/" element={<Dashboard user={user} history={history} onAction={refreshData} />} />
              <Route path="/history" element={<History history={history} user={user} onRefresh={refreshData} />} />
              {user.role === 'admin' && (
                <>
                  <Route path="/admin" element={<AdminReports />} />
                  <Route path="/admin/active" element={<ActiveEmployees />} />
                  <Route path="/admin/location" element={<AdminLocationSettings />} />
                  <Route path="/admin/users" element={<AdminUserManagement />} />
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
