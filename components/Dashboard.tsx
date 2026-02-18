
import React, { useEffect, useMemo, useState } from 'react';
import { AttendanceRecord, User, Project, Broadcast } from '../types';
import { dataService } from '../services/dataService';

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
  const [loading, setLoading] = useState(true);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      
      dataService.getActiveBroadcasts().then(setBroadcasts).catch(e => console.error("Broadcasts load error:", e));

      try {
        const assigned = await dataService.getProjects(user.id);
        
        if (user.role === 'admin') {
          const all = await dataService.getProjects();
          setAllProjects(all);
          setUserProject(assigned.length > 0 ? assigned[0] : null);
        } else {
          setUserProject(assigned[0] || null);
        }
      } catch (err) {
        console.error("Projects load error:", err);
      } finally {
        setLoading(false);
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
      (pos) => { setUserLocation(pos.coords); setLocationError(null); },
      (err) => setLocationError("Location access required for site operations."),
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
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
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

  const activeRecord = useMemo(() => {
    // 1. Find the latest record with no checkOut
    const record = history.find(r => r.checkIn && !r.checkOut);
    if (!record) return null;

    // 2. UI-SIDE STALE CHECK: If the record belongs to a previous day, treat it as closed locally
    // This provides immediate visual feedback even before the heartbeat syncs with Firebase.
    const checkInDate = new Date(record.checkIn);
    if (checkInDate.toDateString() !== now.toDateString()) {
       return null; 
    }
    
    return record;
  }, [history, now]);

  const handleToggle = async () => {
    if (processing) return;

    if (!activeRecord && !isInsideZone && userProject?.geofence?.enabled) {
      return alert("Geofence Restriction: You must be at the worksite to Clock In.");
    }

    setProcessing(true);
    try {
      const loc = userLocation ? { lat: userLocation.latitude, lng: userLocation.longitude, accuracy: userLocation.accuracy } : undefined;
      
      if (activeRecord) {
        await dataService.checkOut(activeRecord.id, loc, !isInsideZone);
      } else {
        if (!userProject) return alert("Please select a worksite first.");
        await dataService.checkIn(user, loc, userProject.id);
      }
      await onAction();
    } catch (err: any) {
      alert("Shift action failed: " + (err.message || "Unknown error"));
    } finally {
      setProcessing(false);
    }
  };

  const activeMs = activeRecord ? now.getTime() - new Date(activeRecord.checkIn).getTime() : 0;
  const hours = Math.floor(activeMs / 3600000);
  const minutes = Math.floor((activeMs % 3600000) / 60000);

  return (
    <div className="space-y-8 animate-fadeIn pb-12">
      <div className="flex flex-col md:flex-row justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            {activeRecord ? 'Shift Active' : `Hello, ${user.name.split(' ')[0]}!`}
          </h1>
          <p className="text-slate-500">Attendance tracked via geofencing site boundaries</p>
        </div>

        <div className="flex flex-col md:items-end gap-2">
          {user.role === 'admin' && allProjects.length > 0 && (
            <select 
              value={userProject?.id || ''} 
              onChange={(e) => setUserProject(allProjects.find(p => p.id === e.target.value) || null)}
              className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black uppercase tracking-wider text-slate-600 outline-none shadow-sm cursor-pointer"
            >
              <option value="">Monitoring Site: Select...</option>
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

      {broadcasts.length > 0 && (
        <div className="space-y-3">
          {broadcasts.map(b => (
            <div key={b.id} className={`p-5 rounded-3xl border flex items-start gap-4 transition-all animate-fadeIn ${
              b.type === 'urgent' ? 'bg-rose-50 border-rose-100 text-rose-800' :
              b.type === 'warning' ? 'bg-amber-50 border-amber-100 text-amber-800' :
              'bg-indigo-50 border-indigo-100 text-indigo-800'
            }`}>
              <div className={`mt-1 w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                b.type === 'urgent' ? 'bg-rose-500 text-white shadow-lg' :
                b.type === 'warning' ? 'bg-amber-500 text-white shadow-lg' :
                'bg-indigo-500 text-white shadow-lg'
              }`}>
                <i className={`fa-solid ${b.type === 'urgent' ? 'fa-triangle-exclamation' : b.type === 'warning' ? 'fa-circle-info' : 'fa-bullhorn'}`}></i>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-black text-sm uppercase tracking-tight">{b.title}</p>
                <p className="text-xs font-medium opacity-80 leading-relaxed mt-1">{b.message}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {userProject ? (
        <div className={`p-5 rounded-3xl border flex items-center justify-between ${
          !userProject.geofence.enabled ? 'bg-indigo-50 border-indigo-100 text-indigo-700' :
          isInsideZone ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 
          'bg-rose-50 border-rose-100 text-rose-700'
        }`}>
          <div className="flex items-center space-x-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl ${
              isInsideZone ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white shadow-lg'
            }`}>
              <i className={`fa-solid ${isInsideZone ? 'fa-location-dot' : 'fa-location-crosshairs'}`}></i>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest opacity-70">{userProject.name}</p>
              <p className="text-sm font-bold">
                {isInsideZone ? 'You are inside the site zone' : 'Warning: Outside site boundary'}
              </p>
            </div>
          </div>
          {currentDistance !== null && (
            <div className="text-right">
              <p className="font-black text-lg">{Math.round(currentDistance)}m</p>
              <p className="text-[9px] font-black uppercase opacity-60">Distance</p>
            </div>
          )}
        </div>
      ) : (
        <div className="p-5 bg-slate-100 border border-slate-200 rounded-3xl flex items-center gap-4 text-slate-500">
          <i className="fa-solid fa-circle-info text-lg"></i>
          <p className="text-xs font-black uppercase tracking-widest">No worksite selected for check-in.</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-3xl p-10 border border-slate-100 shadow-xl flex flex-col items-center justify-center min-h-[400px]">
          <div className={`w-28 h-28 mb-8 rounded-full flex items-center justify-center text-4xl shadow-inner ${
            activeRecord ? 'bg-indigo-50 text-indigo-500 ring-8 ring-indigo-50/50' : 'bg-slate-50 text-slate-300 ring-8 ring-slate-50/30'
          }`}>
            <i className={`fa-solid ${activeRecord ? 'fa-hourglass-start fa-spin' : 'fa-power-off'}`} />
          </div>
          <div className="text-7xl font-black mb-2 tracking-tighter text-slate-900">
            {hours.toString().padStart(2, '0')}:{minutes.toString().padStart(2, '0')}
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-12">
            {activeRecord ? `Clocked in @ ${new Date(activeRecord.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Shift Inactive'}
          </p>
          <button
            onClick={handleToggle}
            disabled={processing || (!activeRecord && !isInsideZone && userProject?.geofence?.enabled) || (!activeRecord && !userProject)}
            className={`w-full max-w-xs py-5 rounded-2xl text-xl font-black tracking-tight transition-all shadow-xl active:scale-95 ${
              activeRecord ? 'bg-rose-500 hover:bg-rose-600' : 'bg-indigo-600 hover:bg-indigo-700'
            } text-white disabled:opacity-30 disabled:grayscale`}
          >
            {processing ? <i className="fa-solid fa-circle-notch fa-spin" /> : (activeRecord ? 'Clock Out' : 'Clock In')}
          </button>
          {!activeRecord && !userProject && (
             <p className="text-indigo-600 text-[10px] font-black uppercase mt-4">
               <i className="fa-solid fa-hand-pointer mr-1"></i> Choose a site to begin
             </p>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-slate-900 text-white p-8 rounded-3xl shadow-xl">
            <h3 className="text-indigo-400 text-[10px] font-black uppercase tracking-widest mb-4 flex items-center">
              <i className="fa-solid fa-shield-halved mr-2"></i> Attendance Policy
            </h3>
            <ul className="space-y-4">
              <li className="flex items-start space-x-3 text-xs">
                <i className="fa-solid fa-check text-indigo-500 mt-1"></i>
                <p>Clock-in requires <strong>physical presence</strong> on site.</p>
              </li>
              <li className="flex items-start space-x-3 text-xs">
                <i className="fa-solid fa-check text-indigo-500 mt-1"></i>
                <p>Clock-out anywhere; flagged if outside zone.</p>
              </li>
              <li className="flex items-start space-x-3 text-xs">
                <i className="fa-solid fa-check text-indigo-500 mt-1"></i>
                <p>Unclosed shifts auto-terminate at <strong>23:59</strong>.</p>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
