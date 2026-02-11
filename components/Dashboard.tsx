import { useEffect, useMemo, useState } from 'react';
import { AttendanceRecord, User } from '../types';
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

  /* live clock */
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  /* ACTIVE SHIFT = checkIn exists AND no checkOut */
  const activeRecord = useMemo(
    () => history.find(r => r.checkIn && !r.checkOut),
    [history]
  );

  /* START / END SHIFT */
  const handleToggle = async () => {
    if (processing) return;
    setProcessing(true);

    try {
      if (activeRecord) {
        // ✅ FIX: pass RECORD ID, not user
        await dataService.checkOut(String(activeRecord.id));
      } else {
        await dataService.checkIn(user);
      }

      await onAction();
    } catch (err) {
      console.error('Shift action failed:', err);
      alert('Shift action failed');
    } finally {
      setProcessing(false);
    }
  };

  /* TODAY RECORDS */
  const todayRecords = useMemo(() => {
    const today = new Date().toDateString();
    return history.filter(
      r => r.checkIn && r.checkIn.toDateString() === today
    );
  }, [history]);

  /* CHART DATA */
  const chartData = useMemo(
    () =>
      history.slice(-10).map(r => ({
        name: r.checkIn.toLocaleDateString(undefined, { weekday: 'short' }),
        hours: r.duration ? +(r.duration / 60).toFixed(1) : 0,
      })),
    [history]
  );

  /* ACTIVE TIMER */
  const activeMs = activeRecord
    ? now.getTime() - activeRecord.checkIn.getTime()
    : 0;

  const hours = Math.floor(activeMs / 3600000);
  const minutes = Math.floor((activeMs % 3600000) / 60000);

  return (
    <div className="space-y-8 animate-fadeIn">

      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            {activeRecord
              ? 'Shift in progress'
              : `Hello, ${user.name.split(' ')[0]}!`}
          </h1>
          <p className="text-slate-500">Ready to track your time today?</p>
        </div>

        <div className="bg-white px-6 py-4 rounded-3xl border flex items-center gap-4">
          <div className="text-right">
            <p className="font-bold">
              {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
            <p className="text-xs text-slate-400">
              {now.toLocaleDateString([], {
                weekday: 'long',
                day: 'numeric',
                month: 'short',
              })}
            </p>
          </div>
          <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center">
            <i className="fa-solid fa-clock text-indigo-600" />
          </div>
        </div>
      </div>

      {/* MAIN */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-3xl p-8 border flex flex-col items-center min-h-[380px]">

          <div
            className={`w-24 h-24 mb-6 rounded-3xl flex items-center justify-center text-3xl ${
              activeRecord
                ? 'bg-emerald-50 text-emerald-500'
                : 'bg-slate-100 text-slate-300'
            }`}
          >
            <i
              className={`fa-solid ${
                activeRecord ? 'fa-hourglass-start fa-spin' : 'fa-power-off'
              }`}
            />
          </div>

          <div className="text-6xl font-black mb-2">
            {hours.toString().padStart(2, '0')}:
            {minutes.toString().padStart(2, '0')}
          </div>

          <p className="text-slate-500 mb-8">
            {activeRecord
              ? `Clocked in at ${activeRecord.checkIn.toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}`
              : 'OFF DUTY'}
          </p>

          <button
            onClick={handleToggle}
            disabled={processing}
            className={`w-full max-w-sm py-5 rounded-2xl text-xl font-bold transition ${
              activeRecord
                ? 'bg-rose-500 hover:bg-rose-600'
                : 'bg-indigo-600 hover:bg-indigo-700'
            } text-white disabled:opacity-50`}
          >
            {processing ? (
              <i className="fa-solid fa-circle-notch fa-spin" />
            ) : (
              <>
                <i
                  className={`fa-solid mr-2 ${
                    activeRecord
                      ? 'fa-right-from-bracket'
                      : 'fa-right-to-bracket'
                  }`}
                />
                {activeRecord ? 'Complete Shift' : 'Start New Shift'}
              </>
            )}
          </button>
        </div>

        {/* SIDE */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border">
            <h3 className="text-xs font-bold text-slate-400 uppercase mb-4">
              Current Session
            </h3>

            <div className="space-y-3">
              <div className="flex justify-between">
                <span>Today’s Total</span>
                <span className="font-bold">
                  {(todayRecords.reduce(
                    (a, r) => a + (r.duration || 0),
                    0
                  ) / 60).toFixed(1)} hrs
                </span>
              </div>

              <div className="flex justify-between">
                <span>Completed Shifts</span>
                <span className="font-bold">
                  {todayRecords.filter(r => r.checkOut).length}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 text-white p-6 rounded-3xl">
            <h4 className="font-bold mb-2">Location Security</h4>
            <p className="text-xs text-slate-400">
              Check-in location is recorded when available.
            </p>
          </div>
        </div>
      </div>

      {/* CHART */}
      <div className="bg-white p-8 rounded-3xl border">
        <h3 className="text-lg font-bold mb-4">Activity Trend</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="hours"
                stroke="#6366f1"
                strokeWidth={3}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
