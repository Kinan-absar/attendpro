
import React, { useState } from 'react';
import { dataService } from '../services/dataService';
import { User } from '../types';

interface Props {
  onLogin: (user: User) => void;
}

const Login: React.FC<Props> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [department, setDepartment] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showFixModal, setShowFixModal] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    // Normalize email to prevent credential mismatches
    const normalizedEmail = email.trim().toLowerCase();
    
    try {
      let user;
      if (isSignUp) {
        if (!name || !employeeId) {
          setError('Name and Employee ID are required for sign up.');
          setLoading(false);
          return;
        }
        user = await dataService.signup(normalizedEmail, password, name.trim(), employeeId.trim(), department.trim());
      } else {
        user = await dataService.login(normalizedEmail, password);
      }
      
      if (user) {
        onLogin(user);
      }
    } catch (err: any) {
      console.error("Login component error:", err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('Incorrect email or password. If you don\'t have an account, please use "Sign Up Now" below.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('This email is already registered. Please sign in instead.');
      } else if (err.code === 'permission-denied' || err.message?.includes('permission')) {
        setError('CRITICAL: Firestore Permission Denied. Rules must be updated in Firebase Console.');
      } else {
        setError(err.message || 'An unexpected error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-100 p-4 md:p-8">
      <div className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200 overflow-hidden transition-all duration-500">
        <div className="bg-indigo-600 p-10 text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full -ml-12 -mb-12"></div>
          
          <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center text-indigo-600 mx-auto mb-4 shadow-xl shadow-indigo-900/20 relative z-10">
            <i className={`fa-solid ${isSignUp ? 'fa-user-plus' : 'fa-clock'} text-2xl`}></i>
          </div>
          <h1 className="text-2xl font-black text-white relative z-10 tracking-tight">Attendance Pro</h1>
          <p className="text-indigo-100 text-[10px] mt-1 font-bold uppercase tracking-[0.2em] opacity-80 relative z-10">
            {isSignUp ? 'Join the workforce' : 'Workforce Identity'}
          </p>
        </div>
        
        <form onSubmit={handleSubmit} className="p-10 pb-8 space-y-6">
          {error && (
            <div className="p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl text-xs font-bold flex flex-col animate-fadeIn">
              <div className="flex items-start mb-2">
                <i className="fa-solid fa-circle-exclamation mr-3 mt-0.5 text-base flex-shrink-0"></i>
                <span>{error}</span>
              </div>
              {(error.includes('Permission') || error.includes('permission')) && (
                <button type="button" onClick={() => setShowFixModal(true)} className="mt-2 py-2 px-3 bg-rose-600 text-white rounded-lg text-[9px] uppercase font-black tracking-widest text-center hover:bg-rose-700 transition-all shadow-md">
                  <i className="fa-solid fa-screwdriver-wrench mr-2"></i>
                  Fix Database Rules Now
                </button>
              )}
            </div>
          )}

          <div className="space-y-5">
            {isSignUp && (
              <div className="animate-fadeIn">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Full Name</label>
                <input type="text" required={isSignUp} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold text-slate-700" placeholder="e.g. Mitchell Admin" value={name} onChange={e => setName(e.target.value)} />
              </div>
            )}
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Corporate Email</label>
              <div className="relative group">
                <i className="fa-solid fa-envelope absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors"></i>
                <input type="email" required className="w-full pl-12 pr-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold text-slate-700" placeholder="name@company.com" value={email} onChange={e => setEmail(e.target.value)} />
              </div>
            </div>
            {isSignUp && (
              <div className="grid grid-cols-2 gap-4 animate-fadeIn">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Staff ID</label>
                  <input type="text" required={isSignUp} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold text-slate-700" placeholder="EMP-001" value={employeeId} onChange={e => setEmployeeId(e.target.value)} />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Dept.</label>
                  <input type="text" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold text-slate-700" placeholder="Operations" value={department} onChange={e => setDepartment(e.target.value)} />
                </div>
              </div>
            )}
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Security Key</label>
              <div className="relative group">
                <i className="fa-solid fa-lock absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors"></i>
                <input type="password" required className="w-full pl-12 pr-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold text-slate-700" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} />
              </div>
            </div>
          </div>

          <button type="submit" disabled={loading} className="w-full bg-indigo-600 text-white font-black py-4 rounded-2xl hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 active:scale-[0.98] disabled:opacity-50 mt-4 text-sm tracking-tight">
            {loading ? <i className="fa-solid fa-circle-notch fa-spin mr-2"></i> : (isSignUp ? 'Create Workforce Account' : 'Sign into Dashboard')}
          </button>

          <div className="pt-2 text-center">
            <button type="button" onClick={() => { setIsSignUp(!isSignUp); setError(''); }} className="text-[10px] font-black text-slate-400 hover:text-indigo-600 transition-colors uppercase tracking-[0.1em]">
              {isSignUp ? 'Already have an account? Sign In' : 'Need an account? Sign Up Now'}
            </button>
          </div>

          {/* CORPORATE BRANDING FOOTER */}
          <div className="pt-8 text-center border-t border-slate-50">
            <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">
              Absar Alomran Construction Co.
            </p>
          </div>
        </form>
      </div>

      {/* PWA INSTRUCTIONS */}
      <div className="mt-8 px-4 text-center max-w-sm animate-fadeIn">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
          For the best experience, use <span className="text-indigo-600">Safari</span> on iOS or <span className="text-indigo-600">Chrome</span> on Android and select "Add to Home Screen" from your browser menu.
        </p>
      </div>

      {showFixModal && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-xl z-[500] flex items-center justify-center p-6">
          <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-2xl w-full overflow-hidden animate-fadeIn">
            <div className="bg-rose-600 p-8 text-white flex justify-between items-center">
              <div>
                <h2 className="text-xl font-black flex items-center"><i className="fa-solid fa-shield-halved mr-3"></i>Permission Fix Guide</h2>
                <p className="text-xs text-rose-100 uppercase tracking-widest font-bold mt-1">Firestore Database Access</p>
              </div>
              <button onClick={() => setShowFixModal(false)} className="text-rose-200 hover:text-white transition-colors"><i className="fa-solid fa-circle-xmark text-2xl"></i></button>
            </div>
            <div className="p-8 space-y-6">
              <pre className="bg-slate-50 p-6 rounded-2xl border border-slate-200 text-[10px] font-mono text-slate-600 overflow-x-auto select-all max-h-[250px] leading-relaxed">
                {dataService.getRecommendedRules()}
              </pre>
              <div className="flex justify-end pt-4 border-t border-slate-100">
                <button onClick={() => setShowFixModal(false)} className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg">I have published the rules</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
