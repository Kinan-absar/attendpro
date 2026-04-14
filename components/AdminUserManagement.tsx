import React, { useState, useEffect, useMemo, useRef } from 'react';
import { dataService } from '../services/dataService';
import { User, AttendanceRecord, ShiftSchedule, Project } from '../types';
import History from './History';
import UserEditModal from './UserEditModal';

// ── CSV column definition (order matters — matches template) ─────────────────
const CSV_COLUMNS = [
  { key: 'employeeId',      label: 'Staff ID',           required: true  },
  { key: 'name',            label: 'Full Name',          required: false },
  { key: 'email',           label: 'Email',              required: false },
  { key: 'department',      label: 'Department',         required: false },
  { key: 'company',         label: 'Company',            required: false },
  { key: 'grossSalary',     label: 'Gross Salary',       required: false },
  { key: 'basicSalary',     label: 'Basic Salary',       required: false },
  { key: 'housingAllowance',label: 'Housing Allowance',  required: false },
  { key: 'otherAllowances', label: 'Other Allowances',   required: false },
  { key: 'fixedDeductions', label: 'Fixed Deductions',   required: false },
  { key: 'standardHours',   label: 'Target Hours',       required: false },
  { key: 'iqamaNumber',     label: 'Iqama Number',       required: false },
  { key: 'bankCode',        label: 'Bank Code',          required: false },
  { key: 'ibanNumber',      label: 'IBAN',               required: false },
];

type ImportStatus = 'idle' | 'parsing' | 'preview' | 'importing' | 'done';

interface ImportRow {
  rowNum: number;
  data: Partial<User>;
  matchedUser: User | null;
  errors: string[];
}

const AdminUserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [shifts, setShifts] = useState<ShiftSchedule[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<Partial<User> | null>(null);
  const [viewingLogs, setViewingLogs] = useState<{ user: User; records: AttendanceRecord[] } | null>(null);
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('all');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Deletion State
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Import State
  const [importStatus, setImportStatus] = useState<ImportStatus>('idle');
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importProgress, setImportProgress] = useState(0);
  const [importDoneCount, setImportDoneCount] = useState(0);
  const importFileRef = useRef<HTMLInputElement>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [u, s, p] = await Promise.all([
        dataService.getUsers(),
        dataService.getShiftSchedules(),
        dataService.getProjects()
      ]);
      setUsers(u);
      setShifts(s);
      setProjects(p);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleConfirmDelete = async () => {
    if (!deletingUser) return;
    setIsDeleting(true);
    try {
      await dataService.deleteUser(deletingUser.id);
      setUsers(prev => prev.filter(u => u.id !== deletingUser.id));
      setDeletingUser(null);
    } catch (err: any) {
      alert(err.message || "Failed to delete staff profile.");
    } finally {
      setIsDeleting(false);
    }
  };

  // ── Export: Staff Directory CSV ──────────────────────────────────────────────
  const handleExportCSV = () => {
    setShowExportMenu(false);
    const headers = ["Name", "Staff ID", "Email", "Department", "Company", "Role", "Salary", "Std Hours"];
    const rows = filteredUsers.map(u => [
      u.name, u.employeeId, u.email, u.department,
      u.company || 'Absar Alomran', u.role, u.grossSalary, u.standardHours
    ]);
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Staff_Directory_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const handlePrint = () => {
    setShowExportMenu(false);
    window.print();
  };

  // ── Export: Import Template ──────────────────────────────────────────────────
  const handleDownloadTemplate = () => {
    setShowExportMenu(false);
    const headers = CSV_COLUMNS.map(c => c.label);
    // Pre-fill one row per existing user so they can just fill in the blanks
    const rows = users.map(u => CSV_COLUMNS.map(c => {
      const val = (u as any)[c.key];
      return val !== undefined && val !== null ? val : '';
    }));
    // Add a blank example row if no users yet
    if (rows.length === 0) {
      rows.push(CSV_COLUMNS.map(c => c.key === 'employeeId' ? 'EMP001' : ''));
    }
    const csvContent = [headers, ...rows].map(row =>
      row.map((v: any) => `"${String(v).replace(/"/g, '""')}"`).join(',')
    ).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Staff_Import_Template_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // ── Import: Parse CSV file ───────────────────────────────────────────────────
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportStatus('parsing');

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim());
        if (lines.length < 2) throw new Error('File has no data rows.');

        // Parse header row — match by label OR key (case-insensitive)
        const rawHeaders = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());
        const colIndexMap: Record<string, number> = {};
        CSV_COLUMNS.forEach(col => {
          const byLabel = rawHeaders.indexOf(col.label.toLowerCase());
          const byKey   = rawHeaders.indexOf(col.key.toLowerCase());
          const idx = byLabel >= 0 ? byLabel : byKey;
          if (idx >= 0) colIndexMap[col.key] = idx;
        });

        const parsed: ImportRow[] = lines.slice(1).map((line, i) => {
          const cells = parseCSVLine(line);
          const errors: string[] = [];
          const data: Partial<User> = {};

          CSV_COLUMNS.forEach(col => {
            const idx = colIndexMap[col.key];
            if (idx === undefined) return;
            const raw = (cells[idx] || '').trim();
            if (!raw) return;

            // Type coercion
            const numericKeys = ['grossSalary','basicSalary','housingAllowance','otherAllowances','fixedDeductions','standardHours'];
            if (numericKeys.includes(col.key)) {
              const n = parseFloat(raw);
              if (isNaN(n)) errors.push(`${col.label}: "${raw}" is not a number`);
              else (data as any)[col.key] = n;
            } else {
              (data as any)[col.key] = raw;
            }
          });

          // Required field check
          if (!data.employeeId) errors.push('Staff ID is required');

          // WPS validation (only if filled)
          if (data.iqamaNumber && !/^\d{10}$/.test(data.iqamaNumber))
            errors.push('Iqama must be exactly 10 digits');
          if (data.ibanNumber && (data.ibanNumber.length !== 24 || !data.ibanNumber.startsWith('SA')))
            errors.push('IBAN must be 24 chars starting with SA');
          if (data.bankCode && data.bankCode.length !== 3)
            errors.push('Bank Code must be 3 characters');

          // Match to existing user
          const matchedUser = users.find(u =>
            u.employeeId === data.employeeId ||
            (data.email && u.email?.toLowerCase() === data.email.toLowerCase())
          ) || null;

          if (!matchedUser) errors.push('No existing employee found with this Staff ID — import skips new account creation');

          return { rowNum: i + 2, data, matchedUser, errors };
        });

        setImportRows(parsed);
        setImportStatus('preview');
      } catch (err: any) {
        alert('Failed to parse file: ' + err.message);
        setImportStatus('idle');
      }
    };
    reader.readAsText(file, 'utf-8');
    // Reset input so same file can be re-selected
    e.target.value = '';
  };

  // ── Import: Apply updates ────────────────────────────────────────────────────
  const handleConfirmImport = async () => {
    const validRows = importRows.filter(r => r.matchedUser && r.errors.length === 0);
    if (validRows.length === 0) return;

    setImportStatus('importing');
    setImportProgress(0);
    let done = 0;

    for (const row of validRows) {
      try {
        const updated: Partial<User> = { ...row.matchedUser!, ...row.data };
        await dataService.saveUser(updated as User);
      } catch (err) {
        console.error('Failed to update', row.data.employeeId, err);
      }
      done++;
      setImportProgress(Math.round((done / validRows.length) * 100));
    }

    setImportDoneCount(done);
    setImportStatus('done');
    await fetchData();
  };

  const handleViewLogs = async (user: User) => {
    setLoading(true);
    try {
      const logs = await dataService.getAttendanceHistory(user.id);
      setViewingLogs({ user, records: logs });
    } catch (err) {
      alert("Failed to fetch logs.");
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const s = search.toLowerCase();
      const matchesSearch = (u.name || '').toLowerCase().includes(s) ||
                            (u.email || '').toLowerCase().includes(s) ||
                            (u.employeeId || '').toLowerCase().includes(s);
      let matchesProject = true;
      if (projectFilter !== 'all') {
        const project = projects.find(p => p.id === projectFilter);
        matchesProject = project?.assignedUserIds.includes(u.id) || false;
      }
      return matchesSearch && matchesProject;
    });
  }, [users, search, projectFilter, projects]);

  const validImportRows   = importRows.filter(r => r.matchedUser && r.errors.filter(e => !e.includes('skips new account')).length === 0);
  const skippedImportRows = importRows.filter(r => !r.matchedUser || r.errors.filter(e => !e.includes('skips new account')).length > 0);

  if (viewingLogs) {
    return (
      <div className="space-y-6 animate-fadeIn">
        <div className="flex items-center justify-between">
          <button onClick={() => setViewingLogs(null)} className="flex items-center text-indigo-600 font-bold hover:text-indigo-800 transition-colors">
            <i className="fa-solid fa-arrow-left mr-2"></i>
            Back to Staff List
          </button>
        </div>
        <History
          history={viewingLogs.records}
          user={viewingLogs.user}
          onRefresh={async () => {
            const updatedLogs = await dataService.getAttendanceHistory(viewingLogs.user.id);
            setViewingLogs({ ...viewingLogs, records: updatedLogs });
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fadeIn pb-20">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-print">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Staff Management</h1>
          <p className="text-slate-500">Manage {users.length} employee profiles and policies</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* ── Import Button ── */}
          <button
            onClick={() => { setImportStatus('preview'); setImportRows([]); importFileRef.current?.click(); }}
            className="px-6 py-3 bg-emerald-600 text-white rounded-2xl font-black text-sm shadow-lg hover:bg-emerald-700 transition-all flex items-center space-x-2"
          >
            <i className="fa-solid fa-file-import"></i>
            <span>Bulk Import</span>
          </button>
          <input ref={importFileRef} type="file" accept=".csv" className="hidden" onChange={handleImportFile} />

          <button
            onClick={() => setEditingUser({
              name: '', email: '', employeeId: '', department: 'Operations',
              role: 'employee', grossSalary: 0, company: 'Absar Alomran',
              disableOvertime: true, disableDeductions: false, isOnLeave: false, standardHours: 225
            })}
            className="px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-lg hover:bg-indigo-700 transition-all flex items-center space-x-2"
          >
            <i className="fa-solid fa-user-plus"></i>
            <span>Add New Staff</span>
          </button>
        </div>
      </div>

      {/* FILTERS & EXPORT */}
      <div className="flex flex-wrap items-end gap-4 no-print bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
        <div className="flex-1 min-w-[240px]">
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Search Directory</label>
          <div className="relative">
            <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"></i>
            <input
              type="text"
              placeholder="Name, ID, or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold text-sm"
            />
          </div>
        </div>

        <div className="w-full md:w-auto">
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Filter by Site</label>
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="w-full md:w-56 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
          >
            <option value="all">All Worksites</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        <div className="relative" ref={exportMenuRef}>
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            className="px-5 py-3 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg flex items-center space-x-2 active:scale-95 transition-all"
          >
            <i className="fa-solid fa-file-export"></i>
            <span>Export List</span>
            <i className={`fa-solid fa-chevron-down ml-1 transition-transform ${showExportMenu ? 'rotate-180' : ''}`}></i>
          </button>

          {showExportMenu && (
            <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-2xl shadow-2xl z-[150] overflow-hidden animate-fadeIn">
              <button onClick={handlePrint} className="w-full text-left px-5 py-4 hover:bg-slate-50 flex items-center space-x-3 transition-colors">
                <i className="fa-solid fa-file-pdf text-rose-500"></i>
                <span className="text-xs font-black uppercase tracking-widest text-slate-700">PDF Report</span>
              </button>
              <div className="h-px bg-slate-100"></div>
              <button onClick={handleExportCSV} className="w-full text-left px-5 py-4 hover:bg-slate-50 flex items-center space-x-3 transition-colors">
                <i className="fa-solid fa-file-excel text-emerald-500"></i>
                <span className="text-xs font-black uppercase tracking-widest text-slate-700">Excel / CSV</span>
              </button>
              <div className="h-px bg-slate-100"></div>
              <button onClick={handleDownloadTemplate} className="w-full text-left px-5 py-4 hover:bg-slate-50 flex items-center space-x-3 transition-colors">
                <i className="fa-solid fa-table-columns text-indigo-500"></i>
                <div>
                  <span className="text-xs font-black uppercase tracking-widest text-slate-700 block">Import Template</span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Pre-filled for all staff</span>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* STAFF TABLE */}
      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl overflow-hidden card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-8 py-5 text-left font-black text-slate-400 uppercase text-[10px] tracking-widest">Employee</th>
                <th className="px-6 py-5 text-left font-black text-slate-400 uppercase text-[10px] tracking-widest">Site Assignments</th>
                <th className="px-6 py-5 text-center font-black text-slate-400 uppercase text-[10px] tracking-widest">Std Hours</th>
                <th className="px-6 py-5 text-right font-black text-slate-400 uppercase text-[10px] tracking-widest">Gross Salary</th>
                <th className="px-8 py-5 text-right font-black text-slate-400 uppercase text-[10px] tracking-widest no-print">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredUsers.map(u => {
                const assignedProjects = projects.filter(p => p.assignedUserIds.includes(u.id));
                return (
                  <tr key={u.id} className="hover:bg-slate-50/30 transition-colors">
                    <td className="px-8 py-5">
                      <div className="flex items-center space-x-4">
                        <img src={u.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=random`} className="w-11 h-11 rounded-2xl border border-slate-100" />
                        <div>
                          <p className="font-bold text-slate-900 leading-tight flex items-center gap-2">
                            {u.name}
                            {u.isOnLeave && (
                              <span className="text-indigo-500" title="On Leave">
                                <i className="fa-solid fa-plane-departure text-[10px]"></i>
                              </span>
                            )}
                          </p>
                          <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mt-0.5">{u.employeeId} • {u.department}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-wrap gap-1">
                        {assignedProjects.length > 0 ? assignedProjects.map(p => (
                          <span key={p.id} className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[8px] font-black uppercase rounded border border-indigo-100">{p.name}</span>
                        )) : <span className="text-[9px] font-black text-slate-300 uppercase tracking-tighter">No Sites Assigned</span>}
                      </div>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <span className="px-3 py-1 bg-slate-100 rounded-lg text-[10px] font-black text-slate-600 uppercase">
                        {Number(u.standardHours) > 0 ? `${u.standardHours}h` : 'Default'}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <span className="font-mono font-bold text-slate-900 text-sm">SR {(Number(u.grossSalary) || 0).toLocaleString()}</span>
                    </td>
                    <td className="px-8 py-5 text-right no-print">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => handleViewLogs(u)} className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all"><i className="fa-solid fa-list-check text-[10px]"></i></button>
                        <button onClick={() => setEditingUser(u)} className="w-9 h-9 rounded-xl bg-slate-50 text-slate-400 hover:text-indigo-600 transition-all"><i className="fa-solid fa-pen-to-square text-[10px]"></i></button>
                        <button onClick={() => setDeletingUser(u)} className="w-9 h-9 rounded-xl bg-slate-50 text-slate-400 hover:text-rose-600 transition-all"><i className="fa-solid fa-trash-can text-[10px]"></i></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {editingUser && (
        <UserEditModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSave={fetchData}
        />
      )}

      {/* ── DELETE MODAL ── */}
      {deletingUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[300] flex items-center justify-center p-6 no-print">
          <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-sm w-full overflow-hidden animate-fadeIn text-center p-8">
            <div className="w-20 h-20 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <i className="fa-solid fa-user-slash text-3xl"></i>
            </div>
            <h2 className="text-xl font-black text-slate-900">Remove Staff?</h2>
            <p className="text-sm text-slate-500 font-medium mt-2">Delete profile for <b>{deletingUser.name}</b>?</p>
            <div className="flex gap-3 mt-8">
              <button onClick={() => setDeletingUser(null)} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest">Cancel</button>
              <button onClick={handleConfirmDelete} disabled={isDeleting} className="flex-1 py-4 bg-rose-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-rose-600">
                {isDeleting ? <i className="fa-solid fa-circle-notch fa-spin"></i> : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── IMPORT MODAL ── */}
      {(importStatus === 'preview' || importStatus === 'importing' || importStatus === 'done') && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-[300] flex items-center justify-center p-4 no-print">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-fadeIn">

            {/* Modal Header */}
            <div className="bg-emerald-600 p-8 text-white flex-shrink-0">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-black">
                    {importStatus === 'done' ? 'Import Complete' : 'Bulk Import Preview'}
                  </h2>
                  <p className="text-[10px] font-bold text-emerald-100 uppercase tracking-[0.2em] mt-1">
                    {importStatus === 'preview' && `${validImportRows.length} ready to update · ${skippedImportRows.length} skipped`}
                    {importStatus === 'importing' && `Saving… ${importProgress}%`}
                    {importStatus === 'done' && `${importDoneCount} employees updated successfully`}
                  </p>
                </div>
                {importStatus !== 'importing' && (
                  <button onClick={() => setImportStatus('idle')} className="text-white/60 hover:text-white transition-colors">
                    <i className="fa-solid fa-circle-xmark text-2xl"></i>
                  </button>
                )}
              </div>

              {/* Progress bar */}
              {importStatus === 'importing' && (
                <div className="mt-4 h-2 bg-emerald-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-white rounded-full transition-all duration-300"
                    style={{ width: `${importProgress}%` }}
                  />
                </div>
              )}
            </div>

            {/* Done state */}
            {importStatus === 'done' && (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6">
                  <i className="fa-solid fa-circle-check text-5xl"></i>
                </div>
                <h3 className="text-xl font-black text-slate-900">{importDoneCount} profiles updated</h3>
                <p className="text-sm text-slate-500 mt-2">All valid rows have been saved to Firebase.</p>
                <button
                  onClick={() => setImportStatus('idle')}
                  className="mt-8 px-10 py-4 bg-emerald-600 text-white rounded-2xl font-black text-sm shadow-lg hover:bg-emerald-700 transition-all"
                >
                  Done
                </button>
              </div>
            )}

            {/* Preview state */}
            {importStatus === 'preview' && (
              <>
                {importRows.length === 0 ? (
                  /* No file loaded yet — show instructions */
                  <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                    <div className="w-20 h-20 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mb-6">
                      <i className="fa-solid fa-file-csv text-3xl"></i>
                    </div>
                    <h3 className="text-lg font-black text-slate-900">No file selected</h3>
                    <p className="text-sm text-slate-500 mt-2 max-w-sm">
                      Download the template first, fill in your data, then re-open this dialog by clicking <b>Bulk Import</b>.
                    </p>
                    <div className="mt-6 flex gap-3 flex-wrap justify-center">
                      <button
                        onClick={() => { setImportStatus('idle'); handleDownloadTemplate(); }}
                        className="px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow hover:bg-indigo-700 transition-all flex items-center gap-2"
                      >
                        <i className="fa-solid fa-download"></i>
                        Download Template
                      </button>
                      <button
                        onClick={() => importFileRef.current?.click()}
                        className="px-6 py-3 bg-emerald-600 text-white rounded-2xl font-black text-sm shadow hover:bg-emerald-700 transition-all flex items-center gap-2"
                      >
                        <i className="fa-solid fa-upload"></i>
                        Choose File
                      </button>
                    </div>
                    <div className="mt-8 p-5 bg-slate-50 rounded-2xl border border-slate-100 text-left text-[11px] font-bold text-slate-500 space-y-1 max-w-md">
                      <p className="font-black text-slate-700 uppercase tracking-widest text-[9px] mb-2">How it works</p>
                      <p>• <b>Staff ID</b> is used to match each row to an existing employee</p>
                      <p>• Only columns you fill in will be updated — blanks are ignored</p>
                      <p>• Import cannot create new accounts — use Add New Staff for that</p>
                      <p>• All salary figures should be in SAR with up to 2 decimal places</p>
                    </div>
                  </div>
                ) : (
                  /* File loaded — show preview table */
                  <>
                    <div className="flex-1 overflow-y-auto p-6 space-y-4">
                      {/* Valid rows */}
                      {validImportRows.length > 0 && (
                        <div>
                          <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                            <i className="fa-solid fa-circle-check"></i>
                            {validImportRows.length} employees ready to update
                          </p>
                          <div className="overflow-x-auto rounded-2xl border border-emerald-100">
                            <table className="w-full text-xs">
                              <thead className="bg-emerald-50">
                                <tr>
                                  <th className="px-4 py-3 text-left font-black text-emerald-700 uppercase text-[9px] tracking-widest">Employee</th>
                                  <th className="px-4 py-3 text-left font-black text-emerald-700 uppercase text-[9px] tracking-widest">Fields Being Updated</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-emerald-50">
                                {validImportRows.map(row => {
                                  const changedFields = CSV_COLUMNS
                                    .filter(c => c.key !== 'employeeId' && (row.data as any)[c.key] !== undefined)
                                    .map(c => c.label);
                                  return (
                                    <tr key={row.rowNum} className="bg-white">
                                      <td className="px-4 py-3">
                                        <p className="font-black text-slate-900">{row.matchedUser?.name}</p>
                                        <p className="text-[9px] font-bold text-slate-400 uppercase">{row.data.employeeId} · Row {row.rowNum}</p>
                                      </td>
                                      <td className="px-4 py-3">
                                        <div className="flex flex-wrap gap-1">
                                          {changedFields.map(f => (
                                            <span key={f} className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[9px] font-black rounded">{f}</span>
                                          ))}
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Skipped rows */}
                      {skippedImportRows.length > 0 && (
                        <div>
                          <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                            <i className="fa-solid fa-triangle-exclamation"></i>
                            {skippedImportRows.length} rows skipped
                          </p>
                          <div className="overflow-x-auto rounded-2xl border border-rose-100">
                            <table className="w-full text-xs">
                              <thead className="bg-rose-50">
                                <tr>
                                  <th className="px-4 py-3 text-left font-black text-rose-600 uppercase text-[9px] tracking-widest">Row</th>
                                  <th className="px-4 py-3 text-left font-black text-rose-600 uppercase text-[9px] tracking-widest">Staff ID</th>
                                  <th className="px-4 py-3 text-left font-black text-rose-600 uppercase text-[9px] tracking-widest">Reason</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-rose-50">
                                {skippedImportRows.map(row => (
                                  <tr key={row.rowNum} className="bg-white">
                                    <td className="px-4 py-3 font-black text-slate-500">{row.rowNum}</td>
                                    <td className="px-4 py-3 font-mono font-bold text-slate-700">{row.data.employeeId || '—'}</td>
                                    <td className="px-4 py-3">
                                      {row.errors.map((e, i) => (
                                        <p key={i} className="text-[10px] font-bold text-rose-600">{e}</p>
                                      ))}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Footer actions */}
                    <div className="p-6 border-t border-slate-100 flex gap-3 flex-shrink-0">
                      <button
                        onClick={() => { setImportStatus('idle'); setImportRows([]); }}
                        className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => importFileRef.current?.click()}
                        className="px-6 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-700 transition-all flex items-center gap-2"
                      >
                        <i className="fa-solid fa-arrow-rotate-left"></i>
                        Different File
                      </button>
                      <button
                        onClick={handleConfirmImport}
                        disabled={validImportRows.length === 0}
                        className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-100 hover:bg-emerald-700 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                      >
                        <i className="fa-solid fa-cloud-arrow-up"></i>
                        Update {validImportRows.length} Employee{validImportRows.length !== 1 ? 's' : ''}
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Utility: parse a single CSV line respecting quoted fields ────────────────
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

export default AdminUserManagement;