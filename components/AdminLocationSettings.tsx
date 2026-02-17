
import React, { useState, useEffect, useMemo } from 'react';
import { dataService } from '../services/dataService';
import { Project, User } from '../types';

const AdminLocationSettings: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingProject, setEditingProject] = useState<Partial<Project> | null>(null);
  const [saving, setSaving] = useState(false);
  const [permissionError, setPermissionError] = useState(false);
  const [userSearch, setUserSearch] = useState('');

  const fetch = async () => {
    setLoading(true);
    setPermissionError(false);
    try {
      const [p, u] = await Promise.all([
        dataService.getProjects(),
        dataService.getUsers()
      ]);
      setProjects(p);
      setUsers(u);
    } catch (err: any) {
      console.error(err);
      if (err.code === 'permission-denied') setPermissionError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch();
  }, []);

  const handleSave = async () => {
    if (!editingProject?.name) return alert('Please enter project name');
    setSaving(true);
    try {
      const projectToSave = {
        ...editingProject,
        assignedUserIds: editingProject.assignedUserIds || []
      };
      await dataService.saveProject(projectToSave);
      await fetch();
      setEditingProject(null);
    } catch (err: any) {
      alert('Failed to save project');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure?')) return;
    try {
      await dataService.deleteProject(id);
      setProjects(projects.filter(p => p.id !== id));
    } catch (err: any) {
      alert('Delete failed');
    }
  };

  const captureLocation = () => {
    if (!navigator.geolocation) return alert("Geolocation not supported");
    navigator.geolocation.getCurrentPosition((pos) => {
      setEditingProject(prev => ({
        ...prev,
        geofence: {
          ...(prev?.geofence || { enabled: true, radius: 100 }),
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        }
      }));
    });
  };

  const toggleUserAssignment = (userId: string) => {
    setEditingProject(prev => {
      const assigned = prev?.assignedUserIds || [];
      const newAssigned = assigned.includes(userId)
        ? assigned.filter(id => id !== userId)
        : [...assigned, userId];
      return { ...prev, assignedUserIds: newAssigned };
    });
  };

  const filteredUsersToAssign = useMemo(() => {
    const s = userSearch.toLowerCase();
    return users.filter(u => 
      u.name.toLowerCase().includes(s) || 
      u.employeeId.toLowerCase().includes(s)
    ).sort((a, b) => a.name.localeCompare(b.name));
  }, [users, userSearch]);

  if (loading) return (
    <div className="p-20 text-center">
      <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
    </div>
  );

  return (
    <div className="space-y-8 animate-fadeIn pb-20">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Worksites & Projects</h1>
          <p className="text-slate-500">Manage location-based geofencing and staff clusters</p>
        </div>
        <button 
          onClick={() => {
            setEditingProject({ 
              name: '', 
              geofence: { lat: 0, lng: 0, radius: 100, enabled: true },
              assignedUserIds: [] 
            });
            setUserSearch('');
          }}
          className="px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-lg hover:bg-indigo-700 transition-all"
        >
          Add New Site
        </button>
      </div>

      {editingProject ? (
        <div className="max-w-4xl bg-white rounded-3xl border border-slate-100 shadow-xl p-8 space-y-8 animate-fadeIn">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-black text-slate-900">{editingProject.id ? 'Edit Worksite' : 'New Worksite'}</h2>
            <button onClick={() => setEditingProject(null)} className="text-slate-400 hover:text-slate-600">
              <i className="fa-solid fa-xmark text-xl"></i>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Project Name</label>
                <input 
                  type="text"
                  value={editingProject.name}
                  onChange={(e) => setEditingProject({ ...editingProject, name: e.target.value })}
                  placeholder="e.g. Building A Site"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none"
                />
              </div>

              <div className={`p-4 rounded-2xl border ${editingProject.geofence?.enabled ? 'bg-indigo-50 border-indigo-100' : 'bg-slate-50 border-slate-200 opacity-60'}`}>
                <div className="flex items-center justify-between mb-4">
                  <span className="font-bold text-slate-900 text-sm">Geofence Boundary</span>
                  <button 
                    onClick={() => setEditingProject({
                      ...editingProject,
                      geofence: { ...editingProject.geofence!, enabled: !editingProject.geofence?.enabled }
                    })}
                    className={`w-12 h-6 rounded-full relative transition-all ${editingProject.geofence?.enabled ? 'bg-indigo-600' : 'bg-slate-300'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${editingProject.geofence?.enabled ? 'left-7' : 'left-1'}`}></div>
                  </button>
                </div>

                {editingProject.geofence?.enabled && (
                  <div className="space-y-4 animate-fadeIn">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Lat</label>
                        <input type="number" step="any" value={editingProject.geofence?.lat} onChange={(e) => setEditingProject({...editingProject, geofence: {...editingProject.geofence!, lat: parseFloat(e.target.value)}})} className="w-full px-3 py-2 border rounded-lg text-xs" />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Lng</label>
                        <input type="number" step="any" value={editingProject.geofence?.lng} onChange={(e) => setEditingProject({...editingProject, geofence: {...editingProject.geofence!, lng: parseFloat(e.target.value)}})} className="w-full px-3 py-2 border rounded-lg text-xs" />
                      </div>
                    </div>
                    <button onClick={captureLocation} className="w-full py-2 bg-white border border-slate-200 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-slate-50">Capture My GPS</button>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Radius: {editingProject.geofence?.radius}m</label>
                      <input type="range" min="10" max="1000" step="10" value={editingProject.geofence?.radius} onChange={(e) => setEditingProject({...editingProject, geofence: {...editingProject.geofence!, radius: parseInt(e.target.value)}})} className="w-full h-2 bg-indigo-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Assign Staff</label>
              
              <div className="mb-3 relative group">
                 <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors"></i>
                 <input 
                  type="text" 
                  placeholder="Find staff..." 
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                 />
              </div>

              <div className="flex-1 overflow-y-auto max-h-[300px] border border-slate-100 rounded-2xl bg-slate-50 p-2 space-y-1 no-scrollbar shadow-inner">
                {filteredUsersToAssign.length === 0 ? (
                  <div className="py-10 text-center opacity-40">
                    <p className="text-[10px] font-black uppercase tracking-widest">No matching staff</p>
                  </div>
                ) : filteredUsersToAssign.map(user => {
                  const isAssigned = editingProject.assignedUserIds?.includes(user.id);
                  return (
                    <button
                      key={user.id}
                      onClick={() => toggleUserAssignment(user.id)}
                      className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${
                        isAssigned ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-100'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <img src={user.avatar || `https://ui-avatars.com/api/?name=${user.name}`} className="w-6 h-6 rounded-full border border-white/20" />
                        <div className="text-left">
                          <p className="text-xs font-bold leading-none">{user.name}</p>
                          <p className={`text-[8px] font-black uppercase tracking-tighter ${isAssigned ? 'text-indigo-200' : 'text-slate-400'}`}>{user.employeeId}</p>
                        </div>
                      </div>
                      {isAssigned && <i className="fa-solid fa-check text-[10px]"></i>}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100 flex gap-4">
            <button onClick={() => setEditingProject(null)} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="flex-2 py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-indigo-100 hover:bg-indigo-700 disabled:opacity-50 transition-all">
              {saving ? <i className="fa-solid fa-circle-notch fa-spin"></i> : 'Apply Changes'}
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map(project => (
            <div key={project.id} className="bg-white rounded-[2rem] border border-slate-100 p-6 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
              <div className="flex justify-between items-start mb-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${project.geofence.enabled ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'}`}>
                  <i className={`fa-solid ${project.geofence.enabled ? 'fa-building-shield' : 'fa-globe'} text-xl`}></i>
                </div>
                <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-all">
                  <button onClick={() => setEditingProject(project)} className="w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-indigo-600 transition-colors">
                    <i className="fa-solid fa-pen-to-square text-xs"></i>
                  </button>
                  <button onClick={() => handleDelete(project.id)} className="w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-rose-600 transition-colors">
                    <i className="fa-solid fa-trash-can text-xs"></i>
                  </button>
                </div>
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-1">{project.name}</h3>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">
                {project.geofence.enabled ? `${project.geofence.radius}m Safe Zone` : 'Flexible Site'}
              </p>
              <div className="mt-auto pt-4 border-t border-slate-50 flex items-center justify-between">
                <div className="flex -space-x-2">
                  {(project.assignedUserIds || []).slice(0, 4).map(uid => {
                    const u = users.find(user => user.id === uid);
                    return u ? <img key={uid} src={u.avatar || `https://ui-avatars.com/api/?name=${u.name}`} className="w-6 h-6 rounded-full border-2 border-white shadow-sm" /> : null;
                  })}
                </div>
                <span className="text-[10px] font-black text-slate-300 uppercase">
                  {(project.assignedUserIds || []).length} Personnel
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminLocationSettings;
