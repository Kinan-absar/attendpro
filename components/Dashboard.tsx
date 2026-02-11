
import { useEffect, useMemo, useState } from 'react';
import { AttendanceRecord, User, Project } from '../types';
import { dataService } from '../services/dataService';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface Props {
  user: User;
  history: AttendanceRecord[];
  onAction: () => Promise<void> | void;
}

const Dashboard: React.FC<Props> = ({ user, history, onAction }) => {
  const [processing, setProcessing] = useState(false);
  const [now, setNow] = useState(new Date());
  const [userProject, setUserProject] = useState<Project | null>(null);
  const [userLocation, setUserLocation] = useState<GeolocationCoordinates | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [loadingProject, setLoadingProject] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const fetchUserProject = async () => {
      setLoadingProject(true);
      setPermissionDenied(false);
      try {
        // Try to fetch specifically assigned projects for this user
        let projects = await dataService.getProjects(user.id);
        
        // If nothing assigned specifically to this user ID, 
        // and user is admin, fetch all projects and pick the first one for testing/monitoring
        if (projects.length === 0 && user.role === 'admin') {
          const allProjects = await dataService.getProjects();
          if (allProjects.length > 0) {
            projects = [allProjects[0]];
          }
        }
        
        setUserProject(projects[0] || null);
      } catch (err: any) {
        console.warn("Dashboard: Project fetch failed", err);
        if (err.code === 'permission-denied') {
          setPermissionDenied(true);
        }
      } finally {
        setLoadingProject(false);
      }
    };
    fetchUserProject();
  }, [user.id, user.role]);

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser.");
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setUserLocation(pos.coords);
        setLocationError(null);
      },
      (err) => {
        console.error("Location error:", err);
        setLocationError("Please enable location access to check in.");
      },
      { enableHighAccuracy: true }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const currentDistance = useMemo(() => {
    if (!userLocation || !userProject?.geofence) return null;
    return calculateDistance(userLocation.latitude, userLocation.longitude, userProject.geofence.lat, userProject.geofence.lng);
  }, [userLocation, userProject]);

  const isInsideZone = useMemo(() => {
    if (!userProject?.geofence?.enabled) return true;
    if (currentDistance === null) return false;
    return currentDistance <= userProject.geofence.radius;
  }, [currentDistance, userProject]);

  const activeRecord = useMemo(
    () => history.find(r => r.checkIn && !r.checkOut),
    [history]
  );

  const handleToggle = async () => {
    if (processing || (!isInsideZone && userProject?.geofence?.enabled)) return;
    setProcessing(true);

    try {
      const loc = userLocation ? { 
        lat: userLocation.latitude, 
        lng: userLocation.longitude,
        accuracy: userLocation.accuracy 
      } : undefined;

      if (activeRecord) {
        await dataService.checkOut(String(activeRecord.id), loc);
      } else {
        await dataService.checkIn(user, loc);
      }
      await onAction();
    } catch (err: any) {
      console.error('Shift action failed:', err);
      const msg = err?.code === 'permission-denied' 
        ? "Action blocked: Database permission denied." 
        : "Action failed. Please try again.";
      alert(msg);
    } finally {
      setProcessing(false);
    }
  };

  const todayRecords = useMemo(() => {
    const today = new Date().toDateString();
    return history.filter(r => r.checkIn && r.checkIn.toDateString() === today);
  }, [history]);

  const chartData = useMemo(
    () => history.slice(-10).reverse().map(r => ({
      name: r.checkIn.toLocaleDateString(undefined, { weekday: 'short' }),
      hours: r.duration ? +(r.duration / 60).toFixed(1) : 0,
    })),
    [history]
  );

  const activeMs = activeRecord ? now.getTime() - activeRecord.checkIn.getTime() : 0;
  const hours = Math.floor(activeMs / 3600000);
  const minutes = Math.floor((activeMs % 3600000) / 60000);

  return (
    <div className="space-y-8 animate-fadeIn pb-12">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            {activeRecord ? 'Shift in progress' : `Hello, ${user.name.split(' ')[0]}!`}
          </h1>
          <p className="text-slate-500">Track your productivity and attendance</p>
        </div>

        <div className="bg-white px-6 py-4 rounded-3xl border flex items-center gap-4 shadow-sm">
          <div className="text-right">
            <p className="font-black text-slate-900">{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              {now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'short' })}
            </p>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-100">
            <i className="fa-solid fa-clock" />
          </div>
        </div>
      </div>

      {/* ERROR/PERMISSION STATE */}
      {permissionDenied && (
        <div className="p-4 rounded-3xl border bg-rose-50 border-rose-100 text-rose-700 flex items-center space-x-3 animate-fadeIn">
          <i className="fa-solid fa-shield-halved text-xl"></i>
          <div>
            <p className="font-black uppercase text-[10px] tracking-widest">Access Restricted</p>
            <p className="text-sm font-medium">Your account cannot read project data. Please ask admin to update Firestore Rules.</p>
          </div>
        </div>
      )}

      {/* PROJECT STATUS BANNER */}
      {!loadingProject && userProject ? (
        <div className={`p-4 rounded-3xl border flex items-center justify-between ${
          isInsideZone ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-rose-50 border-rose-100 text-rose-700'
        }`}>
          <div className="flex items-center space-x-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
              isInsideZone ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white animate-pulse'
            }`}>
              <i className={`fa-solid ${isInsideZone ? 'fa-location-dot' : 'fa-location-crosshairs'}`}></i>
            </div>
            <div>
              <p className="font-black uppercase text-[10px] tracking-widest opacity-80">
                {user.role === 'admin' && !userProject.assignedUserIds?.includes(user.id) ? 'Previewing Site' : 'Assigned Project'}: {userProject.name}
              </p>
              <p className="text-sm font-bold">
                {locationError ? locationError : (isInsideZone ? 'You are within the project zone' : 'You are outside the project zone')}
              </p>
            </div>
          </div>
          <div className="text-right">
            {currentDistance !== null && (
              <p className="font-black text-lg leading-none">
                {currentDistance < 1000 ? `${Math.round(currentDistance)}m` : `${(currentDistance/1000).toFixed(1)}km`}
              </p>
            )}
            <p className="text-[10px] uppercase font-black opacity-60">From Center</p>
          </div>
        </div>
      ) : !loadingProject && !userProject && !permissionDenied ? (
        <div className="p-4 rounded-3xl border bg-amber-50 border-amber-100 text-amber-700 flex items-center space-x-3">
          <i className="fa-solid fa-triangle-exclamation text-xl"></i>
          <div>
            <p className="font-black uppercase text-[10px] tracking-widest">No Project Assigned</p>
            <p className="text-sm font-medium">You aren't assigned to a worksite. Please contact admin to assign your ID: <span className="font-mono text-[10px]">{user.id}</span></p>
          </div>
        </div>
      ) : null}

      {/* MAIN TRACKER */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-3xl p-10 border border-slate-100 shadow-xl shadow-slate-200/50 flex flex-col items-center justify-center min-h-[420px]">
          <div className={`w-28 h-28 mb-8 rounded-full flex items-center justify-center text-4xl shadow-inner ${
            activeRecord ? 'bg-emerald-50 text-emerald-500 ring-8 ring-emerald-50/50' : 'bg-slate-50 text-slate-300 ring-8 ring-slate-50/30'
          }`}>
            <i className={`fa-solid ${activeRecord ? 'fa-hourglass-start fa-spin' : 'fa-power-off'}`} />
          </div>

          <div className="text-7xl font-black mb-2 tracking-tighter text-slate-900">
            {hours.toString().padStart(2, '0')}:
            {minutes.toString().padStart(2, '0')}
          </div>

          <p className="text-xs font-black text-slate-400 uppercase tracking-[0.3em] mb-12">
            {activeRecord ? `Clocked in since ${activeRecord.checkIn.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Ready to start shift'}
          </p>

          <div className="w-full max-w-sm space-y-4">
            <button
              onClick={handleToggle}
              disabled={processing || (!isInsideZone && userProject?.geofence?.enabled && !activeRecord) || (!userProject && !activeRecord)}
              className={`w-full py-5 rounded-2xl text-xl font-black tracking-tight transition-all shadow-xl disabled:opacity-30 active:scale-95 ${
                activeRecord ? 'bg-rose-500 hover:bg-rose-600 shadow-rose-100' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100'
              } text-white`}
            >
              {processing ? (
                <i className="fa-solid fa-circle-notch fa-spin" />
              ) : (
                <div className="flex items-center justify-center">
                  <i className={`fa-solid mr-3 ${activeRecord ? 'fa-right-from-bracket' : 'fa-right-to-bracket'}`} />
                  {activeRecord ? 'Complete Shift' : 'Start New Shift'}
                </div>
              )}
            </button>
            
            {!isInsideZone && userProject?.geofence?.enabled && !activeRecord && (
              <p className="text-center text-rose-500 text-xs font-bold uppercase tracking-wider animate-pulse">
                Action blocked: Must be at {userProject.name}
              </p>
            )}
            {!userProject && !activeRecord && !loadingProject && !permissionDenied && (
              <p className="text-center text-amber-600 text-xs font-bold uppercase tracking-wider">
                Waiting for project assignment...
              </p>
            )}
          </div>
        </div>

        {/* SIDE METRICS */}
        <div className="space-y-6">
          <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Current Session</h3>
            <div className="space-y-6">
              <div className="flex justify-between items-end border-b border-slate-50 pb-4">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase mb-1">Today's Total</p>
                  <p className="text-2xl font-black text-slate-900">
                    {(todayRecords.reduce((a, r) => a + (r.duration || 0), 0) / 60).toFixed(1)} <span className="text-sm font-bold text-slate-400">HRS</span>
                  </p>
                </div>
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-500 flex items-center justify-center">
                  <i className="fa-solid fa-chart-simple text-xs"></i>
                </div>
              </div>
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase mb-1">Shift Count</p>
                  <p className="text-2xl font-black text-slate-900">
                    {todayRecords.filter(r => r.checkOut).length}
                  </p>
                </div>
                <div className="w-8 h-8 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center">
                  <i className="fa-solid fa-list-check text-xs"></i>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 text-white p-8 rounded-3xl shadow-xl shadow-slate-200">
            <div className="flex items-center space-x-3 mb-4 text-indigo-400">
              <i className="fa-solid fa-shield-halved"></i>
              <h4 className="font-black uppercase text-xs tracking-widest">Security Policy</h4>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed font-medium">
              Location authentication is tied to your specific worksite. Ensure GPS is enabled for accurate recording.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white p-10 rounded-3xl border border-slate-100 shadow-sm">
        <h3 className="text-lg font-black text-slate-900 mb-8">Activity Trend</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12, fontWeight: 'bold'}} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12, fontWeight: 'bold'}} />
              <Tooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} />
              <Line
                type="monotone"
                dataKey="hours"
                stroke="#6366f1"
                strokeWidth={4}
                dot={{r: 6, fill: '#6366f1', strokeWidth: 3, stroke: '#fff'}}
                activeDot={{r: 8, strokeWidth: 0}}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
