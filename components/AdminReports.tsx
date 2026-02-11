import React, { useState, useEffect } from 'react';
import { dataService } from '../services/dataService';
import { MonthlyReport, AttendanceRecord, User } from '../types';
import History from './History';

const AdminReports: React.FC = () => {
  const [reports, setReports] = useState<MonthlyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState<string>('all');
  const [selectedEmployee, setSelectedEmployee] = useState<{ user: User; records: AttendanceRecord[] } | null>(null);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [requiredHours, setRequiredHours] = useState<Record<string, number>>({});

  const handleRequiredChange = (name: string, value: number) => {
    setRequiredHours(prev => ({
      ...prev,
      [name]: value
    }));
  };

  /* ================= FETCH REPORTS ================= */
  useEffect(() => {
    const fetch = async () => {
      setLoading(true);

      const from = fromDate ? new Date(fromDate) : undefined;
      const to = toDate ? new Date(toDate) : undefined;

      const data = await dataService.getMonthlyReports(from, to);
      setReports(data);
      setLoading(false);
    };

    fetch();
  }, [fromDate, toDate]);

  /* ================= VIEW EMPLOYEE ================= */
  const handleViewEmployee = async (employeeName: string) => {
    const allUsers = await dataService.getUsers();
    const user = allUsers.find(u => u.name === employeeName);
    if (!user) return;

    const history = await dataService.getAttendanceHistory(user.id);
    setSelectedEmployee({ user, records: history });
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Generating reports...</div>;
  }

  if (selectedEmployee) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => setSelectedEmployee(null)}
          className="flex items-center text-indigo-600 font-semibold mb-4"
        >
          ← Back to Reports
        </button>
        <History history={selectedEmployee.records} user={selectedEmployee.user} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Manager Dashboard</h1>
        <p className="text-slate-500">Aggregate monthly hours for all staff</p>
      </div>

      {reports.map((report) => {

        const filteredEmployees =
          selectedEmployeeFilter === 'all'
            ? report.employees
            : report.employees.filter(e => e.name === selectedEmployeeFilter);

        const totalShifts = filteredEmployees.reduce((acc, e) => acc + e.shiftCount, 0);
        const totalHours = filteredEmployees.reduce((acc, e) => acc + e.totalHours, 0);
        const totalDifference = filteredEmployees.reduce((acc, e) => {
          const required = requiredHours[e.name] || 0;
          return acc + (e.totalHours - required);
        }, 0);

        return (
          <div
            key={`${report.year}-${report.month}`}
            className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden"
          >

            {/* ================= HEADER ================= */}
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex flex-wrap gap-6 items-end justify-between">

              <div>
                <h3 className="font-bold text-slate-800">
                  {report.month} {report.year}
                </h3>
                <span className="text-xs text-slate-400 uppercase">
                  {filteredEmployees.length} Active Staff
                </span>
              </div>

              {/* Filters */}
              <div className="flex gap-4 items-end">

                <div className="flex flex-col">
                  <label className="text-xs text-slate-400 uppercase mb-1">Employee</label>
                  <select
                    value={selectedEmployeeFilter}
                    onChange={(e) => setSelectedEmployeeFilter(e.target.value)}
                    className="px-3 py-2 border border-slate-200 rounded-lg"
                  >
                    <option value="all">All Employees</option>
                    {report.employees.map(emp => (
                      <option key={emp.name} value={emp.name}>
                        {emp.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col">
                  <label className="text-xs text-slate-400 uppercase mb-1">From</label>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>

                <div className="flex flex-col">
                  <label className="text-xs text-slate-400 uppercase mb-1">To</label>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>

              </div>
            </div>

            {/* ================= TABLE ================= */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Employee</th>
                    <th className="px-6 py-3 text-center text-xs font-bold text-slate-400 uppercase">Shifts</th>
                    <th className="px-6 py-3 text-right text-xs font-bold text-slate-400 uppercase">Total Hours</th>
                    <th className="px-6 py-3 text-right text-xs font-bold text-slate-400 uppercase">Required</th>
                    <th className="px-6 py-3 text-right text-xs font-bold text-slate-400 uppercase">Difference</th>
                    <th className="px-6 py-3 text-right text-xs font-bold text-slate-400 uppercase">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredEmployees.map((emp) => {

                    const required = requiredHours[emp.name] || 0;
                    const diff = emp.totalHours - required;

                    return (
                      <tr key={emp.name}>
                        <td className="px-6 py-4 font-semibold">{emp.name}</td>

                        <td className="px-6 py-4 text-center">
                          <span className="px-2 py-1 bg-slate-100 rounded-md text-sm">
                            {emp.shiftCount}
                          </span>
                        </td>

                        <td className="px-6 py-4 text-right font-mono font-bold text-indigo-600">
                          {emp.totalHours.toFixed(2)} hrs
                        </td>

                        <td className="px-6 py-4 text-right">
                          <input
                            type="number"
                            step="0.25"
                            value={requiredHours[emp.name] ?? ''}
                            onChange={(e) =>
                              handleRequiredChange(emp.name, parseFloat(e.target.value) || 0)
                            }
                            className="w-24 text-right px-2 py-1 border border-slate-200 rounded-lg"
                          />
                        </td>

                        <td className={`px-6 py-4 text-right font-mono font-bold ${
                          diff < 0 ? 'text-rose-500'
                          : diff > 0 ? 'text-emerald-600'
                          : 'text-slate-500'
                        }`}>
                          {diff.toFixed(2)} hrs
                        </td>

                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => handleViewEmployee(emp.name)}
                            className="text-xs bg-white border border-slate-200 px-3 py-1.5 rounded-lg"
                          >
                            View Logs
                          </button>
                        </td>
                      </tr>
                    );
                  })}

                  {/* Monthly Totals */}
                  <tr className="bg-indigo-50/30 font-bold">
                    <td className="px-6 py-4">Monthly Total</td>
                    <td className="px-6 py-4 text-center">{totalShifts}</td>
                    <td className="px-6 py-4 text-right">{totalHours.toFixed(2)} hrs</td>
                    <td></td>
                    <td className="px-6 py-4 text-right">{totalDifference.toFixed(2)} hrs</td>
                    <td></td>
                  </tr>

                </tbody>
              </table>
            </div>

          </div>
        );
      })}
    </div>
  );
};

export default AdminReports;
