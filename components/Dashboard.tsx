
import React, { useState, useEffect } from 'react';
import { AttendanceRecord, User } from '../types';
import { dataService } from '../services/dataService';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface Props {
  user: User;
  history: AttendanceRecord[];
  onAction: () => void;
}

const Dashboard: React.FC<Props> = ({ user, history, onAction }) => {
  const [processing, setProcessing] = useState(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const activeRecord = history.find(r => !r.checkOut);
  
  const handleToggle = async () => {
    setProcessing(true);
    try {
      if (activeRecord) {
        await dataService.checkOut(user.id);
      } else {
        let loc = undefined;
        try {
          const pos = await new Promise<GeolocationPosition>((res, rej) => 
            navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 })
          );
          loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        } catch (e) {
          console.warn("Location check failed");
        }
        await dataService.checkIn(user, loc);
      }
      onAction();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Action failed");
    } finally {
      setProcessing(false);
    }
  };

  const todayRecords = history.filter(r => 
    r.checkIn.toDateString() === new Date().toDateString()
  );

  const chartData = history.slice(0, 10).reverse().map(r => ({
    name: r.checkIn.toLocaleDateString(undefined, { weekday: 'short' }),
    hours: r.duration ? +(r.duration / 60).toFixed(1) : 0
  }));

  const activeDurationMs = activeRecord ? now.getTime() - activeRecord.checkIn.getTime() : 0;
  const activeHours = Math.floor(activeDurationMs / 3600000);
  const activeMinutes = Math.floor((activeDurationMs % 3600000) / 60000);

  return (
    <div className="space-y-8 animate-fadeIn">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            {activeRecord ? 'Shift in progress' : `Hello, ${user.name.split(' ')[0]}!`}
          </h1>
          <p className="text-slate-500 mt-1">Ready to track your time today?</p>
        </div>
        <div className="bg-white px-6 py-4 rounded-3xl shadow-sm border border-slate-100 flex items-center space-x-4">
          <div className="text-right">
            <p className="text-sm font-bold text-slate-900">{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
            <p className="text-xs text-slate-400">{now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'short' })}</p>
          </div>
          <div className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center text-indigo-600">
            <i className="fa-solid fa-clock"></i>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-3xl p-8 shadow-sm border border-slate-100 flex flex-col items-center justify-center relative overflow-hidden min-h-[400px]">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/50 rounded-full -mr-32 -mt-32 blur-3xl"></div>
          
          <div className={`mb-8 w-24 h-24 rounded-3xl flex items-center justify-center text-3xl shadow-inner ${
            activeRecord ? 'bg-emerald-50 text-emerald-500' : 'bg-slate-50 text-slate-300'
          }`}>
            <i className={`fa-solid ${activeRecord ? 'fa-hourglass-start fa-spin' : 'fa-power-off'}`}></i>
          </div>

          <h2 className="text-6xl font-black mb-4 tracking-tighter text-slate-900">
            {activeHours.toString().padStart(2, '0')}:{activeMinutes.toString().padStart(2, '0')}
          </h2>
          <p className="text-slate-500 font-semibold mb-10 text-center">
            {activeRecord ? `Clocked in at ${activeRecord.checkIn.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'OFF DUTY'}
          </p>

          <button
            onClick={handleToggle}
            disabled={processing}
            className={`group relative w-full max-w-sm py-6 rounded-2xl text-xl font-bold transition-all duration-300 shadow-xl flex items-center justify-center space-x-3 ${
              activeRecord 
                ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-100' 
                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-100'
            } active:scale-95 disabled:opacity-50`}
          >
            {processing ? (
              <i className="fa-solid fa-circle-notch fa-spin"></i>
            ) : (
              <>
                <i className={`fa-solid ${activeRecord ? 'fa-right-from-bracket' : 'fa-right-to-bracket'}`}></i>
                <span>{activeRecord ? 'Complete Shift' : 'Start New Shift'}</span>
              </>
            )}
          </button>
        </div>

        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Current Session</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-slate-500">Today's Total</span>
                <span className="font-bold text-slate-900">
                  {(todayRecords.reduce((acc, r) => acc + (r.duration || 0), 0) / 60).toFixed(1)} hrs
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-slate-500">Completed Shifts</span>
                <span className="font-bold text-slate-900">{todayRecords.filter(r => r.checkOut).length}</span>
              </div>
              <div className="pt-2">
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 rounded-full transition-all duration-1000" style={{ width: `${Math.min(100, (todayRecords.reduce((acc, r) => acc + (r.duration || 0), 0) / 480) * 100)}%` }}></div>
                </div>
                <p className="text-[10px] text-slate-400 mt-2 text-center italic">Goal: 8.0 hrs standard day</p>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 p-6 rounded-3xl shadow-xl text-white overflow-hidden relative">
            <i className="fa-solid fa-shield-halved absolute -right-4 -bottom-4 text-7xl opacity-10"></i>
            <h4 className="font-bold mb-2">Location Security</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Geofencing is active. Your check-in location is recorded for compliance.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
        <h3 className="text-lg font-bold text-slate-900 mb-6">Activity Trend</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip 
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
              />
              <Line 
                type="monotone" 
                dataKey="hours" 
                stroke="#6366f1" 
                strokeWidth={3} 
                dot={{ r: 5, fill: '#6366f1', strokeWidth: 2, stroke: '#fff' }}
                activeDot={{ r: 7 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
