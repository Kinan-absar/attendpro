import React, { useState, useEffect } from 'react';
import { dataService } from '../services/dataService';
import Linkify from './Linkify';
import { Broadcast, Project, User } from '../types';
import { useLanguage } from '../utils/LanguageContext';
import { useDialog } from '../utils/DialogContext';

const AdminBroadcastManagement: React.FC = () => {
  const { t, isRtl } = useLanguage();
  const { showAlert, showConfirm } = useDialog();
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Broadcast> | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [bData, pData, uData] = await Promise.all([
        dataService.getAllBroadcasts(),
        dataService.getProjects(),
        dataService.getUsers()
      ]);
      setBroadcasts(bData);
      setProjects(pData);
      setUsers(uData);
    } catch (err) {
      console.error("Failed to fetch notice board data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSave = async () => {
    if (!editing?.title || !editing?.message) {
      await showAlert(t('headlineMessageRequired'), t('warning'), 'warning');
      return;
    }
    setSaving(true);
    try {
      await dataService.saveBroadcast(editing);
      await fetchData();
      setEditing(null);
    } catch (err: any) {
      await showAlert(`Save failed: ${err.message || 'Check Firestore permissions'}`, t('error'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const isConfirmed = await showConfirm(t('confirmDeleteNotice'), t('warning'), 'warning');
    if (!isConfirmed) return;
    setDeletingId(id);
    try {
      await dataService.deleteBroadcast(id);
      await fetchData();
    } catch (err: any) {
      console.error("Delete failed:", err);
      await showAlert(`Delete failed: ${err.message || 'Check Firestore rules'}`, t('error'), 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const toggleActive = async (broadcast: Broadcast) => {
    try {
      await dataService.saveBroadcast({ ...broadcast, active: !broadcast.active });
      await fetchData();
    } catch (err: any) {
      await showAlert(`Update failed: ${err.message}`, t('error'), 'error');
    }
  };

  const toggleTargetProject = (id: string) => {
    const current = editing?.targetProjectIds || [];
    const updated = current.includes(id) ? current.filter(pid => pid !== id) : [...current, id];
    setEditing(prev => ({ ...prev, targetProjectIds: updated }));
  };

  const toggleTargetUser = (id: string) => {
    const current = editing?.targetUserIds || [];
    const updated = current.includes(id) ? current.filter(uid => uid !== id) : [...current, id];
    setEditing(prev => ({ ...prev, targetUserIds: updated }));
  };

  if (loading && broadcasts.length === 0) return (
    <div className="p-20 text-center">
      <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
      <p className="text-slate-400 font-black text-xs uppercase tracking-widest">{t('syncingNoticeBoard')}</p>
    </div>
  );

  return (
    <div className={`space-y-8 animate-fadeIn pb-20 ${isRtl ? 'text-right' : 'text-left'}`}>
      <div className={`flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${isRtl ? 'md:flex-row-reverse' : ''}`}>
        <div className="text-start">
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">{t('noticeBoard')}</h1>
          <p className="text-slate-500">{t('noticeBoardSub')}</p>
        </div>
        {!editing && (
          <button 
            onClick={() => setEditing({ title: '', message: '', type: 'info', active: true, targetProjectIds: [], targetUserIds: [] })}
            className={`px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-lg hover:bg-indigo-700 transition-all flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}
          >
            <i className="fa-solid fa-plus"></i>
            <span>{t('newNoticeBtn')}</span>
          </button>
        )}
      </div>

      {editing ? (
        <div className="max-w-4xl bg-white rounded-3xl border border-slate-100 shadow-xl p-8 space-y-8 animate-fadeIn">
          <div className={`flex justify-between items-center ${isRtl ? 'flex-row-reverse' : ''}`}>
            <h2 className="text-xl font-black text-slate-900">{editing.id ? t('editNoticeTitle') : t('postNewNoticeTitle')}</h2>
            <button onClick={() => setEditing(null)} className="text-slate-400 hover:text-slate-600">
              <i className="fa-solid fa-xmark text-xl"></i>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1 text-start">{t('priorityLabel')}</label>
                <div className={`flex gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                  {['info', 'warning', 'urgent'].map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setEditing({ ...editing, type: type as any })}
                      className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase border transition-all ${
                        editing.type === type 
                          ? (type === 'urgent' ? 'bg-rose-600 border-rose-600 text-white' : type === 'warning' ? 'bg-amber-500 border-amber-500 text-white' : 'bg-indigo-600 border-indigo-600 text-white') 
                          : 'bg-slate-50 border-slate-200 text-slate-400'
                      }`}
                    >
                      {t(type) || type}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1 text-start">{t('subjectLabel')}</label>
                <input 
                  type="text"
                  value={editing.title}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                  placeholder={t('subjectPlaceholder')}
                  className={`w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all ${isRtl ? 'text-right' : 'text-left'}`}
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1 text-start">{t('messageDetailLabel')}</label>
                <textarea 
                  rows={4}
                  value={editing.message}
                  onChange={(e) => setEditing({ ...editing, message: e.target.value })}
                  placeholder={t('messagePlaceholder')}
                  className={`w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all ${isRtl ? 'text-right' : 'text-left'}`}
                />
              </div>

              <div className={`flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200 ${isRtl ? 'flex-row-reverse' : ''}`}>
                <div className="text-start">
                    <p className="text-xs font-black text-slate-900 uppercase">{t('status')}</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{t('activeOnBoards')}</p>
                </div>
                <button 
                  type="button"
                  onClick={() => setEditing({ ...editing, active: !editing.active })}
                  className={`w-12 h-6 rounded-full relative transition-all duration-300 ${editing.active ? 'bg-indigo-600' : 'bg-slate-300'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 shadow-sm ${editing.active ? (isRtl ? 'right-7' : 'left-7') : (isRtl ? 'right-1' : 'left-1')}`}></div>
                </button>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1 text-start">{t('targetWorksitesMulti')}</label>
                <div className="max-h-[160px] overflow-y-auto border border-slate-100 rounded-2xl bg-slate-50 p-2 space-y-1 no-scrollbar shadow-inner">
                  {projects.map(p => {
                    const selected = editing.targetProjectIds?.includes(p.id);
                    return (
                      <button key={p.id} type="button" onClick={() => toggleTargetProject(p.id)} className={`w-full text-start p-3 rounded-xl transition-all flex items-center justify-between ${isRtl ? 'flex-row-reverse' : ''} ${selected ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600'}`}>
                        <span className="text-xs font-bold">{p.name}</span>
                        {selected && <i className="fa-solid fa-check text-[10px]"></i>}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1 text-start">{t('targetPersonnelMulti')}</label>
                <div className="max-h-[160px] overflow-y-auto border border-slate-100 rounded-2xl bg-slate-50 p-2 space-y-1 no-scrollbar shadow-inner">
                  {users.map(u => {
                    const selected = editing.targetUserIds?.includes(u.id);
                    return (
                      <button key={u.id} type="button" onClick={() => toggleTargetUser(u.id)} className={`w-full text-start p-3 rounded-xl transition-all flex items-center justify-between ${isRtl ? 'flex-row-reverse' : ''} ${selected ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600'}`}>
                        <div className={`flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                           <img src={u.avatar || `https://ui-avatars.com/api/?name=${u.name}`} className="w-5 h-5 rounded-full border border-white/20" alt="" />
                           <span className="text-xs font-bold">{u.name}</span>
                        </div>
                        {selected && <i className="fa-solid fa-check text-[10px]"></i>}
                      </button>
                    );
                  })}
                </div>
              </div>
              
              <div className={`p-4 rounded-2xl border text-center transition-all ${!editing.targetProjectIds?.length && !editing.targetUserIds?.length ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
                 <p className="text-[10px] font-black uppercase tracking-widest">
                   {!editing.targetProjectIds?.length && !editing.targetUserIds?.length 
                     ? t('broadcastGlobal') 
                     : t('broadcastTargeted')}
                 </p>
              </div>
            </div>
          </div>

          <div className={`pt-6 border-t border-slate-100 flex gap-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <button onClick={() => setEditing(null)} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all">{t('cancel')}</button>
            <button onClick={handleSave} disabled={saving} className="flex-2 py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all disabled:opacity-50">
              {saving ? <i className="fa-solid fa-circle-notch fa-spin"></i> : (editing.id ? t('saveStaffBtn') : t('publishNoticeBtn'))}
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {broadcasts.map(b => (
            <div key={b.id} className={`bg-white rounded-[2.5rem] border border-slate-100 p-6 shadow-sm hover:shadow-md transition-all flex flex-col group ${!b.active ? 'opacity-50 grayscale' : ''} ${isRtl ? 'text-right' : 'text-left'}`}>
              <div className={`flex justify-between items-start mb-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                  b.type === 'urgent' ? 'bg-rose-50 text-rose-500' :
                  b.type === 'warning' ? 'bg-amber-50 text-amber-500' :
                  'bg-indigo-50 text-indigo-500'
                }`}>
                  <i className={`fa-solid ${b.type === 'urgent' ? 'fa-triangle-exclamation' : b.type === 'warning' ? 'fa-circle-info' : 'fa-bullhorn'} text-xl`}></i>
                </div>
                <div className={`flex gap-1 opacity-0 group-hover:opacity-100 transition-all ${isRtl ? 'flex-row-reverse' : ''}`}>
                  <button onClick={() => setEditing(b)} className="w-9 h-9 rounded-xl bg-slate-50 text-slate-400 hover:text-indigo-600 transition-all">
                    <i className="fa-solid fa-pen-to-square text-xs"></i>
                  </button>
                  <button 
                    onClick={() => handleDelete(b.id)} 
                    disabled={deletingId === b.id}
                    className="w-9 h-9 rounded-xl bg-slate-50 text-slate-400 hover:text-rose-600 transition-all flex items-center justify-center"
                  >
                    {deletingId === b.id ? <i className="fa-solid fa-circle-notch fa-spin text-[10px]"></i> : <i className="fa-solid fa-trash-can text-xs"></i>}
                  </button>
                </div>
              </div>

              <h3 className="text-lg font-black text-slate-900 mb-1 leading-tight text-start">{b.title}</h3>
              <Linkify text={b.message} className="text-xs text-slate-500 font-medium mb-6 line-clamp-3 leading-relaxed block text-start" />

              <div className={`flex flex-wrap gap-1 mb-6 ${isRtl ? 'flex-row-reverse' : ''}`}>
                {!b.targetProjectIds?.length && !b.targetUserIds?.length ? (
                   <span className="px-2 py-1 bg-slate-100 text-slate-400 text-[8px] font-black uppercase rounded tracking-widest">{t('global') || 'Global'}</span>
                ) : (
                  <>
                    {b.targetProjectIds?.length > 0 && <span className="px-2 py-1 bg-indigo-50 text-indigo-600 text-[8px] font-black uppercase rounded tracking-widest">{t('siteRestrict') || 'Site Restrict'}</span>}
                    {b.targetUserIds?.length > 0 && <span className="px-2 py-1 bg-emerald-50 text-emerald-600 text-[8px] font-black uppercase rounded tracking-widest">{t('personTarget') || 'Person Target'}</span>}
                  </>
                )}
              </div>

              <div className={`mt-auto pt-4 border-t border-slate-50 flex items-center justify-between ${isRtl ? 'flex-row-reverse' : ''}`}>
                <button 
                  onClick={() => toggleActive(b)}
                  className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${
                    b.active ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-slate-100 border-slate-200 text-slate-400'
                  }`}
                >
                  {b.active ? t('active') : t('hidden')}
                </button>
                <div className={`${isRtl ? 'text-left' : 'text-right'}`}>
                  <p className="text-[9px] font-black text-slate-300 uppercase leading-none">{b.createdAt.toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          ))}
          {broadcasts.length === 0 && (
             <div className="col-span-full py-20 bg-white rounded-[2.5rem] border border-dashed border-slate-200 text-center">
                <i className="fa-solid fa-clipboard-list text-4xl text-slate-100 mb-4 block"></i>
                <p className="text-slate-400 font-black uppercase tracking-widest text-xs">{t('noticeBoardClear')}</p>
             </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminBroadcastManagement;
