import React, { createContext, useContext, useState, useCallback } from 'react';
import { useLanguage } from './LanguageContext';

interface DialogConfig {
  id: string;
  title?: string;
  message: string;
  type: 'alert' | 'confirm';
  severity?: 'info' | 'warning' | 'error' | 'success';
  resolve: (value: boolean) => void;
}

interface DialogContextProps {
  showAlert: (message: string, title?: string, severity?: 'info' | 'warning' | 'error' | 'success') => Promise<void>;
  showConfirm: (message: string, title?: string, severity?: 'info' | 'warning' | 'error' | 'success') => Promise<boolean>;
}

const DialogContext = createContext<DialogContextProps | undefined>(undefined);

export const DialogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dialog, setDialog] = useState<DialogConfig | null>(null);
  const { t, isRtl } = useLanguage();

  const showAlert = useCallback((message: string, title?: string, severity: 'info' | 'warning' | 'error' | 'success' = 'info') => {
    return new Promise<void>((resolve) => {
      setDialog({
        id: Math.random().toString(),
        title,
        message,
        type: 'alert',
        severity,
        resolve: () => {
          setDialog(null);
          resolve();
        }
      });
    });
  }, []);

  const showConfirm = useCallback((message: string, title?: string, severity: 'info' | 'warning' | 'error' | 'success' = 'warning') => {
    return new Promise<boolean>((resolve) => {
      setDialog({
        id: Math.random().toString(),
        title,
        message,
        type: 'confirm',
        severity,
        resolve: (val) => {
          setDialog(null);
          resolve(val);
        }
      });
    });
  }, []);

  return (
    <DialogContext.Provider value={{ showAlert, showConfirm }}>
      {children}
      {dialog && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fadeIn">
          <div 
            className={`w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 space-y-6 transform scale-100 transition-all duration-300 animate-scaleIn ${
              isRtl ? 'text-right' : 'text-left'
            }`}
          >
            {/* Severity Icon */}
            <div className={`flex items-start gap-4 ${isRtl ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                dialog.severity === 'error' ? 'bg-rose-50 text-rose-600' :
                dialog.severity === 'success' ? 'bg-emerald-50 text-emerald-600' :
                dialog.severity === 'warning' ? 'bg-amber-50 text-amber-600' :
                'bg-indigo-50 text-indigo-600'
              }`}>
                <i className={`fa-solid text-xl ${
                  dialog.severity === 'error' ? 'fa-triangle-exclamation' :
                  dialog.severity === 'success' ? 'fa-circle-check' :
                  dialog.severity === 'warning' ? 'fa-circle-exclamation' :
                  'fa-circle-info'
                }`}></i>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-black text-slate-900 text-base leading-snug">
                  {dialog.title || (
                    dialog.severity === 'error' ? t('error') :
                    dialog.severity === 'success' ? t('success') :
                    dialog.severity === 'warning' ? t('warning') :
                    t('info')
                  )}
                </h3>
                <p className="mt-2 text-xs font-semibold text-slate-500 leading-relaxed whitespace-pre-wrap">{dialog.message}</p>
              </div>
            </div>

            {/* Actions */}
            <div className={`flex gap-3 pt-2 ${isRtl ? 'flex-row-reverse' : 'flex-row'}`}>
              {dialog.type === 'confirm' && (
                <button
                  type="button"
                  onClick={() => dialog.resolve(false)}
                  className="flex-1 py-3 px-4 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border border-slate-200 rounded-2xl font-black text-xs text-slate-600 uppercase tracking-wider transition-all"
                >
                  {t('cancel')}
                </button>
              )}
              <button
                type="button"
                onClick={() => dialog.resolve(true)}
                className={`flex-1 py-3 px-4 text-white font-black text-xs uppercase tracking-wider rounded-2xl transition-all shadow-lg ${
                  dialog.severity === 'error' ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-100' :
                  dialog.severity === 'warning' ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-100' :
                  dialog.severity === 'success' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100' :
                  'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100'
                }`}
              >
                {dialog.type === 'confirm' ? t('confirm') : t('ok')}
              </button>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
};

export const useDialog = () => {
  const context = useContext(DialogContext);
  if (!context) throw new Error('useDialog must be used within a DialogProvider');
  return context;
};
