
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
import { TRANSLATIONS, MACHINES, DEPOSIT_ADDRESS, NETWORK, MIN_WITHDRAWAL } from './constants';
import { supabase } from './supabase';

const formatDate = (date: Date) => date.toISOString().split('T')[0];

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
  const [showRecharge, setShowRecharge] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
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
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single();
      const { data: machines } = await supabase.from('user_machines').select('*').eq('user_id', userId);
      const { data: txs } = await supabase.from('transactions').select('*').eq('user_id', userId).order('date', { ascending: false });

      if (profile) {
        setUserData({
          ...profile,
          withdrawableBalance: profile.withdrawable_balance || 0,
          totalRecharge: profile.total_recharge || 0,
          totalWithdraw: profile.total_withdraw || 0,
          referralEarnings: profile.referral_earnings || 0,
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

  const buyMachine = async (machine: Machine) => {
    if (!userData || userData.ownedMachines.length >= 3) {
      showToast(t('maxMachinesReached'), 'error');
      return;
    }
    if (userData.balance < machine.price) {
      showToast(t('insufficientBalance'), 'error');
      return;
    }

    showToast(lang === 'ar' ? 'جاري الاتصال ببروتوكول التعدين...' : 'Connecting to mining protocol...', 'info');

    const { error: machineErr } = await supabase.from('user_machines').insert({
      user_id: session.user.id,
      machine_id: machine.id,
      remaining_days: machine.duration,
      total_earned: 0
    });

    if (machineErr) return showToast(machineErr.message, 'error');

    const newBalance = userData.balance - machine.price;
    await supabase.from('profiles').update({ balance: newBalance }).eq('id', session.user.id);

    showToast(t('transactionCompleted'), 'success');
    fetchAllUserData(session.user.id);
  };

  const completeTask = async (userMachine: UserMachine) => {
    const today = formatDate(new Date());
    if (userMachine.last_claim_date === today) return;

    const machine = MACHINES.find(m => m.id === userMachine.machine_id);
    if (!machine) return;

    showToast(lang === 'ar' ? 'جاري حصاد الأرباح...' : 'Harvesting profits...', 'info');

    const { error: updateErr } = await supabase.from('user_machines').update({
      last_claim_date: today,
      total_earned: userMachine.total_earned + machine.dailyProfit,
      remaining_days: userMachine.remaining_days - 1
    }).eq('id', userMachine.id);

    if (updateErr) return showToast(updateErr.message, 'error');

    const newBalance = userData!.balance + machine.dailyProfit;
    const newWithdrawable = userData!.withdrawableBalance + machine.dailyProfit;
    
    await supabase.from('profiles').update({ 
      balance: newBalance,
      withdrawable_balance: newWithdrawable 
    }).eq('id', session.user.id);

    await supabase.from('transactions').insert({
      user_id: session.user.id,
      type: 'task',
      amount: machine.dailyProfit,
      status: 'completed',
      details: `Profit from ${machine.name}`
    });

    showToast(t('transactionCompleted'), 'success');
    fetchAllUserData(session.user.id);
  };

  const performWithdraw = async (amount: number, address: string) => {
    if (!userData) return;
    if (amount < MIN_WITHDRAWAL) {
      showToast(t('minWithdrawalError'), 'error');
      return;
    }
    if (amount > userData.withdrawableBalance) {
      showToast(t('insufficientBalance'), 'error');
      return;
    }

    showToast(lang === 'ar' ? 'جاري معالجة طلب السحب...' : 'Processing withdrawal...', 'info');

    const newBalance = userData.balance - amount;
    const newWithdrawable = userData.withdrawableBalance - amount;
    const newTotalWithdraw = userData.totalWithdraw + amount;

    const { error: profileErr } = await supabase.from('profiles').update({
      balance: newBalance,
      withdrawable_balance: newWithdrawable,
      total_withdraw: newTotalWithdraw,
      last_withdraw_date: formatDate(new Date())
    }).eq('id', session.user.id);

    if (profileErr) return showToast(profileErr.message, 'error');

    await supabase.from('transactions').insert({
      user_id: session.user.id,
      type: 'withdrawal',
      amount: -amount,
      status: 'pending',
      details: `Withdrawal to ${address}`
    });

    showToast(t('transactionCompleted'), 'success');
    setShowWithdraw(false);
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

  if (!userData) {
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center gap-4 p-10 text-center">
        <Loader2 className="animate-spin text-blue-500" size={48} />
        <div className="space-y-2">
          <p className="text-white font-black italic tracking-tighter uppercase text-sm">Initializing Profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen pb-28 ${lang === 'ar' ? 'rtl text-right font-["Cairo"]' : 'text-left font-sans'} bg-[#020617] text-[#f8fafc] overflow-x-hidden relative`}>
      {showInfo && <InfoModal t={t} onClose={() => setShowInfo(false)} />}
      {showRecharge && <RechargeModal t={t} onClose={() => setShowRecharge(false)} showToast={showToast} />}
      {showWithdraw && <WithdrawModal t={t} onClose={() => setShowWithdraw(false)} onWithdraw={performWithdraw} max={userData.withdrawableBalance} />}
      
      {/* Toasts */}
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
          <Route path="/" element={<HomeView user={userData} t={t} onShowInfo={() => setShowInfo(true)} onShowRecharge={() => setShowRecharge(true)} onShowWithdraw={() => setShowWithdraw(true)} />} />
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
      else showToast(lang === 'ar' ? 'تحقق من بريدك الإلكتروني!' : 'Verify email!', 'success');
    }
    setLoading(false);
  };

  return (
    <div className={`min-h-screen bg-[#020617] p-6 flex flex-col justify-center ${lang === 'ar' ? 'rtl' : ''}`}>
      <div className="max-w-md mx-auto w-full space-y-8">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl mx-auto flex items-center justify-center shadow-2xl shadow-blue-500/20">
            <Zap size={32} className="text-white fill-white" />
          </div>
          <h1 className="text-3xl font-black italic tracking-tighter">MINE<span className="text-blue-500">PRO</span></h1>
        </div>
        <div className="bg-[#0b0f1a] border border-white/10 rounded-[2.5rem] p-8 shadow-2xl space-y-6">
          <div className="flex bg-[#020617] p-1.5 rounded-2xl border border-white/5">
            <button onClick={() => setIsLogin(true)} className={`flex-1 py-3 rounded-xl font-black text-xs transition-all ${isLogin ? 'bg-blue-600 text-white' : 'text-slate-500'}`}>{lang === 'ar' ? 'دخول' : 'Login'}</button>
            <button onClick={() => setIsLogin(false)} className={`flex-1 py-3 rounded-xl font-black text-xs transition-all ${!isLogin ? 'bg-blue-600 text-white' : 'text-slate-500'}`}>{lang === 'ar' ? 'حساب جديد' : 'Sign Up'}</button>
          </div>
          <form onSubmit={handleAuth} className="space-y-4">
            {!isLogin && (
              <div className="grid grid-cols-2 gap-4">
                <Input icon={UserIcon} placeholder={lang === 'ar' ? 'الاسم الأول' : 'First Name'} value={formData.firstName} onChange={(v: string) => setFormData({...formData, firstName: v})} />
                <Input icon={UserIcon} placeholder={lang === 'ar' ? 'الاسم الأخير' : 'Last Name'} value={formData.lastName} onChange={(v: string) => setFormData({...formData, lastName: v})} />
              </div>
            )}
            <Input icon={Mail} type="email" placeholder={lang === 'ar' ? 'البريد' : 'Email'} value={formData.email} onChange={(v: string) => setFormData({...formData, email: v})} />
            <Input icon={Key} type="password" placeholder={lang === 'ar' ? 'كلمة السر' : 'Password'} value={formData.password} onChange={(v: string) => setFormData({...formData, password: v})} />
            {!isLogin && <Input icon={UserPlus} placeholder={lang === 'ar' ? 'كود الإحالة' : 'Ref Code'} value={formData.referralCode} onChange={(v: string) => setFormData({...formData, referralCode: v})} />}
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
    <input type={type} required placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} className="w-full bg-[#020617] border border-white/5 pr-12 pl-4 py-4 rounded-xl text-xs font-bold outline-none focus:border-blue-500 transition-all text-white placeholder:text-slate-700" />
  </div>
);

const NavItem = ({ icon: Icon, label, active, onClick }: any) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-2.5 transition-all duration-300 group ${active ? 'text-blue-500 -translate-y-2' : 'text-slate-600 hover:text-slate-400'}`}>
    <div className={`p-2.5 rounded-xl transition-all duration-300 ${active ? 'bg-blue-600/15 shadow-[0_0_20px_rgba(37,99,235,0.2)]' : ''}`}><Icon size={22} strokeWidth={active ? 2.5 : 2} /></div>
    <span className={`text-[8px] font-black uppercase tracking-[0.1em] transition-all ${active ? 'opacity-100 scale-105' : 'opacity-40'}`}>{label}</span>
  </button>
);

const HomeView = ({ user, t, onShowInfo, onShowRecharge, onShowWithdraw }: any) => {
  return (
    <div className="space-y-10">
      <div className="px-1 text-right flex justify-between items-end flex-row-reverse">
        <div className="space-y-1">
          <h2 className="text-2xl font-black italic tracking-tighter text-white">أهلاً، {user.first_name} 👋</h2>
          <p className="text-[9px] text-slate-500 font-bold uppercase tracking-[0.2em]">OPERATOR ID: {user.referral_code}</p>
        </div>
        <div className="bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
          <span className="text-[8px] font-black uppercase tracking-widest text-emerald-500">System Secure</span>
        </div>
      </div>

      <div className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 via-indigo-500 to-blue-600 rounded-[3rem] blur opacity-25 group-hover:opacity-40 transition-all"></div>
        <div className="relative bg-[#0b0f1a] border border-white/10 rounded-[3rem] p-9 shadow-2xl overflow-hidden min-h-[300px] flex flex-col justify-between">
          <div className="relative z-10 space-y-6">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,1)]"></div>
                <p className="text-white/40 font-black text-[10px] uppercase tracking-[0.4em] italic">{t('balanceTitle')}</p>
              </div>
              <button onClick={onShowInfo} className="bg-white/5 hover:bg-white/10 px-4 py-2.5 rounded-2xl backdrop-blur-3xl border border-white/10 text-white/90 text-[10px] font-black uppercase flex items-center gap-2 transition-all">
                <HelpCircle size={15} className="text-blue-500" /> {t('howItWorksBtn')}
              </button>
            </div>
            <div className="text-right">
               <h2 className="text-7xl font-black tracking-tighter text-white drop-shadow-2xl">
                 {Number(user.balance).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                 <span className="text-xl text-blue-500 italic ml-3">USDT</span>
               </h2>
            </div>
          </div>
          <div className="flex gap-5 relative z-10 mt-10">
            <button onClick={onShowRecharge} className="flex-1 bg-white text-black font-black py-5 rounded-[1.5rem] flex items-center justify-center gap-3 text-[11px] uppercase tracking-[0.3em] shadow-xl active:scale-[0.97] transition-all">
              <ArrowDownCircle size={20} className="text-blue-600" /> {t('recharge')}
            </button>
            <button onClick={onShowWithdraw} className="flex-1 bg-blue-600 text-white font-black py-5 rounded-[1.5rem] flex items-center justify-center gap-3 text-[11px] uppercase tracking-[0.3em] shadow-2xl shadow-blue-500/20 active:scale-[0.97] transition-all">
              <ArrowUpCircle size={20} /> {t('withdraw')}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5">
        <StatsCard icon={Zap} label={t('machineEarnings')} value={`${Number(user.referralEarnings).toFixed(2)} USDT`} color="text-blue-500" />
        <StatsCard icon={Database} label={t('activeContracts')} value={`${user.ownedMachines.length} Nodes`} color="text-indigo-400" />
      </div>

      <div className="space-y-6 text-right">
         <h3 className="text-sm font-black italic tracking-widest uppercase text-slate-500 px-2">{t('history')}</h3>
         {user.transactions.length === 0 ? (
           <div className="bg-white/5 border border-dashed border-white/10 rounded-[2rem] p-12 text-center text-slate-700 font-black italic text-[10px] tracking-widest uppercase">No Records Found</div>
         ) : (
           <div className="space-y-3">
             {user.transactions.slice(0, 5).map((tx: Transaction) => (
               <div key={tx.id} className="bg-[#0b0f1a] border border-white/5 p-5 rounded-2xl flex justify-between items-center flex-row-reverse">
                  <div className="flex gap-4 flex-row-reverse items-center">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tx.type === 'task' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-blue-500/10 text-blue-500'}`}>
                      {tx.type === 'task' ? <Cpu size={18}/> : <ArrowDown size={18}/>}
                    </div>
                    <div className="text-right">
                       <p className="text-xs font-black text-white uppercase">{tx.type}</p>
                       <p className="text-[8px] text-slate-500 font-bold uppercase">{new Date(tx.date).toLocaleString()}</p>
                    </div>
                  </div>
                  <span className={`text-sm font-black ${tx.amount > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    {tx.amount > 0 ? '+' : ''}{tx.amount}
                  </span>
               </div>
             ))}
           </div>
         )}
      </div>
    </div>
  );
};

const StatsCard = ({ icon: Icon, label, value, color }: any) => (
  <div className="bg-[#0b0f1a] border border-white/5 rounded-[2rem] p-6 space-y-3 shadow-xl text-right">
    <div className={`p-2.5 bg-white/5 w-fit rounded-xl mr-auto ${color}`}><Icon size={18} /></div>
    <div>
       <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest italic mb-1">{label}</p>
       <p className="text-lg font-black text-white italic tracking-tighter">{value}</p>
    </div>
  </div>
);

const MachinesView = ({ user, onBuy, t }: any) => (
  <div className="space-y-8">
    <div className="flex justify-between items-center flex-row-reverse px-1">
      <h2 className="text-2xl font-black italic tracking-tighter uppercase text-white flex items-center gap-3">
        <Layers className="text-blue-500" size={24}/> {t('machines')}
      </h2>
      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest bg-white/5 px-4 py-1.5 rounded-full border border-white/10">Protocols Active</span>
    </div>

    <div className="space-y-8">
      {MACHINES.map(m => {
        const owned = user.ownedMachines.some((om: any) => om.machine_id === m.id);
        return (
          <div key={m.id} className="group relative">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-[2.5rem] blur opacity-0 group-hover:opacity-10 transition-all duration-500"></div>
            <div className="relative bg-[#0b0f1a] border border-white/10 rounded-[2.5rem] p-8 shadow-2xl text-right overflow-hidden transition-all duration-300">
              <div className="absolute top-0 left-0 w-32 h-32 bg-blue-600/5 blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
              
              <div className="flex justify-between items-start mb-8 relative z-10 flex-row-reverse">
                 <div className="flex gap-5 flex-row-reverse items-center">
                    <div className="w-20 h-20 bg-gradient-to-br from-[#1e293b] to-[#0f172a] rounded-2xl flex items-center justify-center border border-white/10 shadow-inner group-hover:scale-110 transition-transform duration-500">
                      <Cpu size={42} className="text-blue-500" />
                    </div>
                    <div className="space-y-2">
                       <h3 className="font-black text-2xl text-white uppercase italic tracking-tighter leading-none">{m.name}</h3>
                       <div className="flex gap-2 justify-end">
                         <span className="text-[8px] font-black bg-blue-500/10 text-blue-500 px-3 py-1 rounded-full uppercase tracking-widest border border-blue-500/20">Elite-Grade</span>
                       </div>
                    </div>
                 </div>
                 <div className="text-left">
                    <p className="text-4xl font-black text-white tracking-tighter">{m.price}<span className="text-xs text-blue-500 ml-1 italic uppercase">USDT</span></p>
                    <p className="text-[8px] text-slate-700 font-black uppercase tracking-widest mt-1">Activation Stake</p>
                 </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-8">
                 <div className="bg-white/[0.02] border border-white/5 p-4 rounded-2xl text-right">
                    <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-1 italic">Daily Return</p>
                    <p className="text-lg font-black text-emerald-500 italic">+{m.dailyProfit} <span className="text-[10px]">USDT</span></p>
                 </div>
                 <div className="bg-white/[0.02] border border-white/5 p-4 rounded-2xl text-right">
                    <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-1 italic">Lifecycle</p>
                    <p className="text-lg font-black text-white italic">{m.duration} <span className="text-[10px]">Days</span></p>
                 </div>
              </div>

              <button 
                onClick={() => onBuy(m)} 
                disabled={owned}
                className={`w-full py-5 rounded-[1.5rem] font-black text-[13px] uppercase tracking-[0.4em] shadow-2xl transition-all duration-300 ${
                  owned ? 'bg-slate-900 text-slate-600 border border-white/5' : 'bg-white text-black hover:bg-slate-100 active:scale-95 shadow-white/5'
                }`}
              >
                {owned ? t('owned') : t('buyNow')}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

const TasksView = ({ user, onComplete, t }: any) => {
  const today = formatDate(new Date());
  return (
    <div className="space-y-10">
      <div className="flex justify-between items-center flex-row-reverse px-1">
        <h2 className="text-2xl font-black italic tracking-tighter uppercase text-white flex items-center gap-4">
          <ListTodo className="text-blue-500" size={26}/> {t('tasks')}
        </h2>
        <div className="flex items-center gap-2 bg-blue-500/10 px-4 py-2 rounded-xl border border-blue-500/20">
          <Clock size={14} className="text-blue-500" />
          <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Next Cycle in 12h</span>
        </div>
      </div>

      {user.ownedMachines.length === 0 ? (
        <div className="bg-[#0b0f1a] border-2 border-dashed border-white/5 rounded-[3rem] p-32 text-center flex flex-col items-center gap-6 shadow-2xl">
          <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center text-slate-800"><Cpu size={40}/></div>
          <p className="text-slate-800 font-black italic text-[12px] tracking-[0.6em] uppercase leading-loose">No Active Protocol Nodes Detected</p>
        </div>
      ) : (
        <div className="space-y-6">
          {user.ownedMachines.map((um: UserMachine) => {
            const m = MACHINES.find(x => x.id === um.machine_id);
            const isDone = um.last_claim_date === today;
            return (
              <div key={um.id} className={`group relative ${isDone ? 'opacity-40 grayscale-[0.5]' : ''}`}>
                <div className={`relative bg-[#0b0f1a] border ${isDone ? 'border-white/5' : 'border-blue-500/30'} rounded-[2.5rem] p-8 shadow-2xl transition-all duration-500`}>
                  {!isDone && <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-2xl rounded-full"></div>}
                  
                  <div className="flex justify-between items-center flex-row-reverse mb-8 relative z-10">
                    <div className="flex gap-5 flex-row-reverse items-center">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border ${isDone ? 'border-white/5 bg-white/5' : 'border-blue-500/20 bg-blue-500/10 text-blue-500'}`}>
                        <Cpu size={28} />
                      </div>
                      <div className="text-right">
                        <h4 className="font-black text-xl text-white uppercase italic tracking-tighter">{m?.name}</h4>
                        <p className="text-[8px] text-slate-500 font-black uppercase tracking-widest mt-1 italic">Protocol ID: #{um.id.toString().slice(0,5)}</p>
                      </div>
                    </div>
                    <div className="text-left">
                       <p className={`text-2xl font-black italic ${isDone ? 'text-slate-500' : 'text-emerald-500'}`}>+{m?.dailyProfit} <span className="text-[10px]">USDT</span></p>
                    </div>
                  </div>

                  <button 
                    disabled={isDone} 
                    onClick={() => onComplete(um)}
                    className={`w-full py-4.5 rounded-[1.2rem] font-black uppercase text-[11px] tracking-[0.4em] transition-all shadow-xl ${
                      isDone ? 'bg-slate-800 text-slate-500 border border-white/5' : 'bg-blue-600 text-white hover:bg-blue-500 active:scale-95 shadow-blue-500/10'
                    }`}
                  >
                    {isDone ? t('transactionCompleted') : t('completeTask')}
                  </button>
                </div>
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
    <div className="flex justify-between items-center flex-row-reverse px-1">
      <h2 className="text-2xl font-black italic tracking-tighter uppercase text-white flex items-center gap-5">
        <Users className="text-blue-500" size={28}/> {t('team')}
      </h2>
      <div className="bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-xl flex items-center gap-2">
         <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Network Active</span>
      </div>
    </div>

    <div className="relative group">
       <div className="absolute -inset-0.5 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-[3rem] blur opacity-20"></div>
       <div className="relative bg-[#0b0f1a] border border-white/10 rounded-[3rem] p-16 text-center space-y-6 shadow-2xl overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-blue-600/5 blur-3xl"></div>
          <p className="text-slate-700 text-[11px] font-black uppercase tracking-[0.6em] italic mb-2">{t('referralEarnings')}</p>
          <div className="flex items-baseline justify-center gap-3">
             <h3 className="text-8xl font-black text-blue-500 tracking-tighter italic drop-shadow-2xl">{Number(user.referralEarnings).toFixed(2)}</h3>
             <span className="text-xl text-slate-800 font-bold uppercase tracking-[0.2em] italic">USDT</span>
          </div>
       </div>
    </div>

    <div className="space-y-6 text-right">
       <p className="text-[11px] text-slate-700 font-black uppercase px-8 tracking-[0.5em] italic">{t('referralLink')}</p>
       <div className="bg-[#0b0f1a] border border-white/10 p-9 rounded-[2rem] flex items-center gap-8 shadow-inner group">
          <button 
            onClick={() => {navigator.clipboard.writeText(user.referral_code); alert('Identifier Copied to Maingate!')}}
            className="p-5 bg-white/5 rounded-2xl text-blue-500 hover:bg-blue-500/10 hover:scale-110 active:scale-95 transition-all shadow-xl"
          >
            <Copy size={28} />
          </button>
          <div className="flex-1 text-right truncate">
            <span className="text-lg font-mono text-slate-700 tracking-wider font-bold">{user.referral_code}</span>
            <p className="text-[8px] text-slate-800 font-black uppercase mt-1 tracking-widest">Unique Protocol Identifier</p>
          </div>
       </div>
    </div>
  </div>
);

const ProfileView = ({ user, t }: any) => (
  <div className="space-y-12">
    <div className="relative p-10 bg-white/[0.03] border border-white/5 rounded-[4rem] shadow-2xl flex items-center gap-10 flex-row-reverse justify-between overflow-hidden">
       <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-blue-600/5 to-transparent"></div>
       <div className="space-y-4 text-right relative z-10">
          <h3 className="text-4xl font-black italic tracking-tighter uppercase text-white leading-tight">{user.first_name}<br/>{user.last_name}</h3>
          <div className="inline-flex items-center gap-3 px-5 py-2.5 bg-blue-600/10 border border-blue-500/30 rounded-2xl shadow-xl">
             <ShieldCheck size={16} className="text-blue-500" />
             <span className="text-[11px] font-black uppercase tracking-[0.3em] text-blue-500">Tier-1 Operator</span>
          </div>
       </div>
       <div className="w-32 h-32 rounded-[2.5rem] bg-gradient-to-br from-blue-600 via-indigo-700 to-blue-800 border-8 border-[#020617] shadow-2xl flex items-center justify-center overflow-hidden relative z-10">
          <img src={`https://api.dicebear.com/7.x/bottts/svg?seed=${user.id}`} alt="Avatar" className="w-full h-full scale-125 translate-y-2"/>
       </div>
    </div>

    <div className="grid grid-cols-2 gap-6">
      <div className="bg-[#0b0f1a] border border-white/10 rounded-[2.5rem] p-7 text-right shadow-xl">
         <p className="text-[9px] text-slate-700 font-black uppercase tracking-widest mb-1 italic">Withdrawals</p>
         <p className="text-2xl font-black text-red-500 italic tracking-tighter">{user.totalWithdraw} <span className="text-[10px]">USDT</span></p>
      </div>
      <div className="bg-[#0b0f1a] border border-white/10 rounded-[2.5rem] p-7 text-right shadow-xl">
         <p className="text-[9px] text-slate-700 font-black uppercase tracking-widest mb-1 italic">Recharges</p>
         <p className="text-2xl font-black text-emerald-500 italic tracking-tighter">{user.totalRecharge} <span className="text-[10px]">USDT</span></p>
      </div>
    </div>

    <div className="bg-[#0b0f1a] border border-white/10 rounded-[3rem] p-9 space-y-6 shadow-2xl">
      <div className="flex justify-between items-center flex-row-reverse border-b border-white/5 pb-6">
        <span className="text-slate-500 font-bold text-xs uppercase tracking-widest">Operator Mail</span>
        <span className="text-white font-black text-xs truncate max-w-[200px]">{user.email}</span>
      </div>
      <div className="flex justify-between items-center flex-row-reverse border-b border-white/5 pb-6">
        <span className="text-slate-500 font-bold text-xs uppercase tracking-widest">Protocol Code</span>
        <span className="text-blue-500 font-black text-xs">{user.referral_code}</span>
      </div>
      <div className="flex justify-between items-center flex-row-reverse border-b border-white/5 pb-6">
        <span className="text-slate-500 font-bold text-xs uppercase tracking-widest">Gate Security</span>
        <span className="text-emerald-500 font-black text-xs">V-Elite 2FA Active</span>
      </div>
    </div>
  </div>
);

const RechargeModal = ({ t, onClose, showToast }: any) => {
  const [rechargeAmount, setRechargeAmount] = useState('');
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-slate-950/98 backdrop-blur-xl">
      <div className="relative bg-[#0b0f1a] border border-white/10 w-full max-w-md rounded-[3.5rem] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        <div className="p-8 bg-gradient-to-br from-[#1e293b] to-[#0f172a] border-b border-white/5 flex justify-between items-center">
          <div className="flex items-center gap-4 text-right">
            <ArrowDownCircle className="text-blue-500" size={26} />
            <h3 className="font-black text-white text-xl uppercase tracking-tighter italic">{t('recharge')}</h3>
          </div>
          <button onClick={onClose} className="p-2.5 bg-white/5 rounded-2xl text-slate-400 hover:text-white transition-all"><X size={20} /></button>
        </div>
        
        <div className="p-9 overflow-y-auto no-scrollbar space-y-9 text-right">
          <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-3xl space-y-3">
            <div className="flex items-center gap-3 text-red-500 flex-row-reverse">
              <ShieldAlert size={20} />
              <span className="text-[11px] font-black uppercase tracking-widest">{t('securityWarningTitle')}</span>
            </div>
            <p className="text-[11px] leading-relaxed text-red-100/60 font-bold">{t('securityWarningText')}</p>
          </div>

          <div className="space-y-6">
             <div className="flex justify-between items-center flex-row-reverse">
                <p className="text-[11px] font-black text-slate-600 uppercase tracking-widest italic">{t('walletAddress')}</p>
                <span className="text-[9px] font-black bg-blue-500/10 text-blue-500 px-3 py-1 rounded-lg uppercase border border-blue-500/20">{NETWORK}</span>
             </div>
             <div className="bg-black/50 border border-white/5 p-7 rounded-[1.5rem] flex items-center gap-6 shadow-inner group">
                <button 
                  onClick={() => {navigator.clipboard.writeText(DEPOSIT_ADDRESS); showToast('Address Copied!', 'success')}}
                  className="p-4 bg-white/5 rounded-xl text-blue-500 hover:bg-blue-500/10 transition-all shadow-xl"
                >
                  <Copy size={22} />
                </button>
                <span className="text-xs font-mono text-slate-500 break-all leading-relaxed font-bold flex-1">{DEPOSIT_ADDRESS}</span>
             </div>
          </div>

          <div className="space-y-4">
            <p className="text-[11px] font-black text-slate-600 uppercase tracking-widest italic">{t('amountToDeposit')}</p>
            <div className="relative group">
              <input 
                type="number" 
                placeholder="0.00 USDT" 
                value={rechargeAmount}
                onChange={(e) => setRechargeAmount(e.target.value)}
                className="w-full bg-black/50 border border-white/5 p-5 rounded-[1.5rem] text-white font-black italic outline-none focus:border-blue-500/50 transition-all text-center text-lg" 
              />
            </div>
          </div>

          <div className="space-y-6">
             <p className="text-[11px] font-black text-slate-600 uppercase tracking-widest italic">{t('paymentProof')}</p>
             <div className="border-2 border-dashed border-white/10 rounded-[2.5rem] p-12 text-center bg-white/[0.02] hover:border-blue-500/50 transition-all cursor-pointer group">
                <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6 text-blue-500 group-hover:scale-110 transition-transform">
                  <UploadCloud size={32} />
                </div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">{t('clickToUpload')}</p>
             </div>
          </div>
        </div>

        <div className="p-9 bg-black/20 border-t border-white/5">
          <button onClick={() => {onClose(); showToast('Verification Submitted', 'success')}} className="w-full bg-white text-black font-black py-5 rounded-[1.5rem] uppercase tracking-[0.4em] text-[12px] active:scale-95 transition-all shadow-xl shadow-white/5">
            {t('confirmDeposit')}
          </button>
        </div>
      </div>
    </div>
  );
};

const WithdrawModal = ({ t, onClose, onWithdraw, max }: any) => {
  const [amount, setAmount] = useState('');
  const [address, setAddress] = useState('');
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-slate-950/98 backdrop-blur-xl">
      <div className="relative bg-[#0b0f1a] border border-white/10 w-full max-w-md rounded-[3.5rem] overflow-hidden shadow-2xl flex flex-col">
        <div className="p-8 bg-gradient-to-br from-indigo-900 to-slate-950 border-b border-white/5 flex justify-between items-center">
          <div className="flex items-center gap-4 text-right">
            <ArrowUpCircle className="text-blue-500" size={26} />
            <h3 className="font-black text-white text-xl uppercase tracking-tighter italic">{t('withdraw')}</h3>
          </div>
          <button onClick={onClose} className="p-2.5 bg-white/5 rounded-2xl text-slate-400 hover:text-white transition-all"><X size={20} /></button>
        </div>
        <div className="p-9 space-y-8 text-right">
           <div className="bg-blue-600/5 border border-blue-500/10 p-6 rounded-3xl flex justify-between items-center flex-row-reverse">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Available to Withdraw</span>
              <span className="text-xl font-black text-blue-500 italic">{max.toFixed(2)} USDT</span>
           </div>
           <div className="space-y-4">
              <p className="text-[11px] font-black text-slate-600 uppercase tracking-widest italic">TRC20/BEP20 Address</p>
              <input 
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="0x... or T..." 
                className="w-full bg-black/50 border border-white/5 p-5 rounded-2xl text-white font-mono text-xs outline-none focus:border-blue-500/50 transition-all" 
              />
           </div>
           <div className="space-y-4">
              <div className="flex justify-between flex-row-reverse items-center">
                <p className="text-[11px] font-black text-slate-600 uppercase tracking-widest italic">Amount to Withdraw</p>
                <button onClick={() => setAmount(max.toString())} className="text-[8px] font-black text-blue-500 uppercase border-b border-blue-500/30">Max Amount</button>
              </div>
              <input 
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Min. 8.00 USDT" 
                className="w-full bg-black/50 border border-white/5 p-5 rounded-2xl text-white font-black italic outline-none focus:border-blue-500/50 transition-all text-center text-xl" 
              />
           </div>
        </div>
        <div className="p-9 bg-black/20 border-t border-white/5">
           <button 
             onClick={() => onWithdraw(Number(amount), address)}
             className="w-full bg-blue-600 text-white font-black py-5 rounded-[1.5rem] uppercase tracking-[0.4em] text-[12px] active:scale-95 transition-all shadow-xl shadow-blue-500/20"
           >
             Confirm Withdrawal
           </button>
        </div>
      </div>
    </div>
  );
};

const InfoModal = ({ t, onClose }: any) => (
  <div className="fixed inset-0 z-[120] flex items-center justify-center p-6 bg-slate-950/98 backdrop-blur-xl">
    <div className="relative bg-[#0b0f1a] border border-white/10 w-full max-w-md rounded-[3.5rem] overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
      <div className="p-9 bg-gradient-to-br from-[#1e293b] to-[#0f172a] border-b border-white/5 flex justify-between items-center">
        <div className="flex items-center gap-4 text-right">
          <ShieldCheck className="text-blue-500" size={28} />
          <h3 className="font-black text-white text-xl uppercase tracking-tighter italic">{t('securityTitle')}</h3>
        </div>
        <button onClick={onClose} className="p-2.5 bg-white/5 rounded-2xl text-slate-400 hover:text-white transition-all"><X size={20} /></button>
      </div>
      <div className="p-10 overflow-y-auto no-scrollbar space-y-9 text-right">
        <div className="bg-blue-600/5 border border-blue-500/10 p-8 rounded-[2rem] space-y-6">
          <div className="flex items-center gap-3 text-blue-500 mb-2 flex-row-reverse">
            <Lock size={18} />
            <span className="text-[11px] font-black uppercase tracking-[0.3em] italic">V-Elite Maingate Security</span>
          </div>
          <p className="text-[13px] leading-loose text-slate-300 font-bold italic">{t('securityText')}</p>
        </div>
        <div className="bg-emerald-500/5 border border-emerald-500/10 p-8 rounded-[2rem] space-y-4">
          <div className="flex items-center gap-3 text-emerald-500 flex-row-reverse">
             <BarChart3 size={18} />
             <span className="text-[11px] font-black uppercase tracking-[0.3em] italic">Earnings Intelligence</span>
          </div>
          <p className="text-[12px] leading-loose text-emerald-100/60 font-bold italic">{t('ourProfit')}</p>
        </div>
      </div>
      <div className="p-10 border-t border-white/5">
        <button onClick={onClose} className="w-full bg-white text-black font-black py-5 rounded-[1.5rem] uppercase tracking-[0.4em] text-[11px] active:scale-95 transition-all shadow-xl">
          Acknowledge Protocol
        </button>
      </div>
    </div>
  </div>
);

export default App;
