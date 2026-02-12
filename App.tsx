
import React, { useState, useEffect, useCallback } from 'react';
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

const { HashRouter, Routes, Route, Link, useLocation, Navigate } = ReactRouterDOM as any;

const Navigation = ({ user, onLogout }: { user: User; onLogout: () => void }) => {
  const location = useLocation();
  const links = [
    { path: '/', label: 'Home', icon: 'fa-house' },
    { path: '/history', label: 'My Logs', icon: 'fa-list' },
  ];

  if (user.role === 'admin') {
    links.push({ path: '/admin', label: 'Reports', icon: 'fa-chart-pie' });
    links.push({ path: '/admin/active', label: 'Active', icon: 'fa-user-clock' });
    links.push({ path: '/admin/users', label: 'Staff', icon: 'fa-users-gear' });
    links.push({ path: '/admin/location', label: 'Worksite', icon: 'fa-location-dot' });
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex overflow-x-auto md:overflow-visible no-scrollbar md:top-0 md:bottom-auto md:flex-col md:w-64 md:h-screen md:border-r md:border-t-0 md:justify-start md:space-y-2 md:py-8 md:z-50 print:hidden shadow-lg md:shadow-none">
      <div className="hidden md:flex flex-col px-4 mb-8">
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
            <i className="fa-solid fa-clock"></i>
          </div>
          <span className="font-bold text-xl tracking-tight">AttendancePro</span>
        </div>
        <div className="p-3 bg-slate-50 rounded-2xl flex items-center space-x-3">
          <img src={user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}`} className="w-8 h-8 rounded-full border border-white shadow-sm" alt="U" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-slate-900 truncate">{user.name || 'User'}</p>
            <p className="text-[10px] text-slate-400 capitalize">{user.role || 'Employee'}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-1 md:flex-col md:justify-start md:space-y-1 px-2 py-2 md:px-0 md:py-0 min-w-max md:min-w-0">
        {links.map((link) => (
          <Link
            key={link.path}
            to={link.path}
            className={`flex flex-col md:flex-row items-center justify-center space-y-1 md:space-y-0 md:space-x-4 px-4 py-2 md:px-4 md:py-2 rounded-xl transition-all duration-200 min-w-[72px] md:min-w-0 ${
              location.pathname === link.path
                ? 'text-indigo-600 md:bg-indigo-50 font-semibold'
                : 'text-slate-500 hover:text-indigo-600 hover:bg-slate-50'
            }`}
          >
            <i className={`fa-solid ${link.icon} text-lg md:text-xl`}></i>
            <span className="text-[9px] md:text-base font-medium whitespace-nowrap">{link.label}</span>
          </Link>
        ))}
        
        {/* Logout button on mobile positioned at end of scrollable list */}
        <button
          onClick={onLogout}
          className="flex flex-col md:hidden items-center justify-center space-y-1 px-4 py-2 rounded-xl text-rose-500 min-w-[72px]"
        >
          <i className="fa-solid fa-right-from-bracket text-lg"></i>
          <span className="text-[9px] font-medium whitespace-nowrap">Logout</span>
        </button>
      </div>

      <button
        onClick={onLogout}
        className="hidden md:flex flex-row items-center space-x-4 px-4 py-2 rounded-xl text-rose-500 hover:bg-rose-50 transition-all md:mt-auto mx-4"
      >
        <i className="fa-solid fa-right-from-bracket text-xl"></i>
        <span className="text-base font-medium">Logout</span>
      </button>
    </nav>
  );
};

const App: React.FC = () => {
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

  useEffect(() => {
    dataService.initAuth((u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

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
        <Navigation user={user} onLogout={handleLogout} />
        <main className="flex-1 pb-24 md:pb-8 md:pl-64">
          <div className="max-w-5xl mx-auto px-4 pt-6 md:pt-12">
            <style>{`
              .no-scrollbar::-webkit-scrollbar { display: none; }
              .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
            <Routes>
              <Route path="/" element={<Dashboard user={user} history={history} onAction={refreshData} />} />
              <Route path="/history" element={<History history={history} user={user} />} />
              {user.role === 'admin' && (
                <>
                  <Route path="/admin" element={<AdminReports />} />
                  <Route path="/admin/active" element={<ActiveEmployees />} />
                  <Route path="/admin/location" element={<AdminLocationSettings />} />
                  <Route path="/admin/users" element={<AdminUserManagement />} />
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
