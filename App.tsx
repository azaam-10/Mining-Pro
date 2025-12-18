
import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { 
  Home as HomeIcon, Cpu, ListTodo, Users, User as UserIcon, 
  ArrowDownCircle, ArrowUpCircle, History, TrendingUp, 
  CheckCircle2, Clock, XCircle, Loader2, ShieldCheck, 
  Lock, HelpCircle, X, Wallet, Activity, Copy, 
  UploadCloud, ArrowDown, ArrowRight, Zap, Globe, 
  Database, BarChart3, Crown, Info, Layers, 
  Star, Timer, Gem, Flame, Rocket, ShieldAlert, 
  Diamond, Medal, ShieldAlert as ShieldIcon,
  LogOut, Mail, Key, UserPlus
} from 'lucide-react';
import { Language, UserState, UserMachine, Machine, Transaction } from './types';
import { TRANSLATIONS, MACHINES, DEPOSIT_ADDRESS, MIN_WITHDRAWAL, REFERRAL_PERCENT } from './constants';
import { supabase } from './supabase';

const formatDate = (date: Date) => date.toISOString().split('T')[0];

const getNextTaskTime = () => {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  const diff = tomorrow.getTime() - now.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

interface Toast {
  message: string;
  type: 'success' | 'error' | 'info';
  id: number;
}

const App: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [lang, setLang] = useState<Language>('ar');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [showInfo, setShowInfo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [userData, setUserData] = useState<UserState | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchAllUserData(session.user.id);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        setLoading(true);
        fetchAllUserData(session.user.id);
      } else {
        setUserData(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchAllUserData = async (userId: string) => {
    try {
      // 1. Fetch Profile
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single();
      
      // 2. Fetch Owned Machines
      const { data: machines } = await supabase.from('user_machines').select('*').eq('user_id', userId);
      
      // 3. Fetch Transactions
      const { data: txs } = await supabase.from('transactions').select('*').eq('user_id', userId).order('date', { ascending: false });

      if (profile) {
        setUserData({
          ...profile,
          ownedMachines: machines || [],
          transactions: txs || [],
          lastWithdrawDate: profile.last_withdraw_date || null
        });
      }
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { message, type, id }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  const t = (key: string) => TRANSLATIONS[key]?.[lang] || key;

  // شراء ماكينة جديدة
  const buyMachine = async (machine: Machine) => {
    if (!userData || userData.ownedMachines.length >= 3) {
      showToast(t('maxMachinesReached'), 'error');
      return;
    }
    if (userData.balance < machine.price) {
      showToast(t('insufficientBalance'), 'error');
      return;
    }

    showToast(lang === 'ar' ? 'جاري معالجة الطلب...' : 'Processing request...', 'info');

    // 1. إضافة الماكينة للمستخدم
    const { error: machineErr } = await supabase.from('user_machines').insert({
      user_id: session.user.id,
      machine_id: machine.id,
      remaining_days: machine.duration,
      total_earned: 0
    });

    if (machineErr) return showToast(machineErr.message, 'error');

    // 2. تحديث الرصيد
    const newBalance = userData.balance - machine.price;
    await supabase.from('profiles').update({ balance: newBalance }).eq('id', session.user.id);

    showToast(t('transactionCompleted'), 'success');
    fetchAllUserData(session.user.id);
  };

  // تنفيذ المهمة اليومية (حصاد الأرباح)
  const completeTask = async (userMachine: UserMachine) => {
    const today = formatDate(new Date());
    if (userMachine.last_claim_date === today) return;

    const machine = MACHINES.find(m => m.id === userMachine.machine_id);
    if (!machine) return;

    showToast(lang === 'ar' ? 'جاري تحويل الأرباح...' : 'Transferring profits...', 'info');

    // 1. تحديث الماكينة (تاريخ المطالبة، الرصيد المحقق، الأيام المتبقية)
    const { error: updateErr } = await supabase.from('user_machines').update({
      last_claim_date: today,
      total_earned: userMachine.total_earned + machine.dailyProfit,
      remaining_days: userMachine.remaining_days - 1
    }).eq('id', userMachine.id);

    if (updateErr) return showToast(updateErr.message, 'error');

    // 2. تحديث رصيد المستخدم (الكلي والقابل للسحب)
    const newBalance = userData!.balance + machine.dailyProfit;
    const newWithdrawable = userData!.withdrawableBalance + machine.dailyProfit;
    
    await supabase.from('profiles').update({ 
      balance: newBalance,
      withdrawable_balance: newWithdrawable 
    }).eq('id', session.user.id);

    // 3. إضافة عملية في السجل
    await supabase.from('transactions').insert({
      user_id: session.user.id,
      type: 'task',
      amount: machine.dailyProfit,
      status: 'completed',
      details: `Daily profit from ${machine.name}`
    });

    showToast(t('transactionCompleted'), 'success');
    fetchAllUserData(session.user.id);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-500" size={48} />
      </div>
    );
  }

  if (!session) {
    return <AuthView lang={lang} setLang={setLang} t={t} showToast={showToast} />;
  }

  // If we have a session but userData is still null (e.g., fetch failed or profile trigger delayed)
  if (!userData) {
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center gap-4 p-10 text-center">
        <Loader2 className="animate-spin text-blue-500" size={48} />
        <div className="space-y-2">
          <p className="text-white font-black italic tracking-tighter uppercase text-sm">Initializing Secure Profile...</p>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em]">Authenticating with V-Protocol Maingate</p>
        </div>
        <button 
          onClick={() => supabase.auth.signOut()} 
          className="mt-8 px-6 py-3 bg-red-500/10 text-red-500 rounded-xl border border-red-500/20 font-black text-[10px] uppercase tracking-widest"
        >
          {lang === 'ar' ? 'تسجيل الخروج' : 'Cancel & Sign Out'}
        </button>
      </div>
    );
  }

  return (
    <div className={`min-h-screen pb-28 ${lang === 'ar' ? 'rtl text-right font-["Cairo"]' : 'text-left font-sans'} bg-[#020617] text-[#f8fafc] overflow-x-hidden relative`}>
      {showInfo && <InfoModal t={t} onClose={() => setShowInfo(false)} />}
      
      <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[100] w-full max-w-[90%] space-y-2.5 pointer-events-none">
        {toasts.map(toast => (
          <div key={toast.id} className={`flex items-center gap-3.5 p-4.5 rounded-2xl shadow-2xl pointer-events-auto backdrop-blur-3xl border ${
            toast.type === 'error' ? 'bg-red-500/30 border-red-500/50 text-red-100' : 
            toast.type === 'success' ? 'bg-blue-600/30 border-blue-600/50 text-blue-100' : 
            'bg-slate-900/80 border-slate-700/50 text-slate-100'
          }`}>
            <div className={`p-2 rounded-xl ${toast.type === 'error' ? 'bg-red-500/20' : 'bg-blue-500/20'}`}>
              {toast.type === 'error' && <XCircle size={18} />}
              {toast.type === 'success' && <CheckCircle2 size={18} />}
              {toast.type === 'info' && <Info size={18} />}
            </div>
            <span className="text-[13px] font-black tracking-tighter italic">{toast.message}</span>
          </div>
        ))}
      </div>

      <header className="p-5 border-b border-white/5 backdrop-blur-2xl sticky top-0 z-40 bg-[#020617]/90">
        <div className="max-w-md mx-auto flex justify-between items-center px-1">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center shadow-lg relative overflow-hidden">
              <Zap size={22} className="text-white fill-white relative z-10" />
            </div>
            <div className="flex flex-col">
              <span className="font-black italic tracking-tighter text-2xl leading-none">MINE<span className="text-blue-500">PRO</span></span>
              <span className="text-[8px] font-black uppercase tracking-[0.4em] text-blue-500/80 mt-1">V-PROTOCOL ELITE</span>
            </div>
          </div>
          <button onClick={() => supabase.auth.signOut()} className="p-2.5 bg-red-500/10 text-red-500 rounded-xl border border-red-500/20 active:scale-95 transition-all">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <main className="max-w-md mx-auto p-5 space-y-10 relative z-10">
        <Routes>
          <Route path="/" element={<HomeView user={userData} t={t} onShowInfo={() => setShowInfo(true)} />} />
          <Route path="/machines" element={<MachinesView user={userData} onBuy={buyMachine} t={t} />} />
          <Route path="/tasks" element={<TasksView user={userData} onComplete={completeTask} t={t} />} />
          <Route path="/team" element={<TeamView user={userData} t={t} />} />
          <Route path="/profile" element={<ProfileView user={userData} t={t} />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-[#020617]/95 backdrop-blur-3xl border-t border-white/5 p-5 z-40">
        <div className="max-w-md mx-auto flex justify-around items-end">
          <NavItem icon={HomeIcon} label={t('home')} active={location.pathname === '/'} onClick={() => navigate('/')} />
          <NavItem icon={Cpu} label={t('machines')} active={location.pathname === '/machines'} onClick={() => navigate('/machines')} />
          <NavItem icon={ListTodo} label={t('tasks')} active={location.pathname === '/tasks'} onClick={() => navigate('/tasks')} />
          <NavItem icon={Users} label={t('team')} active={location.pathname === '/team'} onClick={() => navigate('/team')} />
          <NavItem icon={UserIcon} label={t('profile')} active={location.pathname === '/profile'} onClick={() => navigate('/profile')} />
        </div>
      </nav>
    </div>
  );
};

const AuthView = ({ lang, setLang, t, showToast }: any) => {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ firstName: '', lastName: '', email: '', password: '', referralCode: '' });

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email: formData.email, password: formData.password });
      if (error) showToast(error.message, 'error');
    } else {
      const { error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: { data: { first_name: formData.firstName, last_name: formData.lastName, referred_by: formData.referralCode } }
      });
      if (error) showToast(error.message, 'error');
      else showToast(lang === 'ar' ? 'تحقق من بريدك الإلكتروني لتفعيل الحساب!' : 'Check your email to verify account!', 'success');
    }
    setLoading(false);
  };

  return (
    <div className={`min-h-screen bg-[#020617] p-6 flex flex-col justify-center ${lang === 'ar' ? 'rtl text-right font-["Cairo"]' : ''}`}>
      <div className="max-w-md mx-auto w-full space-y-8">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl mx-auto flex items-center justify-center shadow-[0_0_30px_rgba(37,99,235,0.4)]">
            <Zap size={32} className="text-white fill-white" />
          </div>
          <h1 className="text-3xl font-black italic tracking-tighter">MINE<span className="text-blue-500">PRO</span></h1>
        </div>

        <div className="bg-[#0b0f1a] border border-white/10 rounded-[2.5rem] p-8 shadow-2xl space-y-6">
          <div className="flex bg-[#020617] p-1.5 rounded-2xl border border-white/5">
            <button onClick={() => setIsLogin(true)} className={`flex-1 py-3 rounded-xl font-black text-xs transition-all ${isLogin ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500'}`}>{lang === 'ar' ? 'دخول' : 'Login'}</button>
            <button onClick={() => setIsLogin(false)} className={`flex-1 py-3 rounded-xl font-black text-xs transition-all ${!isLogin ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500'}`}>{lang === 'ar' ? 'حساب جديد' : 'Sign Up'}</button>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            {!isLogin && (
              <div className="grid grid-cols-2 gap-4">
                <Input icon={UserIcon} placeholder={lang === 'ar' ? 'الاسم الأول' : 'First Name'} value={formData.firstName} onChange={(v: string) => setFormData({...formData, firstName: v})} />
                <Input icon={UserIcon} placeholder={lang === 'ar' ? 'الاسم الأخير' : 'Last Name'} value={formData.lastName} onChange={(v: string) => setFormData({...formData, lastName: v})} />
              </div>
            )}
            <Input icon={Mail} type="email" placeholder={lang === 'ar' ? 'البريد الإلكتروني' : 'Email Address'} value={formData.email} onChange={(v: string) => setFormData({...formData, email: v})} />
            <Input icon={Key} type="password" placeholder={lang === 'ar' ? 'كلمة السر' : 'Password'} value={formData.password} onChange={(v: string) => setFormData({...formData, password: v})} />
            {!isLogin && <Input icon={UserPlus} placeholder={lang === 'ar' ? 'رمز الإحالة (اختياري)' : 'Referral Code'} value={formData.referralCode} onChange={(v: string) => setFormData({...formData, referralCode: v})} />}
            <button disabled={loading} className="w-full bg-white text-black font-black py-4.5 rounded-2xl uppercase tracking-[0.2em] text-[10px] active:scale-95 transition-all shadow-xl flex items-center justify-center gap-2">
              {loading ? <Loader2 className="animate-spin" size={18} /> : (isLogin ? t('confirm') : t('confirm'))}
            </button>
          </form>
        </div>
        <button onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')} className="w-full text-center text-slate-500 font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-2"><Globe size={14} /> {lang === 'ar' ? 'English' : 'العربية'}</button>
      </div>
    </div>
  );
};

