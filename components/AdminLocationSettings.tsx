
import React, { useState, useEffect } from 'react';
import { dataService } from '../services/dataService';
import { Project, User } from '../types';

const AdminLocationSettings: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingProject, setEditingProject] = useState<Partial<Project> | null>(null);
  const [saving, setSaving] = useState(false);
  const [permissionError, setPermissionError] = useState(false);

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
      console.error("Fetch failed in Admin Settings:", err);
      if (err.code === 'permission-denied') {
        setPermissionError(true);
      }
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
      console.error(err);
      if (err.code === 'permission-denied') {
        setPermissionError(true);
      } else {
        alert('Failed to save project');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this project?')) return;
    try {
      await dataService.deleteProject(id);
      setProjects(projects.filter(p => p.id !== id));
    } catch (err: any) {
      if (err.code === 'permission-denied') setPermissionError(true);
      else alert('Delete failed');
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

  if (loading) return (
    <div className="p-20 text-center">
      <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
      <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Loading Worksites...</p>
    </div>
  );

  return (
    <div className="space-y-8 animate-fadeIn pb-20">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Worksites & Projects</h1>
          <p className="text-slate-500">Manage multiple locations and assign staff (including yourself)</p>
        </div>
        <div className="flex gap-2">
           <button 
            onClick={fetch}
            className="px-4 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl font-bold text-sm hover:bg-slate-50 transition-all flex items-center space-x-2"
            title="Refresh List"
          >
            <i className="fa-solid fa-rotate"></i>
          </button>
          {!editingProject && (
            <button 
              onClick={() => {
                setEditingProject({ 
                  name: '', 
                  geofence: { lat: 0, lng: 0, radius: 100, enabled: true },
                  assignedUserIds: [] 
                });
                setPermissionError(false);
              }}
              className="px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center space-x-2"
            >
              <i className="fa-solid fa-plus"></i>
              <span>Add New Site</span>
            </button>
          )}
        </div>
      </div>

      {permissionError && (
        <div className="bg-rose-50 border-2 border-rose-200 p-8 rounded-3xl space-y-4 animate-fadeIn">
          <div className="flex items-center space-x-4 text-rose-700">
            <div className="w-12 h-12 bg-rose-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-rose-200">
              <i className="fa-solid fa-shield-halved text-2xl"></i>
            </div>
            <div>
              <h2 className="text-xl font-black leading-none mb-1">Permission Denied</h2>
              <p className="text-sm font-bold opacity-80 uppercase tracking-wider">Action required in Firebase Rules</p>
            </div>
          </div>
          
          <div className="bg-white/80 p-6 rounded-2xl border border-rose-100 space-y-4">
            <p className="text-sm text-slate-700 leading-relaxed">
              The application is unable to <strong>list</strong> projects. Even if you can save, listing requires <code>read</code> access on the entire collection. Update your Firestore Rules:
            </p>
            <pre className="bg-slate-900 text-indigo-300 p-4 rounded-xl text-[10px] font-mono overflow-x-auto">
{`// Add this to your rules file
match /projects/{projectId} {
  allow read, write: if request.auth != null;
}

// Or if you want to restrict to admins:
match /projects/{projectId} {
  allow read, write: if request.auth != null && 
    get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
}`}
            </pre>
            <p className="text-xs text-slate-500 italic">
              After updating rules, click the refresh button above.
            </p>
          </div>
        </div>
      )}

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
                  placeholder="e.g. Takaad Project"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-900 text-sm">Enforce Geofence</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Mandatory check-in location</p>
                </div>
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Lat</label>
                  <input 
                    type="number"
                    value={editingProject.geofence?.lat}
                    onChange={(e) => setEditingProject({
                      ...editingProject,
                      geofence: { ...editingProject.geofence!, lat: parseFloat(e.target.value) }
                    })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Lng</label>
                  <input 
                    type="number"
                    value={editingProject.geofence?.lng}
                    onChange={(e) => setEditingProject({
                      ...editingProject,
                      geofence: { ...editingProject.geofence!, lng: parseFloat(e.target.value) }
                    })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg font-mono text-xs"
                  />
                </div>
              </div>

              <button 
                onClick={captureLocation}
                className="w-full py-3 bg-slate-100 text-slate-700 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all flex items-center justify-center space-x-2"
              >
                <i className="fa-solid fa-crosshairs"></i>
                <span>Use Current Location</span>
              </button>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Radius: {editingProject.geofence?.radius}m</label>
                <input 
                  type="range" min="10" max="1000" step="10"
                  value={editingProject.geofence?.radius}
                  onChange={(e) => setEditingProject({
                    ...editingProject,
                    geofence: { ...editingProject.geofence!, radius: parseInt(e.target.value) }
                  })}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
              </div>
            </div>

            <div className="flex flex-col">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 ml-1">Assign Staff</label>
              <div className="flex-1 overflow-y-auto max-h-[300px] border border-slate-100 rounded-2xl bg-slate-50 p-2 space-y-1">
                {users.length === 0 ? (
                  <div className="p-10 text-center text-slate-300 italic text-xs">No users found</div>
                ) : (
                  users.map(user => {
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
                            <p className={`text-[8px] font-black uppercase tracking-tighter ${isAssigned ? 'text-indigo-200' : 'text-slate-400'}`}>{user.role}</p>
                          </div>
                        </div>
                        {isAssigned && <i className="fa-solid fa-check text-[10px]"></i>}
                      </button>
                    );
                  })
                )}
              </div>
              <p className="text-[10px] text-slate-400 font-bold uppercase mt-2 px-2 italic">
                {editingProject.assignedUserIds?.length || 0} Staff members selected
              </p>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100 flex gap-4">
            <button 
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all disabled:opacity-50"
            >
              {saving ? <i className="fa-solid fa-circle-notch fa-spin"></i> : 'Save Project Configuration'}
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.length === 0 ? (
            <div className="col-span-full py-20 bg-white rounded-3xl border border-dashed text-center">
              <i className="fa-solid fa-map-location text-4xl text-slate-100 mb-4"></i>
              <p className="text-slate-400 font-medium">No projects found.</p>
              {permissionError && <p className="text-rose-500 text-xs font-bold mt-2 uppercase">Permission Denied</p>}
            </div>
          ) : (
            projects.map(project => (
              <div key={project.id} className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-all flex flex-col group">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
                    <i className="fa-solid fa-building-shield text-xl"></i>
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
                <div className="flex items-center space-x-2 text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">
                  <i className="fa-solid fa-location-dot"></i>
                  <span>Radius: {project.geofence.radius}m</span>
                </div>

                <div className="mt-auto pt-4 border-t border-slate-50 flex items-center justify-between">
                  <div className="flex -space-x-2">
                    {(project.assignedUserIds || []).slice(0, 4).map(uid => {
                      const u = users.find(user => user.id === uid);
                      return u ? (
                        <img key={uid} src={u.avatar || `https://ui-avatars.com/api/?name=${u.name}`} className="w-6 h-6 rounded-full border-2 border-white" title={u.name} />
                      ) : null;
                    })}
                    {(project.assignedUserIds || []).length > 4 && (
                      <div className="w-6 h-6 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[8px] font-black text-slate-500">
                        +{(project.assignedUserIds || []).length - 4}
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] font-black text-slate-300 uppercase">
                    {(project.assignedUserIds || []).length} Staff
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default AdminLocationSettings;
