import React, { useEffect, useState } from 'react';
import { dataService } from '../services/dataService';
import { AttendanceRecord, User } from '../types';

interface ActiveShift {
  user: User;
  record: AttendanceRecord;
}

const ActiveEmployees: React.FC = () => {
  const [active, setActive] = useState<ActiveShift[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const users = await dataService.getUsers();
      const allAttendance = await dataService.getAllAttendance(); // we'll add this
      const actives: ActiveShift[] = [];

      allAttendance.forEach(record => {
        if (record.checkIn && !record.checkOut) {
          const user = users.find(u => u.id === record.userId);
          if (user) {
            actives.push({ user, record });
          }
        }
      });

      setActive(actives);
      setLoading(false);
    };

    load();
  }, []);

  if (loading) return <div className="p-8">Loading active employees...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Currently Active Employees</h1>

      {active.length === 0 ? (
        <div className="bg-white p-8 rounded-2xl border text-slate-400">
          No employees currently clocked in.
        </div>
      ) : (
        <div className="bg-white rounded-2xl border overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="p-4 text-left">Employee</th>
                <th className="p-4 text-left">Department</th>
                <th className="p-4 text-left">Clocked In At</th>
              </tr>
            </thead>
            <tbody>
              {active.map((a, i) => (
                <tr key={i} className="border-t">
                  <td className="p-4 font-semibold">{a.user.name}</td>
                  <td className="p-4">{a.user.department}</td>
                  <td className="p-4">
                    {a.record.checkIn.toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ActiveEmployees;