const Input = ({ icon: Icon, type = "text", placeholder, value, onChange }: any) => (
  <div className="relative group">
    <div className="absolute inset-y-0 right-4 flex items-center text-slate-500 group-focus-within:text-blue-500 transition-colors"><Icon size={18} /></div>
    <input type={type} required placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} className="w-full bg-[#020617] border border-white/5 pr-12 pl-4 py-4 rounded-xl text-xs font-bold outline-none focus:border-blue-500 transition-all text-white placeholder:text-slate-700 shadow-inner" />
  </div>
);

const NavItem = ({ icon: Icon, label, active, onClick }: any) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-2.5 transition-all duration-300 group ${active ? 'text-blue-500 -translate-y-2' : 'text-slate-600 hover:text-slate-400'}`}>
    <div className={`p-2.5 rounded-xl transition-all duration-300 ${active ? 'bg-blue-600/15 shadow-[0_0_20px_rgba(37,99,235,0.2)]' : ''}`}><Icon size={22} strokeWidth={active ? 2.5 : 2} /></div>
    <span className={`text-[8px] font-black uppercase tracking-[0.1em] transition-all ${active ? 'opacity-100 scale-105' : 'opacity-40'}`}>{label}</span>
  </button>
);

const HomeView = ({ user, t, onShowInfo }: any) => {
  const navigate = useNavigate();
  return (
    <div className="space-y-8">
      <div className="px-1 text-right">
        <h2 className="text-xl font-black italic tracking-tighter text-white">أهلاً، {user.first_name} 👋</h2>
        <p className="text-[9px] text-slate-500 font-bold uppercase tracking-[0.2em]">كود الإحالة: {user.referral_code}</p>
      </div>
      <div className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 via-indigo-500 to-blue-600 rounded-[2.5rem] blur opacity-15"></div>
        <div className="relative bg-[#0b0f1a] border border-white/10 rounded-[2.5rem] p-8 shadow-2xl overflow-hidden min-h-[280px] flex flex-col justify-between">
          <div className="relative z-10 space-y-5">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,1)]"></div>
                <p className="text-white/40 font-black text-[9px] uppercase tracking-[0.3em] italic">{t('balanceTitle')}</p>
              </div>
              <button onClick={onShowInfo} className="bg-white/5 px-4 py-2 rounded-xl backdrop-blur-3xl border border-white/10 text-white/90 text-[9px] font-black uppercase"><HelpCircle size={14} className="inline mr-2 text-blue-500" /> {t('howItWorksBtn')}</button>
            </div>
            <div className="text-right">
               <h2 className="text-6xl font-black tracking-tighter text-white">{Number(user.balance).toLocaleString('en-US', { minimumFractionDigits: 2 })} <span className="text-lg text-blue-500 italic">USDT</span></h2>
            </div>
          </div>
          <div className="flex gap-4 relative z-10 mt-8">
            <button className="flex-1 bg-white text-black font-black py-4.5 rounded-2xl flex items-center justify-center gap-3 text-[10px] uppercase tracking-[0.2em]"><ArrowDownCircle size={18} className="text-blue-600" /> {t('recharge')}</button>
            <button className="flex-1 bg-blue-600 text-white font-black py-4.5 rounded-2xl flex items-center justify-center gap-3 text-[10px] uppercase tracking-[0.2em]"><ArrowUpCircle size={18} /> {t('withdraw')}</button>
          </div>
        </div>
      </div>
    </div>
  );
};

const MachinesView = ({ user, onBuy, t }: any) => (
  <div className="space-y-6">
    <h2 className="text-lg font-black flex items-center gap-3 italic tracking-tighter uppercase text-right"><Layers className="text-blue-500" size={18}/> {t('machines')}</h2>
    <div className="space-y-6">
      {MACHINES.slice(0, 10).map(m => {
        const owned = user.ownedMachines.some((om: any) => om.machine_id === m.id);
        return (
          <div key={m.id} className="bg-[#0b0f1a] border border-white/10 rounded-[2rem] p-6 relative overflow-hidden shadow-xl text-right">
            <div className="flex justify-between items-start mb-6 relative z-10 flex-row-reverse">
               <div className="flex gap-4 flex-row-reverse">
                  <div className="w-16 h-16 bg-black/40 rounded-xl flex items-center justify-center border border-white/10 text-blue-500"><Cpu size={30} /></div>
                  <div className="space-y-1.5">
                     <h3 className="font-black text-xl text-white uppercase italic tracking-tighter">{m.name}</h3>
                     <p className="text-[9px] text-slate-500 font-black uppercase italic">Profit: {m.dailyProfit} USDT/Day</p>
                  </div>
               </div>
               <div className="text-left"><p className="text-3xl font-black text-blue-500 tracking-tighter">{m.price} <span className="text-xs italic">USDT</span></p></div>
            </div>
            <button onClick={() => onBuy(m)} disabled={owned} className={`w-full py-5 rounded-[1.2rem] font-black text-[12px] uppercase tracking-[0.4em] shadow-xl border-t border-white/10 transition-all ${owned ? 'bg-slate-900 text-slate-600' : 'bg-white text-black active:scale-95'}`}>
              {owned ? t('owned') : t('buyNow')}
            </button>
          </div>
        );
      })}
    </div>
  </div>
);

const TasksView = ({ user, onComplete, t }: any) => {
  const today = formatDate(new Date());
  return (
    <div className="space-y-8">
      <h2 className="text-xl font-black flex items-center gap-3 italic tracking-tighter uppercase text-right"><ListTodo className="text-blue-500" size={20}/> {t('tasks')}</h2>
      {user.ownedMachines.length === 0 ? (
        <div className="bg-white/5 border-2 border-dashed border-white/10 rounded-[2.5rem] p-24 text-center text-slate-800 font-black italic text-[11px] tracking-[0.5em] uppercase">لا توجد عقود نشطة حالياً</div>
      ) : (
        <div className="space-y-4">
          {user.ownedMachines.map((um: UserMachine) => {
            const m = MACHINES.find(x => x.id === um.machine_id);
            const isDone = um.last_claim_date === today;
            return (
              <div key={um.id} className={`bg-[#0b0f1a] border border-white/10 rounded-2xl p-6 text-right ${isDone ? 'opacity-50' : ''}`}>
                <div className="flex justify-between items-center flex-row-reverse mb-4">
                  <span className="text-white font-black italic">{m?.name}</span>
                  <span className="text-emerald-500 font-black">+{m?.dailyProfit} USDT</span>
                </div>
                <button disabled={isDone} onClick={() => onComplete(um)} className={`w-full py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${isDone ? 'bg-slate-800 text-slate-500' : 'bg-blue-600 text-white active:scale-95'}`}>
                  {isDone ? t('transactionCompleted') : t('completeTask')}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const TeamView = ({ user, t }: any) => (
  <div className="space-y-10">
    <h2 className="text-xl font-black flex items-center gap-4 italic tracking-tighter uppercase text-right"><Users className="text-blue-500" size={22}/> {t('team')}</h2>
    <div className="bg-[#0b0f1a] border border-white/10 rounded-[2.5rem] p-16 text-center space-y-4 shadow-xl">
       <p className="text-slate-700 text-[11px] font-black uppercase tracking-[0.5em] italic">{t('referralEarnings')}</p>
       <h3 className="text-7xl font-black text-blue-500 tracking-tighter italic">{Number(user.referral_earnings).toFixed(2)} <span className="text-sm text-slate-800 font-bold ml-2">USDT</span></h3>
    </div>
    <div className="space-y-6 text-right">
       <p className="text-[11px] text-slate-700 font-black uppercase px-8 tracking-[0.4em] italic">{t('referralLink')}</p>
       <div className="bg-[#020617] border border-white/5 p-8 rounded-2xl flex items-center gap-7">
          <Copy size={24} className="text-blue-500 cursor-pointer active:scale-95" onClick={() => {navigator.clipboard.writeText(user.referral_code); alert('Copied!')}}/>
          <span className="text-sm font-mono text-slate-700 truncate flex-1 tracking-tight">{user.referral_code}</span>
       </div>
    </div>
  </div>
);

const ProfileView = ({ user, t }: any) => (
  <div className="space-y-10">
    <div className="flex items-center gap-10 p-8 bg-white/[0.02] border border-white/5 rounded-[3.5rem] shadow-2xl justify-end">
       <div className="space-y-2.5 text-right">
          <h3 className="text-3xl font-black italic tracking-tighter uppercase text-white">{user.first_name} {user.last_name}</h3>
          <div className="inline-flex items-center gap-2.5 px-4 py-2 bg-blue-600/10 border border-blue-500/30 rounded-xl">
             <ShieldCheck size={14} className="text-blue-500" /><span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-500">Tier-1 Cloud Operator</span>
          </div>
       </div>
       <div className="w-24 h-24 rounded-[2rem] bg-gradient-to-br from-blue-600 via-indigo-700 to-blue-800 border-4 border-[#020617] shadow-xl flex items-center justify-center overflow-hidden">
          <img src={`https://api.dicebear.com/7.x/bottts/svg?seed=${user.id}`} alt="Avatar" className="w-full h-full object-cover"/>
       </div>
    </div>
    <div className="bg-[#0b0f1a] border border-white/10 rounded-[3.5rem] p-8 space-y-4">
      <div className="flex justify-between items-center flex-row-reverse border-b border-white/5 pb-4"><span className="text-slate-500 font-bold text-xs">البريد الإلكتروني</span><span className="text-white font-black text-xs">{user.email}</span></div>
      <div className="flex justify-between items-center flex-row-reverse border-b border-white/5 pb-4"><span className="text-slate-500 font-bold text-xs">رصيد الشحن</span><span className="text-blue-500 font-black text-xs">{user.total_recharge} USDT</span></div>
      <div className="flex justify-between items-center flex-row-reverse border-b border-white/5 pb-4"><span className="text-slate-500 font-bold text-xs">إجمالي السحب</span><span className="text-red-500 font-black text-xs">{user.total_withdraw} USDT</span></div>
    </div>
  </div>
);

const InfoModal = ({ t, onClose }: any) => (
  <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-slate-950/95 backdrop-blur-md">
    <div className="relative bg-[#0b0f1a] border border-white/10 w-full max-w-md rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
      <div className="p-6 bg-gradient-to-br from-[#1e293b] to-[#0f172a] border-b border-white/5 flex justify-between items-center">
        <h3 className="font-black text-white text-lg uppercase tracking-tighter italic">{t('securityTitle')}</h3>
        <button onClick={onClose} className="p-1.5 bg-white/5 rounded-full text-slate-400 hover:text-white"><X size={18} /></button>
      </div>
      <div className="p-7 overflow-y-auto no-scrollbar space-y-7 text-right">
        <div className="bg-blue-600/5 border border-blue-500/10 p-6 rounded-2xl space-y-4">
          <p className="text-[12px] leading-relaxed text-slate-300 font-medium">{t('securityText')}</p>
        </div>
      </div>
      <button onClick={onClose} className="m-7 bg-white text-black font-black py-4.5 rounded-xl uppercase tracking-[0.2em] text-[10px] active:scale-95 transition-all shadow-xl">استمرار بأمان تام</button>
    </div>
  </div>
);

export default App;
