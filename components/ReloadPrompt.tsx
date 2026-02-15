
import React, { useEffect } from 'react';
// @ts-ignore: virtual module provided by vite-plugin-pwa
import { useRegisterSW } from 'virtual:pwa-register/react';

const ReloadPrompt: React.FC = () => {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      if (r) {
        // Check for updates every hour while the app is running
        setInterval(() => {
          r.update().catch(console.error);
        }, 60 * 60 * 1000);
      }
    },
    onRegisterError(error) {
      // Common in sandboxes (origin mismatch) - safe to ignore for local/prod
      console.warn('PWA Registration notice:', error);
    },
  });

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  // iOS Reliability Fix: Force a service worker update check whenever the user
  // opens the app from their home screen (re-entry).
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        navigator.serviceWorker?.getRegistration().then(reg => {
          reg?.update();
        });
      }
    };
    window.addEventListener('visibilitychange', handleVisibility);
    return () => window.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  if (!offlineReady && !needRefresh) return null;

  return (
    <div className="fixed bottom-24 left-4 right-4 md:left-auto md:right-8 md:bottom-8 z-[2000] animate-fadeIn no-print">
      <div className="bg-slate-900 text-white p-5 rounded-[2rem] shadow-2xl border border-white/10 flex items-center justify-between gap-4 max-w-md">
        <div className="flex items-center gap-4">
          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${needRefresh ? 'bg-indigo-500 animate-pulse' : 'bg-emerald-500'}`}>
            <i className={`fa-solid ${needRefresh ? 'fa-cloud-arrow-down' : 'fa-check'} text-sm`}></i>
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-widest leading-none mb-1">
              {needRefresh ? 'Update Available' : 'App Ready'}
            </p>
            <p className="text-[10px] font-medium text-slate-400">
              {needRefresh ? 'A newer version is ready to install.' : 'You can now use this app offline.'}
            </p>
          </div>
        </div>
        
        <div className="flex gap-2">
          {needRefresh && (
            <button
              onClick={() => updateServiceWorker(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95"
            >
              Update
            </button>
          )}
          <button
            onClick={close}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReloadPrompt;
