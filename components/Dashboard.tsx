
import React, { useEffect, useMemo, useState, useRef } from 'react';
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
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [userLocation, setUserLocation] = useState<GeolocationCoordinates | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [loadingProject, setLoadingProject] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);

  // Use a ref to track status transitions without triggering excessive re-renders
  const lastMobilityStatus = useRef<'inside' | 'outside' | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setLoadingProject(true);
      setPermissionDenied(false);
      try {
        const assigned = await dataService.getProjects(user.id);
        if (user.role === 'admin') {
          const all = await dataService.getProjects();
          setAllProjects(all);
          setUserProject(assigned[0] || null);
        } else {
          setUserProject(assigned[0] || null);
        }
      } catch (err: any) {
        if (err.code === 'permission-denied') setPermissionDenied(true);
      } finally {
        setLoadingProject(false);
      }
    };
    fetchData();
  }, [user.id, user.role]);

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported.");
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setUserLocation(pos.coords);
        setLocationError(null);
      },
      (err) => setLocationError("Location access required for shift tracking."),
      { enableHighAccuracy: true }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3;
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
    if (!userLocation || !userProject?.geofence?.enabled) return null;
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

  // MOBILITY TRANSITION MONITORING
  useEffect(() => {
    if (activeRecord && userProject?.geofence?.enabled && userLocation) {
      const currentStatus = isInsideZone ? 'inside' : 'outside';
      
      // If we transition from inside to outside (or vice versa), log the event
      if (lastMobilityStatus.current !== null && lastMobilityStatus.current !== currentStatus) {
        dataService.logMobilityEvent(activeRecord.id, currentStatus);
      }
      
      lastMobilityStatus.current = currentStatus;
    }
  }, [isInsideZone, activeRecord, userProject, userLocation]);

  const handleToggle = async () => {
    if (processing || (!isInsideZone && userProject?.geofence?.enabled && !activeRecord)) return;
    setProcessing(true);
    try {
      const loc = userLocation ? { lat: userLocation.latitude, lng: userLocation.longitude, accuracy: userLocation.accuracy } : undefined;
      if (activeRecord) {
        await dataService.checkOut(String(activeRecord.id), loc);
        lastMobilityStatus.current = null; // Clear tracking state on checkout
      } else {
        await dataService.checkIn(user, loc, userProject?.id);
        lastMobilityStatus.current = 'inside'; // Assume starting inside
      }
      await onAction();
    } catch (err: any) {
      alert("Shift action failed.");
    } finally {
      setProcessing(false);
    }
  };

  const todayHours = useMemo(() => {
    const today = new Date().toDateString();
    return history
      .filter(r => r.checkIn.toDateString() === today)
      .reduce((a, r) => a + (r.duration || 0), 0) / 60;
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
      <div className="flex flex-col md:flex-row justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            {activeRecord ? 'Shift in progress' : `Hello, ${user.name.split(' ')[0]}!`}
          </h1>
          <p className="text-slate-500">Track your site attendance and location activity</p>
        </div>

        <div className="flex flex-col md:items-end gap-2">
          {user.role === 'admin' && allProjects.length > 0 && (
            <select 
              value={userProject?.id || ''} 
              onChange={(e) => setUserProject(allProjects.find(p => p.id === e.target.value) || null)}
              className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black uppercase tracking-wider text-slate-600 outline-none shadow-sm cursor-pointer"
            >
              <option value="">Select Site to Monitor</option>
              {allProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
          <div className="bg-white px-6 py-4 rounded-3xl border flex items-center gap-4 shadow-sm">
            <div className="text-right">
              <p className="font-black text-slate-900">{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{now.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })}</p>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white"><i className="fa-solid fa-clock" /></div>
          </div>
        </div>
      </div>

      {userProject && (
        <div className={`p-5 rounded-3xl border flex items-center justify-between ${
          !userProject.geofence.enabled ? 'bg-indigo-50 border-indigo-100 text-indigo-700' :
          isInsideZone ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 
          'bg-rose-50 border-rose-100 text-rose-700'
        }`}>
          <div className="flex items-center space-x-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl ${
              isInsideZone ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white animate-pulse'
            }`}>
              <i className={`fa-solid ${isInsideZone ? 'fa-location-dot' : 'fa-location-crosshairs'}`}></i>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest opacity-70">{userProject.name}</p>
              <p className="text-sm font-bold">
                {!userProject.geofence.enabled ? 'Location tracking is advisory' :
                 (isInsideZone ? 'You are within site boundary' : 'You are outside site boundary')}
              </p>
            </div>
          </div>
          {userProject.geofence.enabled && currentDistance !== null && (
            <div className="text-right">
              <p className="font-black text-lg">{Math.round(currentDistance)}m</p>
              <p className="text-[9px] font-black uppercase opacity-60">To Center</p>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-3xl p-10 border border-slate-100 shadow-xl flex flex-col items-center justify-center min-h-[400px]">
          <div className={`w-28 h-28 mb-8 rounded-full flex items-center justify-center text-4xl shadow-inner ${
            activeRecord ? 'bg-emerald-50 text-emerald-500 ring-8 ring-emerald-50/50' : 'bg-slate-50 text-slate-300 ring-8 ring-slate-50/30'
          }`}>
            <i className={`fa-solid ${activeRecord ? 'fa-hourglass-start fa-spin' : 'fa-power-off'}`} />
          </div>
          <div className="text-7xl font-black mb-2 tracking-tighter text-slate-900">
            {hours.toString().padStart(2, '0')}:{minutes.toString().padStart(2, '0')}
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-12">
            {activeRecord ? `Clocked in since ${activeRecord.checkIn.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Ready to start'}
          </p>
          <button
            onClick={handleToggle}
            disabled={processing || (!isInsideZone && userProject?.geofence?.enabled && !activeRecord)}
            className={`w-full max-w-xs py-5 rounded-2xl text-xl font-black tracking-tight transition-all shadow-xl active:scale-95 ${
              activeRecord ? 'bg-rose-500 hover:bg-rose-600' : 'bg-indigo-600 hover:bg-indigo-700'
            } text-white disabled:opacity-30`}
          >
            {processing ? <i className="fa-solid fa-circle-notch fa-spin" /> : (activeRecord ? 'Clock Out' : 'Clock In')}
          </button>
        </div>

        <div className="space-y-6">
          <div className="bg-white p-8 rounded-3xl border shadow-sm">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Today's Stats</h3>
            <div className="space-y-6">
              <div className="flex justify-between items-end border-b pb-4">
                <div><p className="text-xs font-bold text-slate-400 mb-1">Hours</p><p className="text-2xl font-black">{todayHours.toFixed(1)} <span className="text-sm">HRS</span></p></div>
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-500 flex items-center justify-center"><i className="fa-solid fa-chart-line text-xs"></i></div>
              </div>
              <div className="flex justify-between items-end">
                <div><p className="text-xs font-bold text-slate-400 mb-1">Shifts</p><p className="text-2xl font-black">{history.filter(r => r.checkIn.toDateString() === new Date().toDateString()).length}</p></div>
                <div className="w-8 h-8 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center"><i className="fa-solid fa-list-check text-xs"></i></div>
              </div>
            </div>
          </div>
          <div className="bg-slate-900 text-white p-8 rounded-3xl shadow-xl">
            <div className="flex items-center space-x-2 mb-3 text-indigo-400">
              <i className="fa-solid fa-location-arrow"></i>
              <span className="text-[10px] font-black uppercase tracking-widest">Live Mobility Tracking</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              While active, the system logs when you enter or leave the site perimeter automatically for audit purposes.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
