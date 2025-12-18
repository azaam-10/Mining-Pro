
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { 
  Home as HomeIcon, Cpu, ListTodo, Users, User as UserIcon, 
  ArrowDownCircle, ArrowUpCircle, CheckCircle2, Clock, XCircle, 
  Loader2, ShieldCheck, HelpCircle, X, Copy, UploadCloud, 
  ArrowDown, Zap, Globe, Layers, Settings, Eye, Search, 
  RefreshCw, Calendar, ChevronLeft, MessageCircle, Send, Sparkles,
  LogOut, Mail, Key, ShieldAlert, Award, TrendingUp, Gem, ChevronRight, AlertTriangle, ExternalLink,
  Lock, Shield, Check, Activity, Info, Briefcase, History, Crown, Star, Flame, Diamond, ZapOff
} from 'lucide-react';
import { Language, UserState, UserMachine, Machine, Transaction, SupportMessage } from './types';
import { TRANSLATIONS, MACHINES, DEPOSIT_ADDRESS, MIN_WITHDRAWAL, ADMIN_EMAIL } from './constants';
import { supabase } from './supabase';

interface Toast { message: string; type: 'success' | 'error' | 'info'; id: number; }

const App: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [lang, setLang] = useState<Language>('ar');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [showInfo, setShowInfo] = useState(false);
  const [showRecharge, setShowRecharge] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false); 
  const [syncing, setSyncing] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [userData, setUserData] = useState<UserState | null>(null);
  const [fetchError, setFetchError] = useState(false);

  const formatUserData = (profile: any, machines: any[], txs: any[], email: string): UserState => ({
    ...profile,
    email: email || profile.email || '',
    withdrawableBalance: profile.withdrawable_balance || 0,
    totalRecharge: profile.total_recharge || 0,
    totalWithdraw: profile.total_withdraw || 0,
    referralEarnings: profile.referral_earnings || 0,
    ownedMachines: machines || [],
    transactions: txs || [],
    lastWithdrawDate: profile.last_withdraw_date || null
  });

  const fetchAllUserData = useCallback(async (userId: string, userEmail: string, isManual: boolean = false) => {
    if (!userId) return;
    if (isManual) setSyncing(true);
    setFetchError(false);
    
    try {
      const [profileRes, machinesRes, txsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
        supabase.from('user_machines').select('*').eq('user_id', userId),
        supabase.from('transactions').select('*').eq('user_id', userId).order('date', { ascending: false })
      ]);

      let profile = profileRes.data;

      if (!profile && !profileRes.error) {
        const { data: newProfile, error: insertError } = await supabase.from('profiles').insert([
          { 
            id: userId, 
            balance: 0, 
            withdrawable_balance: 0, 
            referral_code: Math.random().toString(36).substring(2, 8).toUpperCase(),
            first_name: 'User',
            last_name: ''
          }
        ]).select().single();
        
        if (insertError) throw insertError;
        profile = newProfile;
      }

      if (profile) {
        setUserData(formatUserData(profile, machinesRes.data || [], txsRes.data || [], userEmail));
      } else {
        setFetchError(true);
      }

      if (isManual) showToast("تم تحديث البيانات", "success");
    } catch (err) {
      console.error("Fetch Error:", err);
      setFetchError(true);
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      setSession(currentSession);
      if (currentSession?.user) {
        fetchAllUserData(currentSession.user.id, currentSession.user.email || '');
      } else {
        setLoading(false);
      }
    };
    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        if (!userData) setLoading(true);
        fetchAllUserData(session.user.id, session.user.email || '');
      } else {
        setUserData(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchAllUserData]);

  const handleManualRefresh = () => {
    if (session?.user) fetchAllUserData(session.user.id, session.user.email || '', true);
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { message, type, id }]);
    setTimeout(() => toasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  const t = (key: string) => TRANSLATIONS[key]?.[lang] || key;

  const buyMachine = async (machine: Machine) => {
    if (!userData || !session?.user || isProcessing) return;
    if (userData.balance < machine.price) {
      return showToast("رصيدك الحالي غير كافٍ", 'error');
    }
    
    setIsProcessing(true);
    try {
      const { error: machineErr } = await supabase.from('user_machines').insert({
        user_id: session.user.id,
        machine_id: machine.id,
        remaining_days: machine.duration,
        total_earned: 0
      });

      if (machineErr) throw machineErr;

      await supabase.from('profiles')
        .update({ balance: userData.balance - machine.price })
        .eq('id', session.user.id);

      showToast("تم تفعيل العقد بنجاح", 'success');
      await fetchAllUserData(session.user.id, session.user.email || '');
    } catch (err: any) {
      showToast("حدث خطأ أثناء الشراء", 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const completeTask = async (um: UserMachine) => {
    if (!userData || !session?.user || isProcessing) return;
    
    const now = Date.now();
    const lastClaim = um.last_claim_date ? new Date(um.last_claim_date).getTime() : 0;
    
    if (now - lastClaim < 24 * 60 * 60 * 1000) {
      return showToast("المهمة قيد الانتظار", 'error');
    }

    const machine = MACHINES.find(m => m.id === um.machine_id);
    if (!machine) return;

    setIsProcessing(true);
    try {
      const nowISO = new Date().toISOString();
      await supabase.from('user_machines').update({
        last_claim_date: nowISO,
        total_earned: (um.total_earned || 0) + machine.dailyProfit,
        remaining_days: (um.remaining_days || 0) - 1
      }).eq('id', um.id);

      await supabase.from('profiles').update({ 
        balance: userData.balance + machine.dailyProfit, 
        withdrawable_balance: userData.withdrawableBalance + machine.dailyProfit 
      }).eq('id', session.user.id);

      await supabase.from('transactions').insert({ 
        user_id: session.user.id, 
        type: 'task', 
        amount: machine.dailyProfit, 
        status: 'completed',
        date: nowISO
      });

      showToast("تم استلام الأرباح", 'success');
      await fetchAllUserData(session.user.id, session.user.email || '');
    } catch (err: any) {
      showToast("خطأ في الاتصال", 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) return <ProtocolLoadingScreen />;

  if (!session) return <AuthView lang={lang} t={t} showToast={showToast} />;

  if (fetchError && !userData) return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center p-10 text-center">
      <div className="space-y-4">
        <ShieldAlert className="text-red-500 mx-auto" size={48} />
        <p className="text-white/80 font-bold text-sm">عذراً، فشل جلب بيانات البروتوكول</p>
        <button onClick={() => window.location.reload()} className="w-full bg-blue-600 text-white px-6 py-3 rounded-xl font-bold text-xs uppercase">إعادة المحاولة</button>
      </div>
    </div>
  );

  if (!userData) return null;

  return (
    <div className={`min-h-screen pb-24 ${lang === 'ar' ? 'rtl font-["Cairo"]' : 'font-sans'} bg-[#020617] text-[#f8fafc] overflow-x-hidden relative`}>
      {isProcessing && (
        <div className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-[#0b0f1a] p-6 rounded-2xl border border-white/10 flex flex-col items-center gap-4 shadow-2xl">
             <Loader2 className="animate-spin text-blue-500" size={32} />
             <p className="text-[10px] font-black uppercase text-white/60 tracking-widest">Processing Transaction...</p>
          </div>
        </div>
      )}

      {showInfo && <InfoModal onClose={() => setShowInfo(false)} />}
      {showRecharge && <RechargeModal t={t} onClose={() => setShowRecharge(false)} onDeposit={() => fetchAllUserData(session.user.id, session.user.email || '')} showToast={showToast} userId={session.user.id} setIsProcessing={setIsProcessing} isProcessing={isProcessing} />}
      {showWithdraw && <WithdrawModal t={t} onClose={() => setShowWithdraw(false)} onWithdraw={() => fetchAllUserData(session.user.id, session.user.email || '')} max={userData.withdrawableBalance} userId={session.user.id} balance={userData.balance} showToast={showToast} setIsProcessing={setIsProcessing} isProcessing={isProcessing} user={userData} />}
      {showSupport && <SupportChatModal lang={lang} t={t} onClose={() => setShowSupport(false)} userId={session.user.id} />}
      
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-full max-w-[85%] space-y-2 pointer-events-none">
        {toasts.map(toast => (
          <div key={toast.id} className={`flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl pointer-events-auto backdrop-blur-3xl border border-white/10 ${toast.type === 'error' ? 'bg-red-500/20 text-red-200' : 'bg-emerald-500/20 text-emerald-100'}`}>
            <span className="text-[12px] font-bold">{toast.message}</span>
          </div>
        ))}
      </div>

      <header className="px-4 py-4 border-b border-white/5 backdrop-blur-xl sticky top-0 z-40 bg-[#020617]/80 flex justify-between items-center shadow-lg">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg"><Zap size={18} className="text-white fill-white" /></div>
          <span className="font-black italic text-lg tracking-tighter uppercase">MINE<span className="text-blue-500">PRO</span></span>
        </div>
        <div className="flex gap-1.5 items-center">
          <button onClick={handleManualRefresh} disabled={syncing} className={`p-2 bg-blue-500/10 text-blue-400 rounded-xl ${syncing ? 'animate-spin opacity-50' : ''}`}><RefreshCw size={18} /></button>
          <button onClick={() => setShowSupport(true)} className="p-2 bg-blue-500/10 text-blue-500 rounded-xl"><MessageCircle size={18}/></button>
          <button onClick={() => supabase.auth.signOut()} className="p-2 bg-red-500/10 text-red-500 rounded-xl"><LogOut size={18} /></button>
        </div>
      </header>

      <main className="max-w-md mx-auto p-4 space-y-6 relative z-10">
        <Routes>
          <Route path="/" element={<HomeView user={userData} t={t} onShowInfo={() => setShowInfo(true)} onShowRecharge={() => setShowRecharge(true)} onShowWithdraw={() => setShowWithdraw(true)} syncing={syncing} />} />
          <Route path="/machines" element={<MachinesView user={userData} onBuy={buyMachine} t={t} isProcessing={isProcessing} />} />
          <Route path="/tasks" element={<TasksView user={userData} onComplete={completeTask} t={t} isProcessing={isProcessing} />} />
          <Route path="/team" element={<TeamView user={userData} t={t} />} />
          <Route path="/profile" element={<ProfileView user={userData} t={t} />} />
          {userData?.email === ADMIN_EMAIL && <Route path="/admin" element={<AdminView t={t} showToast={showToast} />} />}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-[#020617]/95 backdrop-blur-xl border-t border-white/5 p-4 z-40 shadow-xl">
        <div className="max-w-md mx-auto flex justify-around">
          <NavItem icon={HomeIcon} label={t('home')} active={location.pathname === '/'} onClick={() => navigate('/')} />
          <NavItem icon={Cpu} label={t('machines')} active={location.pathname === '/machines'} onClick={() => navigate('/machines')} />
          <NavItem icon={ListTodo} label={t('tasks')} active={location.pathname === '/tasks'} onClick={() => navigate('/tasks')} />
          {userData?.email === ADMIN_EMAIL ? (
            <NavItem icon={Settings} label={t('adminTool')} active={location.pathname === '/admin'} onClick={() => navigate('/admin')} />
          ) : (
            <NavItem icon={Users} label={t('team')} active={location.pathname === '/team'} onClick={() => navigate('/team')} />
          )}
          <NavItem icon={UserIcon} label={t('profile')} active={location.pathname === '/profile'} onClick={() => navigate('/profile')} />
        </div>
      </nav>
    </div>
  );
};

const ProtocolLoadingScreen = () => (
  <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center gap-6 p-10">
    <div className="relative">
      <div className="w-24 h-24 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin"></div>
      <Zap className="absolute inset-0 m-auto text-blue-500 fill-blue-500" size={32} />
    </div>
    <div className="space-y-2 text-center">
      <p className="text-white font-black text-xl uppercase italic tracking-tighter">MINEPRO V-2</p>
      <div className="flex gap-1 justify-center">
        {[1,2,3].map(i => <div key={i} className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: `${i*0.2}s`}}></div>)}
      </div>
    </div>
  </div>
);

const NavItem = ({ icon: Icon, label, active, onClick }: any) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-1 transition-all ${active ? 'text-blue-500' : 'text-slate-700'}`}>
    <div className={`p-2 rounded-lg ${active ? 'bg-blue-600/10 shadow-lg' : ''}`}><Icon size={18} /></div>
    <span className="text-[8px] font-black uppercase tracking-widest">{label}</span>
  </button>
);

const HomeView = ({ user, t, onShowInfo, onShowRecharge, onShowWithdraw, syncing }: any) => (
  <div className="space-y-6 animate-in fade-in duration-500">
    <div className="flex justify-between items-end flex-row-reverse px-1">
      <div className="space-y-0.5">
        <h2 className="text-xl font-black italic text-white leading-none">أهلاً، {user.first_name}</h2>
        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">ID: {user.referral_code}</p>
      </div>
      <div className={`px-3 py-1.5 rounded-full flex items-center gap-2 border ${syncing ? 'bg-blue-500/10 border-blue-500/20' : 'bg-emerald-500/10 border-emerald-500/20'}`}>
         <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${syncing ? 'bg-blue-500' : 'bg-emerald-500'}`}></div>
         <span className={`text-[9px] font-black uppercase ${syncing ? 'text-blue-500' : 'text-emerald-500'}`}>
            {syncing ? 'جاري المزامنة...' : 'متصل'}
         </span>
      </div>
    </div>

    <div className="relative bg-[#0b0f1a] border border-white/10 rounded-3xl p-6 shadow-2xl space-y-6 overflow-hidden">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <p className="text-white/40 font-black text-[10px] uppercase tracking-widest italic">{t('balanceTitle')}</p>
          <button onClick={onShowInfo} className="bg-white/5 px-2.5 py-1.5 rounded-lg border border-white/10 text-white/90 text-[10px] font-bold flex items-center gap-1.5"><HelpCircle size={14} className="text-blue-500" /> نموذجنا</button>
        </div>
        <div className="text-right">
           <h2 className="text-5xl font-black tracking-tighter text-white leading-none">{Number(user.balance).toFixed(2)}<span className="text-sm text-blue-500 italic ml-2">USDT</span></h2>
        </div>
      </div>
      <div className="flex gap-3 mt-6">
        <button onClick={onShowRecharge} className="flex-1 bg-white text-black font-black py-3.5 rounded-xl flex items-center justify-center gap-2 text-[12px] uppercase shadow-xl active:scale-95 transition-all"><ArrowDownCircle size={18} className="text-blue-600" /> {t('recharge')}</button>
        <button onClick={onShowWithdraw} className="flex-1 bg-blue-600 text-white font-black py-3.5 rounded-xl flex items-center justify-center gap-2 text-[12px] uppercase shadow-xl active:scale-95 transition-all"><ArrowUpCircle size={18} /> {t('withdraw')}</button>
      </div>
    </div>

    <div className="space-y-4 text-right">
       <h3 className="text-[10px] font-black uppercase text-slate-600 tracking-widest px-1">{t('history')}</h3>
       <div className="space-y-2.5">
         {user.transactions.slice(0, 5).map((tx: Transaction) => (
           <div key={tx.id} className="bg-[#0b0f1a] border border-white/5 p-4 rounded-xl flex justify-between items-center flex-row-reverse shadow-md">
              <div className="flex gap-3 flex-row-reverse items-center">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${tx.type === 'deposit' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : tx.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' : tx.status === 'completed' ? 'bg-blue-500/10 text-blue-500 border-blue-500/10' : 'bg-red-500/10 text-red-500 border-red-500/10'}`}>
                  {tx.status === 'pending' ? <Clock size={18}/> : tx.type === 'task' ? <TrendingUp size={18}/> : <Activity size={18}/>}
                </div>
                <div className="text-right">
                   <p className="text-[12px] font-black text-white uppercase italic leading-none">{tx.type === 'task' ? 'عائد تسييل' : tx.type === 'deposit' ? 'إيداع' : 'سحب'}</p>
                   <p className="text-[8px] text-slate-700 font-bold mt-1">{new Date(tx.date).toLocaleDateString()}</p>
                </div>
              </div>
              <div className={`text-left font-black italic text-sm ${tx.amount > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                 {tx.amount > 0 ? '+' : ''}{tx.amount.toFixed(2)}
              </div>
           </div>
         ))}
       </div>
    </div>
  </div>
);

const MachinesView = ({ user, onBuy, t, isProcessing }: any) => {
  const getTierInfo = (price: number) => {
    // التصنيف البصري بناءً على السعر لزيادة الإغراء
    if (price >= 200000) return { icon: Diamond, tier: 'GALACTIC OVERLORD', class: 'tier-diamond-fx animate-float shimmer-effect', badge: 'GOD-TIER', iconColor: 'text-rose-400' };
    if (price >= 50000) return { icon: Star, tier: 'DIAMOND SUPREME', class: 'tier-diamond-fx shimmer-effect', badge: 'LEGENDARY', iconColor: 'text-rose-300' };
    if (price >= 10000) return { icon: Flame, tier: 'PLATINUM NEBULA', class: 'tier-platinum-fx shimmer-effect', badge: 'EXCLUSIVE', iconColor: 'text-orange-400' };
    if (price >= 1000) return { icon: Crown, tier: 'GOLDEN QUANTUM', class: 'tier-gold-fx', badge: 'PREMIUM', iconColor: 'text-purple-400' };
    if (price >= 100) return { icon: Gem, tier: 'SILVER TITAN', class: 'border-emerald-500/20 bg-emerald-500/5', badge: 'ADVANCED', iconColor: 'text-emerald-400' };
    return { icon: Zap, tier: 'CORE NODE', class: 'border-blue-500/20 bg-blue-500/5', badge: 'ENTRY', iconColor: 'text-blue-400' };
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex justify-between items-center flex-row-reverse px-2">
        <h2 className="text-2xl font-black italic uppercase text-white flex items-center gap-3 flex-row-reverse">
          <Layers className="text-blue-500" size={28}/> 
          بروتوكول التعدين
        </h2>
        <div className="px-4 py-1.5 bg-blue-600/10 rounded-full border border-blue-500/30 flex items-center gap-2 shadow-[0_0_15px_rgba(37,99,235,0.2)]">
           <Activity size={14} className="text-blue-500 animate-pulse" />
           <span className="text-[10px] font-black uppercase text-blue-500 tracking-wider">Network Peak Efficiency</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 pb-10">
        {MACHINES.map((m: any) => {
          const owned = user.ownedMachines.some((om: any) => om.machine_id === m.id);
          const tier = getTierInfo(m.price);
          const TierIcon = tier.icon;
          
          return (
            <div key={m.id} className={`relative rounded-[2.5rem] p-7 transition-all duration-700 border shadow-2xl group ${tier.class} hover:scale-[1.03] active:scale-[1.01]`}>
              {/* Top Bar Decoration */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/3 h-1 bg-white/10 rounded-b-full"></div>

              {/* Status Badge */}
              <div className="absolute -top-3 -right-3 z-30">
                <div className={`px-4 py-1.5 rounded-2xl text-[8px] font-black uppercase tracking-[0.2em] border shadow-2xl ${owned ? 'bg-emerald-600 border-emerald-400 text-white animate-pulse' : 'bg-black/80 border-white/20 text-white/60'}`}>
                  {owned ? 'ACTIVE DEPLOYMENT' : tier.badge}
                </div>
              </div>

              {/* Header: Icon and Price */}
              <div className="flex justify-between items-start flex-row-reverse mb-8">
                <div className="flex gap-5 flex-row-reverse items-center">
                  <div className={`w-16 h-16 bg-gradient-to-br ${m.color} rounded-3xl flex items-center justify-center border border-white/20 shadow-[0_0_25px_rgba(255,255,255,0.1)] group-hover:rotate-6 transition-all duration-500`}>
                    <TierIcon size={32} className="text-white drop-shadow-lg" />
                  </div>
                  <div className="text-right">
                    <h3 className="font-black text-lg text-white uppercase italic leading-none tracking-tight">{m.name}</h3>
                    <p className={`text-[9px] font-black mt-2 tracking-[0.25em] uppercase neon-text ${tier.iconColor}`}>
                      {tier.tier}
                    </p>
                  </div>
                </div>
                <div className="text-left bg-black/40 px-4 py-3 rounded-2xl border border-white/5 shadow-inner">
                  <div className="flex items-center gap-1 mb-1">
                    <span className="text-3xl font-black text-white leading-none tracking-tighter">{m.price}</span>
                    <span className="text-[10px] font-bold text-blue-500 uppercase">USDT</span>
                  </div>
                  <p className="text-[7px] text-white/30 font-black uppercase italic leading-none text-right">SECURE STAKE</p>
                </div>
              </div>

              {/* Stats: ROI and Returns */}
              <div className="grid grid-cols-2 gap-5 mb-8">
                <div className="bg-black/30 backdrop-blur-md p-5 rounded-3xl text-right border border-white/5 relative overflow-hidden group-hover:border-emerald-500/20 transition-all">
                  <p className="text-[8px] font-black uppercase text-slate-500 mb-2 tracking-widest">Daily Revenue</p>
                  <div className="flex items-center justify-end gap-1.5">
                    <TrendingUp size={16} className="text-emerald-500" />
                    <p className="text-2xl font-black text-emerald-500 italic neon-text leading-none">+{m.dailyProfit}</p>
                  </div>
                  <div className="absolute -bottom-2 -left-2 w-10 h-10 bg-emerald-500/10 blur-xl"></div>
                </div>
                <div className="bg-black/30 backdrop-blur-md p-5 rounded-3xl text-right border border-white/5 relative overflow-hidden group-hover:border-blue-500/20 transition-all">
                  <p className="text-[8px] font-black uppercase text-slate-500 mb-2 tracking-widest">Protocol Cycle</p>
                  <p className="text-2xl font-black text-white italic leading-none">{m.duration}<span className="text-xs text-white/40 ml-1">DAYS</span></p>
                  <div className="absolute -bottom-2 -left-2 w-10 h-10 bg-blue-500/10 blur-xl"></div>
                </div>
              </div>

              {/* Action Button */}
              <div className="relative pt-2">
                <button 
                  onClick={() => onBuy(m)} 
                  disabled={owned || isProcessing} 
                  className={`w-full py-5 rounded-2xl font-black text-[13px] uppercase tracking-[0.25em] transition-all shadow-2xl active:scale-95 flex items-center justify-center gap-3 ${owned ? 'bg-slate-900/80 text-slate-600 border border-white/5 cursor-default' : 'bg-white text-black hover:bg-blue-50 hover:shadow-[0_0_30px_rgba(255,255,255,0.2)]'}`}
                >
                  {owned ? (
                    <>
                      <Lock size={18} />
                      DEPLOYED
                    </>
                  ) : (
                    <>
                      <Zap size={18} className="fill-current" />
                      INITIATE PROTOCOL
                    </>
                  )}
                </button>
                {!owned && (
                  <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-4/5 h-6 bg-blue-500/20 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                )}
              </div>

              {/* Background Ambient Glow */}
              <div className={`absolute -bottom-20 -left-20 w-64 h-64 rounded-full blur-[120px] opacity-10 pointer-events-none bg-gradient-to-br ${m.color} group-hover:opacity-20 transition-all duration-700`}></div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const CountdownTimer = ({ lastClaimDate, onFinish }: { lastClaimDate: string | null, onFinish: () => void }) => {
  const [timeLeft, setTimeLeft] = useState<string>('');

  useEffect(() => {
    if (!lastClaimDate) return;

    const calculate = () => {
      const lastClaim = new Date(lastClaimDate).getTime();
      const now = Date.now();
      const diff = (lastClaim + 24 * 60 * 60 * 1000) - now;

      if (diff <= 0) {
        onFinish();
        return;
      }

      const h = Math.floor(diff / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
    };

    calculate();
    const interval = setInterval(calculate, 1000);
    return () => clearInterval(interval);
  }, [lastClaimDate, onFinish]);

  return (
    <div className="flex items-center gap-1.5 justify-center animate-pulse">
      <Clock size={12} className="text-blue-400" />
      <span className="font-mono text-sm tracking-widest text-blue-400">{timeLeft}</span>
    </div>
  );
};

const TasksView = ({ user, onComplete, t, isProcessing }: any) => {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <h2 className="text-xl font-black italic uppercase text-white flex items-center gap-3 flex-row-reverse px-1"><ListTodo className="text-blue-500" size={24}/> {t('tasks')}</h2>
      <div className="space-y-4">
          {(user.ownedMachines || []).map((um: UserMachine) => {
            const m = MACHINES.find(x => x.id === um.machine_id);
            const lastClaim = um.last_claim_date ? new Date(um.last_claim_date).getTime() : 0;
            const now = Date.now();
            const isLocked = um.last_claim_date && (now - lastClaim < 24 * 60 * 60 * 1000);

            return (
              <div key={um.id} className={`bg-[#0b0f1a] border ${isLocked ? 'border-white/5' : 'border-emerald-500/20 shadow-md'} rounded-2xl p-4 shadow-xl text-right`}>
                <div className="flex justify-between items-center flex-row-reverse mb-4">
                  <div className="text-right">
                    <h4 className="font-black text-sm text-white uppercase italic">{m?.name}</h4>
                    <p className="text-[8px] text-slate-700 font-bold mt-1 uppercase">Active • {um.remaining_days} days</p>
                  </div>
                  <div className={`text-left font-black italic text-lg ${isLocked ? 'text-slate-800' : 'text-emerald-500'}`}>
                    +{m?.dailyProfit}
                  </div>
                </div>
                
                <button 
                  disabled={isLocked || isProcessing} 
                  onClick={() => onComplete(um)} 
                  className={`w-full py-4 rounded-xl font-black uppercase text-[11px] tracking-widest transition-all ${isLocked ? 'bg-slate-900/50 text-slate-500 border border-white/5' : 'bg-emerald-600 text-white active:scale-95 shadow-lg'}`}
                >
                  {isLocked ? (
                    <CountdownTimer lastClaimDate={um.last_claim_date} onFinish={() => {}} />
                  ) : (
                    <div className="flex items-center justify-center gap-2">
                      <TrendingUp size={14} />
                      {t('completeTask')}
                    </div>
                  )}
                </button>
              </div>
            );
          })}
          {(!user.ownedMachines || user.ownedMachines.length === 0) && <div className="py-20 text-center text-slate-700 font-bold uppercase italic text-xs">لا توجد عقود نشطة</div>}
      </div>
    </div>
  );
};

const TeamView = ({ user, t }: any) => (
  <div className="space-y-6 animate-in fade-in duration-500">
    <h2 className="text-xl font-black italic uppercase text-white flex items-center gap-3 flex-row-reverse px-1"><Users className="text-blue-500" size={24}/> {t('team')}</h2>
    <div className="bg-[#0b0f1a] border border-white/10 rounded-3xl p-6 shadow-xl space-y-6">
      <div className="text-right space-y-2">
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">كود الإحالة</p>
        <div className="bg-black/40 p-4 rounded-xl flex items-center gap-3 border border-white/5">
          <button onClick={() => {navigator.clipboard.writeText(user.referral_code); alert('تم النسخ')}} className="p-3 bg-blue-600 text-white rounded-xl shadow-lg active:scale-90 transition-all"><Copy size={18}/></button>
          <span className="text-sm font-mono text-white flex-1 text-center tracking-widest">{user.referral_code}</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white/5 p-4 rounded-2xl text-right border border-white/5">
          <p className="text-[9px] font-black text-slate-500 uppercase mb-1">أرباح الفريق</p>
          <p className="text-2xl font-black text-emerald-500 italic">{Number(user.referralEarnings).toFixed(2)}</p>
        </div>
        <div className="bg-white/5 p-4 rounded-2xl text-right border border-white/5">
          <p className="text-[9px] font-black text-slate-500 uppercase mb-1">النسبة</p>
          <p className="text-2xl font-black text-blue-500 italic">10%</p>
        </div>
      </div>
    </div>
  </div>
);

const ProfileView = ({ user, t }: any) => (
  <div className="space-y-8 animate-in fade-in duration-700">
    <div className="relative p-6 bg-[#0b0f1a] border border-white/10 rounded-3xl shadow-xl flex items-center gap-6 flex-row-reverse justify-between">
       <div className="space-y-2 text-right z-10">
          <h3 className="text-2xl font-black italic text-white leading-tight">{user.first_name}<br/>{user.last_name}</h3>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-600/10 border border-blue-500/30 rounded-lg shadow-sm">
             <ShieldCheck size={14} className="text-blue-500" />
             <span className="text-[9px] font-black uppercase text-blue-500 tracking-widest">Elite Member</span>
          </div>
       </div>
       <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-800 border-4 border-[#020617] shadow-xl flex items-center justify-center p-2">
          <img src={`https://api.dicebear.com/7.x/bottts/svg?seed=${user.id}`} alt="Avatar" className="w-full h-full"/>
       </div>
    </div>
    <div className="grid grid-cols-2 gap-4">
      <div className="bg-[#0b0f1a] border border-white/10 rounded-2xl p-5 text-right shadow-md">
         <p className="text-[9px] text-slate-700 font-black uppercase mb-1 leading-none">إجمالي السحب</p>
         <p className="text-2xl font-black text-red-500 italic leading-none">{Number(user.totalWithdraw).toFixed(2)}</p>
      </div>
      <div className="bg-[#0b0f1a] border border-white/10 rounded-2xl p-5 text-right shadow-md">
         <p className="text-[9px] text-slate-700 font-black uppercase mb-1 leading-none">إجمالي الإيداع</p>
         <p className="text-2xl font-black text-emerald-500 italic leading-none">{Number(user.totalRecharge).toFixed(2)}</p>
      </div>
    </div>
  </div>
);

const AuthView = ({ lang, t, showToast }: any) => {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [handshakeTime, setHandshakeTime] = useState(0);
  const [formData, setFormData] = useState({ firstName: '', lastName: '', email: '', password: '', referralCode: '' });
  
  useEffect(() => {
    let interval: any;
    if (loading && handshakeTime < 100) {
      interval = setInterval(() => {
        setHandshakeTime(prev => Math.min(prev + 5, 100));
      }, 30);
    }
    return () => clearInterval(interval);
  }, [loading, handshakeTime]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setHandshakeTime(0);
    
    await new Promise(r => setTimeout(r, 600));

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ 
          email: formData.email, 
          password: formData.password 
        });
        if (error) { 
           showToast("خطأ في بيانات الدخول", 'error'); 
           setLoading(false); 
        }
      } else {
        const { error } = await supabase.auth.signUp({
          email: formData.email, 
          password: formData.password,
          options: { data: { first_name: formData.firstName, last_name: formData.lastName, referred_by: formData.referralCode } }
        });
        if (error) { showToast(error.message, 'error'); setLoading(false); }
        else { showToast('تم إنشاء الحساب، سجل دخولك الآن', 'success'); setIsLogin(true); setLoading(false); }
      }
    } catch (err: any) { showToast("فشل الاتصال بالخادم", 'error'); setLoading(false); }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-10 space-y-8 animate-in fade-in">
       <div className="relative">
          <div className="w-32 h-32 rounded-full border-2 border-blue-500/10 flex items-center justify-center shadow-2xl">
             <div className="absolute inset-0 border-t-2 border-blue-500 rounded-full animate-spin"></div>
             <span className="text-3xl font-black text-blue-500 italic font-mono">{handshakeTime}%</span>
          </div>
          <Activity className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-blue-500/40 animate-pulse" size={40} />
       </div>
       <div className="text-center space-y-2">
          <p className="text-white font-black uppercase text-xs tracking-widest italic animate-pulse">Syncing Network...</p>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Validating Digital Signature</p>
       </div>
    </div>
  );

  return (
    <div className={`min-h-screen bg-[#020617] p-6 flex flex-col justify-center ${lang === 'ar' ? 'rtl' : ''}`}>
      <div className="max-w-xs mx-auto w-full space-y-8 animate-in fade-in">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl mx-auto flex items-center justify-center shadow-2xl rotate-12 transition-all"><Zap size={32} className="text-white fill-white" /></div>
          <h1 className="text-4xl font-black italic tracking-tighter text-white uppercase leading-none">MINE<span className="text-blue-500">PRO</span></h1>
        </div>
        <div className="bg-[#0b0f1a] border border-white/10 rounded-3xl p-7 shadow-2xl space-y-7">
          <div className="flex bg-[#020617] p-1 rounded-xl border border-white/5">
            <button onClick={() => setIsLogin(true)} className={`flex-1 py-3 rounded-lg font-black text-[10px] transition-all uppercase tracking-widest ${isLogin ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-600'}`}>دخول</button>
            <button onClick={() => setIsLogin(false)} className={`flex-1 py-3 rounded-lg font-black text-[10px] transition-all uppercase tracking-widest ${!isLogin ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-800'}`}>تسجيل</button>
          </div>
          <form onSubmit={handleAuth} className="space-y-4">
            {!isLogin && <div className="grid grid-cols-2 gap-3"><Input icon={UserIcon} placeholder="الأول" value={formData.firstName} onChange={(v: string) => setFormData({...formData, firstName: v})} /><Input icon={UserIcon} placeholder="الأخير" value={formData.lastName} onChange={(v: string) => setFormData({...formData, lastName: v})} /></div>}
            <Input icon={Mail} type="email" placeholder="البريد الإلكتروني" value={formData.email} onChange={(v: string) => setFormData({...formData, email: v})} />
            <Input icon={Key} type="password" placeholder="كلمة المرور" value={formData.password} onChange={(v: string) => setFormData({...formData, password: v})} />
            <button disabled={loading} className="w-full bg-white text-black font-black py-4 rounded-xl uppercase tracking-widest text-[11px] shadow-2xl active:scale-95 transition-all flex justify-center items-center">
              دخول النظام
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

const Input = ({ icon: Icon, type = "text", placeholder, value, onChange }: any) => (
  <div className="relative group">
    <div className="absolute inset-y-0 right-4 flex items-center text-slate-800 group-focus-within:text-blue-500 transition-colors"><Icon size={18} /></div>
    <input type={type} required placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} className="w-full bg-[#020617] border border-white/5 pr-11 pl-4 py-3.5 rounded-xl text-xs font-bold outline-none focus:border-blue-500/40 text-white placeholder:text-slate-800 transition-all shadow-inner" />
  </div>
);

const AdminView = ({ t, showToast }: any) => {
  const [users, setUsers] = useState<any[]>([]);
  const [txs, setTxs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'deposits' | 'withdrawals' | 'users'>('deposits');
  const [historyMode, setHistoryMode] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userFullData, setUserFullData] = useState<{ machines: any[], transactions: any[] } | null>(null);
  const [isFetchingUser, setIsFetchingUser] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      const [profilesRes, txsRes] = await Promise.all([
        supabase.from('profiles').select('*'),
        supabase.from('transactions').select('*').order('date', { ascending: false })
      ]);
      if (profilesRes.data) setUsers(profilesRes.data);
      if (txsRes.data) setTxs(txsRes.data);
    } catch (e) { 
      showToast("خطأ في جلب بيانات الإدارة", "error"); 
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => { fetchData(); }, []);

  const fetchUserDetails = async (userId: string) => {
    setIsFetchingUser(true);
    setSelectedUserId(userId);
    try {
      const [machinesRes, transactionsRes] = await Promise.all([
        supabase.from('user_machines').select('*').eq('user_id', userId),
        supabase.from('transactions').select('*').eq('user_id', userId).order('date', { ascending: false })
      ]);
      setUserFullData({
        machines: machinesRes.data || [],
        transactions: transactionsRes.data || []
      });
    } catch (e) {
      showToast("خطأ في جلب تفاصيل المستخدم", "error");
    } finally {
      setIsFetchingUser(false);
    }
  };

  const handleAction = async (tx: any, newStatus: 'completed' | 'failed') => {
    const user = users.find(u => u.id === tx.user_id);
    if (!user) return;
    
    try {
      if (tx.type === 'deposit' && newStatus === 'completed') {
        await supabase.from('profiles').update({ balance: user.balance + tx.amount, total_recharge: (user.total_recharge || 0) + tx.amount }).eq('id', tx.user_id);
      }
      if (tx.type === 'withdrawal' && newStatus === 'failed') {
         await supabase.from('profiles').update({ balance: user.balance + Math.abs(tx.amount), withdrawable_balance: (user.withdrawable_balance || 0) + Math.abs(tx.amount) }).eq('id', tx.user_id);
      }
      await supabase.from('transactions').update({ status: newStatus }).eq('id', tx.id);
      fetchData();
      if (selectedUserId === tx.user_id) fetchUserDetails(tx.user_id); // Refresh modal if open
      showToast(`تم تحديث حالة المعاملة`, 'success');
    } catch (e) {
      showToast("فشل تحديث المعاملة", "error");
    }
  };

  if (loading) return <div className="p-10 text-center"><Loader2 className="animate-spin mx-auto text-blue-500" /></div>;

  const filteredTxs = txs.filter(t => {
    const typeMatch = t.type === (tab === 'deposits' ? 'deposit' : 'withdrawal');
    const statusMatch = historyMode ? (t.status === 'completed' || t.status === 'failed') : t.status === 'pending';
    return typeMatch && statusMatch;
  });

  const filteredUsers = users.filter(u => 
    u.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.referral_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.email && u.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const selectedUser = users.find(u => u.id === selectedUserId);

  return (
    <div className="space-y-6 animate-in fade-in relative">
      {/* User Details Modal */}
      {selectedUserId && selectedUser && (
        <div className="fixed inset-0 z-[150] bg-black/95 backdrop-blur-2xl flex flex-col p-4 animate-in fade-in slide-in-from-bottom-5">
           <div className="max-w-md mx-auto w-full flex-1 overflow-y-auto no-scrollbar space-y-6 pb-20">
              <div className="flex justify-between items-center bg-[#0b0f1a] p-4 rounded-2xl border border-white/10 sticky top-0 z-10 shadow-xl">
                 <button onClick={() => {setSelectedUserId(null); setUserFullData(null)}} className="p-2 bg-white/5 rounded-xl text-slate-400"><X size={20}/></button>
                 <div className="text-right">
                    <h3 className="font-black text-white italic text-base">{selectedUser.first_name} {selectedUser.last_name}</h3>
                    <p className="text-[8px] text-blue-500 font-mono font-black uppercase tracking-widest">{selectedUser.referral_code}</p>
                 </div>
              </div>

              {isFetchingUser ? (
                <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-blue-500" size={32} /></div>
              ) : userFullData && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                     <div className="bg-[#0b0f1a] p-4 rounded-2xl border border-white/5 text-right">
                        <p className="text-[9px] font-black text-slate-500 uppercase">الرصيد الكلي</p>
                        <p className="text-xl font-black text-white italic">{selectedUser.balance.toFixed(2)}</p>
                     </div>
                     <div className="bg-[#0b0f1a] p-4 rounded-2xl border border-white/5 text-right">
                        <p className="text-[9px] font-black text-slate-500 uppercase">قابل للسحب</p>
                        <p className="text-xl font-black text-red-500 italic">{selectedUser.withdrawable_balance.toFixed(2)}</p>
                     </div>
                  </div>

                  <div className="space-y-3">
                     <h4 className="text-[10px] font-black text-slate-500 uppercase px-1 flex items-center gap-2 flex-row-reverse"><Briefcase size={14} className="text-blue-500" /> العقود النشطة</h4>
                     {userFullData.machines.map((um: any) => {
                       const m = MACHINES.find(x => x.id === um.machine_id);
                       return (
                         <div key={um.id} className="bg-[#0b0f1a] border border-white/5 p-4 rounded-xl flex justify-between items-center flex-row-reverse">
                            <div className="text-right">
                               <p className="text-[12px] font-black text-white uppercase italic">{m?.name}</p>
                               <p className="text-[8px] text-slate-600 font-bold uppercase mt-1">متبقي {um.remaining_days} يوم</p>
                            </div>
                            <div className="text-left font-black italic text-emerald-500">+{m?.dailyProfit}</div>
                         </div>
                       );
                     })}
                     {userFullData.machines.length === 0 && <p className="text-[10px] text-center text-slate-700 py-4 italic font-bold">لا توجد عقود مفعلة</p>}
                  </div>

                  <div className="space-y-3">
                     <h4 className="text-[10px] font-black text-slate-500 uppercase px-1 flex items-center gap-2 flex-row-reverse"><History size={14} className="text-blue-500" /> سجل العمليات</h4>
                     {userFullData.transactions.map((t: any) => (
                       <div key={t.id} className="bg-[#0b0f1a] border border-white/5 p-4 rounded-xl space-y-3">
                          <div className="flex justify-between items-center flex-row-reverse">
                             <div className="text-right">
                                <p className="text-[11px] font-black text-white uppercase italic">{t.type === 'deposit' ? 'إيداع' : t.type === 'withdrawal' ? 'سحب' : 'مهمة'}</p>
                                <p className="text-[8px] text-slate-700 font-bold mt-1">{new Date(t.date).toLocaleDateString()}</p>
                             </div>
                             <div className={`text-left font-black italic text-sm ${t.amount > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                {t.amount > 0 ? '+' : ''}{t.amount.toFixed(2)}
                             </div>
                          </div>
                          <div className="flex justify-between items-center flex-row-reverse">
                             <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${t.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500' : t.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500' : 'bg-red-500/10 text-red-500'}`}>
                                {t.status === 'completed' ? 'مقبول' : t.status === 'pending' ? 'معلق' : 'مرفوض'}
                             </span>
                             {t.proof_url && <button onClick={() => window.open(t.proof_url, '_blank')} className="text-blue-500 text-[8px] font-black uppercase flex items-center gap-1">عرض الإثبات <ExternalLink size={10}/></button>}
                          </div>
                          {t.status === 'pending' && (
                             <div className="flex gap-2 pt-1">
                                <button onClick={() => handleAction(t, 'completed')} className="flex-1 bg-white text-black font-black py-2 rounded-lg text-[9px] uppercase">قبول</button>
                                <button onClick={() => handleAction(t, 'failed')} className="flex-1 bg-red-600/10 text-red-500 border border-red-500/20 font-black py-2 rounded-lg text-[9px] uppercase">رفض</button>
                             </div>
                          )}
                       </div>
                     ))}
                     {userFullData.transactions.length === 0 && <p className="text-[10px] text-center text-slate-700 py-4 italic font-bold">لا يوجد سجل عمليات</p>}
                  </div>
                </>
              )}
           </div>
        </div>
      )}

      <div className="flex bg-[#0b0f1a] p-1 rounded-2xl border border-white/10 shadow-xl overflow-x-auto no-scrollbar">
        {['deposits', 'withdrawals', 'users'].map((t: any) => (
          <button key={t} onClick={() => setTab(t)} className={`flex-1 py-3 rounded-lg font-black text-[9px] uppercase px-4 transition-all ${tab === t ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-600'}`}>{t === 'deposits' ? 'إيداع' : t === 'withdrawals' ? 'سحب' : 'أعضاء'}</button>
        ))}
      </div>

      {tab === 'users' && (
        <div className="relative group px-1">
          <div className="absolute inset-y-0 right-4 flex items-center text-slate-600"><Search size={16} /></div>
          <input 
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)} 
            placeholder="البحث عن مستخدم (الاسم، الكود، البريد)..." 
            className="w-full bg-[#0b0f1a] border border-white/10 pr-11 pl-4 py-3 rounded-xl text-[11px] font-bold text-white outline-none focus:border-blue-500/40 shadow-inner" 
          />
        </div>
      )}

      {(tab === 'deposits' || tab === 'withdrawals') && (
        <div className="flex bg-[#020617] p-1 rounded-xl border border-white/5 w-fit mx-auto shadow-inner">
          <button onClick={() => setHistoryMode(false)} className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${!historyMode ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-700'}`}>الطلبات الجديدة</button>
          <button onClick={() => setHistoryMode(true)} className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${historyMode ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-700'}`}>سجل الأرشيف</button>
        </div>
      )}

      <div className="space-y-4">
          {tab === 'users' ? filteredUsers.map(u => (
            <div 
              key={u.id} 
              onClick={() => fetchUserDetails(u.id)}
              className="bg-[#0b0f1a] border border-white/10 p-5 rounded-2xl flex justify-between items-center flex-row-reverse shadow-xl hover:border-blue-500/30 transition-all group cursor-pointer"
            >
              <div className="text-right flex items-center gap-3 flex-row-reverse">
                 <div className="w-12 h-12 bg-blue-600/10 rounded-xl flex items-center justify-center border border-blue-500/20 group-hover:bg-blue-600 group-hover:text-white transition-all">
                    <UserIcon size={22} className="transition-all" />
                 </div>
                 <div>
                    <h4 className="font-black text-white italic text-base leading-none">{u.first_name} {u.last_name}</h4>
                    <p className="text-[9px] text-slate-600 font-mono mt-1 uppercase">{u.referral_code}</p>
                 </div>
              </div>
              <div className="text-left">
                 <p className="font-black italic text-blue-500 text-xl tracking-tighter leading-none">{u.balance.toFixed(2)}</p>
                 <p className="text-[7px] text-slate-700 font-black uppercase mt-1">عرض الملف</p>
              </div>
            </div>
          )) : filteredTxs.map(t => {
            const txUser = users.find(u => u.id === t.user_id);
            return (
              <div key={t.id} className="bg-[#0b0f1a] border border-white/5 p-5 rounded-2xl text-right space-y-4 shadow-xl border-l-4 border-l-blue-500/20">
                 <div className="flex justify-between items-center flex-row-reverse border-b border-white/5 pb-4">
                    <div 
                      onClick={() => fetchUserDetails(t.user_id)}
                      className="text-right flex items-center gap-2 flex-row-reverse cursor-pointer group"
                    >
                      <div className="w-8 h-8 bg-blue-600/10 rounded-lg flex items-center justify-center text-blue-500 group-hover:bg-blue-600 group-hover:text-white transition-all"><UserIcon size={14}/></div>
                      <div>
                        <p className="text-[11px] font-black text-white group-hover:text-blue-400 transition-colors">{txUser?.first_name} {txUser?.last_name}</p>
                        <p className="text-[8px] text-slate-600 font-bold uppercase tracking-widest">{txUser?.referral_code}</p>
                      </div>
                    </div>
                    <div className="text-left">
                       <p className="text-[9px] font-black text-slate-500 uppercase italic">المبلغ بالعملة</p>
                       <div className="font-black italic text-xl text-white">{Math.abs(t.amount)} USDT</div>
                    </div>
                 </div>
                 {t.details && <p className="text-[10px] font-mono text-blue-400 break-all bg-black/40 p-3 rounded-xl border border-white/5">{t.details}</p>}
                 {t.proof_url && (
                  <div className="relative group cursor-pointer overflow-hidden rounded-xl border border-white/10" onClick={() => window.open(t.proof_url, '_blank')}>
                     <img src={t.proof_url} className="w-full h-auto max-h-48 object-contain bg-black/50" alt="Proof" />
                     <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <ExternalLink className="text-white" size={24} />
                        <span className="text-white text-[10px] font-bold mr-2 uppercase">عرض بالحجم الكامل</span>
                     </div>
                  </div>
                 )}
                 {!historyMode && (
                   <div className="flex gap-2 pt-2">
                      <button onClick={() => handleAction(t, 'completed')} className="flex-1 bg-white text-black font-black py-4 rounded-xl uppercase text-[10px] shadow-xl active:scale-95 transition-all">تفعيل الطلب</button>
                      <button onClick={() => handleAction(t, 'failed')} className="flex-1 bg-red-600/10 text-red-500 border border-red-500/20 font-black py-4 rounded-xl uppercase text-[10px] active:scale-95 transition-all">إلغاء الطلب</button>
                   </div>
                 )}
                 {historyMode && (
                   <div className="flex justify-between items-center">
                      <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase border ${t.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}`}>
                        {t.status === 'completed' ? 'تم القبول' : 'مرفوض'}
                      </span>
                      <p className="text-[8px] text-slate-700 font-bold uppercase">{new Date(t.date).toLocaleDateString()}</p>
                   </div>
                 )}
              </div>
            );
          })}
          {tab === 'users' && filteredUsers.length === 0 && (
            <div className="text-center py-24 text-slate-800 text-[10px] font-black uppercase italic tracking-widest animate-pulse">لا يوجد مستخدم بهذا الاسم</div>
          )}
          {tab !== 'users' && filteredTxs.length === 0 && (
            <div className="text-center py-24 text-slate-800 text-[10px] font-black uppercase italic tracking-widest animate-pulse">لا يوجد معاملات في هذا القسم حالياً</div>
          )}
      </div>
    </div>
  );
};

const RechargeModal = ({ t, onClose, onDeposit, showToast, userId, setIsProcessing, isProcessing }: any) => {
  const [amount, setAmount] = useState('');
  const [image, setImage] = useState('');
  const [progress, setProgress] = useState(0);
  const [internalLoading, setInternalLoading] = useState(false);

  const handleFileUpload = (e: any) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => { setImage(reader.result as string); };
      reader.readAsDataURL(file);
    }
  };

  const submit = async () => {
    if (internalLoading || isProcessing) return;
    if (!amount || !image) return showToast("يرجى إكمال جميع البيانات المطلوبة", "error");
    
    setInternalLoading(true);
    setIsProcessing(true);
    
    let currentProgress = 0;
    const interval = setInterval(() => {
      currentProgress += 10;
      setProgress(currentProgress);
      if (currentProgress >= 100) clearInterval(interval);
    }, 400);

    await new Promise(r => setTimeout(r, 4500));
    
    try {
      await supabase.from('transactions').insert({ 
        user_id: userId, 
        type: 'deposit', 
        amount: Number(amount), 
        status: 'pending', 
        proof_url: image 
      });
      showToast(t('verificationPending'), 'success');
      onDeposit();
      onClose();
    } catch (e) {
      showToast("خطأ في الاتصال بالبروتوكول", "error");
    } finally {
      setInternalLoading(false);
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-xl animate-in fade-in">
      <div className="bg-[#0b0f1a] border border-white/10 w-full max-sm rounded-3xl p-6 space-y-5 animate-in zoom-in-95 shadow-2xl overflow-hidden relative">
        {internalLoading && (
          <div className="absolute inset-0 z-50 bg-[#0b0f1a]/98 flex flex-col items-center justify-center p-8 text-center space-y-6 animate-in fade-in">
             <div className="w-24 h-24 bg-blue-600/10 rounded-full flex items-center justify-center relative shadow-2xl">
                <div className="absolute inset-0 border-4 border-blue-500/10 rounded-full"></div>
                <div className="absolute inset-0 border-t-4 border-blue-500 rounded-full animate-spin"></div>
                <UploadCloud className="text-blue-500 animate-pulse" size={36} />
             </div>
             <div className="space-y-2">
                <p className="text-white font-black uppercase text-base italic tracking-tighter">Securing Transaction</p>
                <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">Encrypting Proof {progress}%</p>
             </div>
             <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden shadow-inner">
                <div className="h-full bg-blue-600 transition-all duration-300 shadow-[0_0_10px_rgba(37,99,235,0.8)]" style={{width: `${progress}%`}}></div>
             </div>
          </div>
        )}

        <div className="flex justify-between items-center bg-blue-600 p-4 rounded-xl shadow-xl">
          <h3 className="font-black text-white text-sm uppercase tracking-tighter italic">إيداع أصول بروتوكول</h3>
          <button onClick={onClose} className="text-white hover:bg-white/10 p-1 rounded-lg transition-all"><X size={20} /></button>
        </div>
        
        <div className="bg-blue-600/5 border border-blue-500/10 p-5 rounded-2xl space-y-3 text-right shadow-inner">
           <p className="text-[9px] font-black text-blue-500 uppercase italic">عنوان محفظة الإيداع (BEP20)</p>
           <div className="bg-black/40 p-4 rounded-xl flex items-center gap-3 border border-white/5 shadow-inner">
              <button onClick={() => {navigator.clipboard.writeText(DEPOSIT_ADDRESS); showToast('تم نسخ العنوان بنجاح', 'success')}} className="p-2.5 bg-blue-600 text-white rounded-xl active:scale-90 transition-all shadow-lg"><Copy size={16}/></button>
              <span className="text-[9px] font-mono text-slate-500 break-all flex-1 text-center font-bold">{DEPOSIT_ADDRESS}</span>
           </div>
        </div>

        <div className="space-y-2 text-right">
          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mr-1">المبلغ المراد شحنه (USDT)</p>
          <input type="number" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} className="w-full bg-black/40 border border-white/10 p-5 rounded-2xl text-white font-black text-center text-3xl outline-none focus:border-blue-500/40 transition-all shadow-inner" />
        </div>

        <div className="space-y-3 text-right">
          <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl text-right flex gap-3 items-start flex-row-reverse">
             <Info className="text-blue-500 shrink-0 mt-0.5" size={16} />
             <p className="text-[10px] font-bold text-slate-300 leading-relaxed">
               قم بنسخ العنوان أعلاه، اذهب لمحفظتك وقم بتحويل المبلغ المطلوب عبر شبكة BEP20، ثم التقط صورة لعملية التحويل الناجحة وأرفقها في الأسفل ليتم تفعيل رصيدك.
             </p>
          </div>
          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mr-1">إثبات التحويل (Screenshot)</p>
          <label className="block border-2 border-dashed border-white/10 rounded-2xl p-8 text-center bg-white/5 cursor-pointer hover:border-blue-500/30 transition-all shadow-inner relative group">
             <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
             {image ? (
               <img src={image} className="w-24 h-24 mx-auto rounded-xl object-cover border-2 border-blue-500 shadow-2xl" />
             ) : (
               <div className="space-y-3">
                 <UploadCloud size={40} className="mx-auto text-blue-500 opacity-60 group-hover:opacity-100 transition-all" />
                 <p className="text-[10px] uppercase font-black text-slate-600 tracking-widest">إرفاق لقطة الشاشة</p>
               </div>
             )}
          </label>
        </div>

        <button onClick={submit} disabled={internalLoading || isProcessing} className="w-full bg-white text-black font-black py-4.5 rounded-2xl uppercase text-xs active:scale-95 transition-all shadow-2xl hover:bg-slate-50 flex items-center justify-center gap-2">
           {internalLoading ? <Loader2 className="animate-spin" size={16} /> : "إرسال طلب الإيداع"}
        </button>
      </div>
    </div>
  );
};

const WithdrawModal = ({ t, onClose, onWithdraw, max, userId, balance, showToast, setIsProcessing, isProcessing, user }: any) => {
  const [amount, setAmount] = useState('');
  const [address, setAddress] = useState('');
  const [internalLoading, setInternalLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  
  const submit = async () => {
    if (internalLoading || isProcessing) return;
    
    if (user.lastWithdrawDate) {
      const lastDate = new Date(user.lastWithdrawDate).toDateString();
      const today = new Date().toDateString();
      if (lastDate === today) {
        return showToast("عذراً، يسمح بعملية سحب واحدة فقط كل 24 ساعة", "error");
      }
    }

    const amt = Number(amount);
    if (amt < MIN_WITHDRAWAL) return showToast(`الحد الأدنى للسحب هو ${MIN_WITHDRAWAL} USDT`, 'error');
    if (amt > max) return showToast("عذراً، رصيدك المتاح للسحب غير كافٍ", "error");
    if (!address.trim()) return showToast("يرجى إدخال عنوان المحفظة بشكل صحيح", "error");
    
    setInternalLoading(true);
    setIsProcessing(true);

    let currentProgress = 0;
    const interval = setInterval(() => {
      currentProgress += 10;
      setProgress(currentProgress);
      if (currentProgress >= 100) clearInterval(interval);
    }, 400);

    await new Promise(r => setTimeout(r, 4500));
    
    try {
      const nowISO = new Date().toISOString();
      await supabase.from('transactions').insert({ 
        user_id: userId, 
        type: 'withdrawal', 
        amount: -amt, 
        status: 'pending', 
        details: `Address: ${address}`,
        date: nowISO
      });
      await supabase.from('profiles').update({ 
        balance: balance - amt, 
        withdrawable_balance: max - amt,
        last_withdraw_date: nowISO
      }).eq('id', userId);
      
      onWithdraw(); 
      onClose(); 
      showToast("تم إرسال طلب تسييل الأصول بنجاح", 'success');
    } catch (e) {
      showToast("فشل في معالجة طلب السحب", "error");
    } finally {
      setInternalLoading(false);
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-xl animate-in fade-in">
      <div className="bg-[#0b0f1a] border border-white/10 w-full max-sm rounded-3xl p-6 space-y-6 animate-in zoom-in-95 shadow-2xl relative overflow-hidden">
        {internalLoading && (
          <div className="absolute inset-0 z-50 bg-[#0b0f1a]/98 flex flex-col items-center justify-center p-8 text-center space-y-6 animate-in fade-in">
             <div className="w-24 h-24 bg-red-600/10 rounded-full flex items-center justify-center relative shadow-2xl">
                <div className="absolute inset-0 border-4 border-red-500/10 rounded-full"></div>
                <div className="absolute inset-0 border-t-4 border-red-600 rounded-full animate-spin"></div>
                <Activity className="text-red-500 animate-pulse" size={36} />
             </div>
             <div className="space-y-2">
                <p className="text-white font-black uppercase text-base italic tracking-tighter">Securing Withdrawal</p>
                <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">Encrypting Wallet Protocol {progress}%</p>
             </div>
             <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden shadow-inner">
                <div className="h-full bg-red-600 transition-all duration-300 shadow-[0_0_10px_rgba(220,38,38,0.8)]" style={{width: `${progress}%`}}></div>
             </div>
          </div>
        )}

        <div className="flex justify-between items-center bg-red-600 p-4 rounded-xl shadow-2xl">
          <h3 className="font-black text-white text-sm uppercase italic tracking-tighter">تسييل أصول البروتوكول</h3>
          <button onClick={onClose} className="text-white hover:bg-white/10 p-1 rounded-lg transition-all"><X size={20} /></button>
        </div>
        
        <div className="bg-red-600/5 p-5 rounded-2xl flex justify-between items-center flex-row-reverse border border-red-500/10 shadow-inner">
           <span className="text-[9px] font-black text-slate-500 uppercase">متاح للتسييل</span>
           <span className="text-2xl font-black text-red-500 italic tracking-tighter">{max.toFixed(2)} USDT</span>
        </div>

        <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-xl text-right flex gap-3 items-start flex-row-reverse">
             <Info className="text-yellow-500 shrink-0 mt-0.5" size={16} />
             <p className="text-[10px] font-bold text-yellow-200/80 leading-relaxed">
               تذكير: يسمح النظام بعملية سحب واحدة فقط كل 24 ساعة لضمان استقرار السيولة في البروتوكول.
             </p>
        </div>

        <div className="space-y-2 text-right">
           <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mr-1">عنوان المحفظة المستلمة (BEP20)</p>
           <input value={address} onChange={e => setAddress(e.target.value)} placeholder="0x... (BEP20 Network Only)" className="w-full bg-black/40 border border-white/10 p-5 rounded-2xl text-white font-mono text-xs outline-none focus:border-red-500/40 transition-all shadow-inner" />
        </div>

        <div className="space-y-2 text-right">
           <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mr-1">المبلغ المراد سحبه (Min 8)</p>
           <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className="w-full bg-black/40 border border-white/10 p-5 rounded-2xl text-white font-black text-center text-3xl outline-none focus:border-red-500/40 transition-all shadow-inner" />
        </div>

        <button onClick={submit} disabled={internalLoading || isProcessing} className="w-full bg-red-600 text-white font-black py-4.5 rounded-2xl uppercase text-xs active:scale-95 transition-all shadow-2xl disabled:opacity-50 flex items-center justify-center gap-2">
           {internalLoading ? <Loader2 className="animate-spin" size={16} /> : "تأكيد طلب التسييل"}
        </button>
      </div>
    </div>
  );
};

const InfoModal = ({ onClose }: any) => (
  <div className="fixed inset-0 z-[250] flex items-center justify-center p-6 bg-[#020617]/95 backdrop-blur-xl animate-in fade-in">
    <div className="bg-[#0b0f1a] border border-white/10 w-full max-sm rounded-3xl p-8 text-right space-y-6 animate-in zoom-in-95 shadow-2xl overflow-y-auto no-scrollbar max-h-[90vh]">
      <div className="w-16 h-16 bg-blue-600/10 rounded-2xl flex items-center justify-center text-blue-500 mx-auto border border-blue-500/20 shadow-lg"><ShieldCheck size={32}/></div>
      <h3 className="font-black text-white text-xl uppercase italic text-center tracking-tighter leading-none">بروتوكول تسييل الأصول</h3>
      
      <div className="space-y-4 text-right">
        <div className="bg-white/5 p-4 rounded-xl border border-white/5">
          <p className="text-[12px] font-black text-blue-500 uppercase mb-2">كيف يعمل النظام؟</p>
          <p className="text-[11px] leading-relaxed text-slate-300 italic">
            نحن نعمل كجسر لتسييل وتحويل الأصول الرقمية (غسيل الأموال) ليتم وصولها من محافظ رسمية. نقوم باستلام أصول وتوزيعها عبر شبكة أعضاء "MINEPRO" لتصل إلينا لاحقاً كأموال مشروعة من آلاف المحافظ الرسمية والمستقلة.
          </p>
        </div>

        <div className="bg-white/5 p-4 rounded-xl border border-white/5">
          <p className="text-[12px] font-black text-emerald-500 uppercase mb-2">ما هو مكسبنا؟</p>
          <p className="text-[11px] leading-relaxed text-slate-300 italic">
            مكسبنا الرئيسي يكمن في "شرعنة الأصول". من خلال تحويل المبالغ الغير مشروعة عبر حساباتكم الكثيرة، تصبح هذه الأموال مشروعة تماماً في النظام المالي العالمي، ونحن نقتطع نسبة تشغيلية صغيرة مقابل هذا التأمين، بينما تحصلون أنتم على العائد الأكبر لمشاركتكم كـ "عقدة بروتوكول".
          </p>
        </div>

        <div className="bg-blue-600/10 p-4 rounded-xl border border-blue-500/20">
          <p className="text-[12px] font-black text-white uppercase mb-2">الحماية القانونية</p>
          <p className="text-[11px] leading-relaxed text-blue-200/80 italic">
            أنت محمي تماماً. جميع بياناتك مشفرة ببروتوكول AES-256 المتطور تحت عمليات معقدة. نشاطك لا يظهر لأي جهة رقابية كمعاملة مالية مباشرة، بل يظهر كنشاط "تعدين وتسييل تقني". معلوماتك لن تظهر لأي جهاز، ولن تتعرض لأي مساءلة قانونية لأنك جزء من شبكة عالمية مشفرة ومنيعة.
          </p>
        </div>
      </div>

      <button onClick={onClose} className="w-full bg-white text-black font-black py-4 rounded-xl uppercase text-[11px] active:scale-95 transition-all shadow-xl">تفعيل التشفير والمتابعة</button>
    </div>
  </div>
);

const SupportChatModal = ({ userId, onClose }: any) => {
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchMessages = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase.from('support_messages').select('*').or(`sender_id.eq.${userId},receiver_id.eq.${userId}`).order('created_at', { ascending: true });
    if (data) setMessages(data);
  }, [userId]);

  useEffect(() => {
    fetchMessages();
    const sub = supabase.channel('support').on('postgres_changes', { event: '*', table: 'support_messages' }, fetchMessages).subscribe();
    return () => { sub.unsubscribe(); };
  }, [userId, fetchMessages]);

  useEffect(() => { scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight); }, [messages]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !userId) return;
    const msg = newMessage;
    setNewMessage('');
    await supabase.from('support_messages').insert({ sender_id: userId, receiver_id: 'ADMIN', message: msg });
  };

  return (
    <div className="fixed inset-0 z-[200] bg-[#020617]/98 backdrop-blur-xl flex flex-col animate-in fade-in">
      <div className="p-5 border-b border-white/5 flex justify-between items-center bg-[#0b0f1a] shadow-2xl">
        <button onClick={onClose} className="p-3 bg-white/5 rounded-xl text-slate-400 active:scale-90 transition-all"><X size={20}/></button>
        <h3 className="font-black text-white italic text-lg uppercase tracking-tighter">مركز الدعم الأمن</h3>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar bg-gradient-to-b from-[#020617] to-black">
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.sender_id === userId ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-4 rounded-2xl text-[13px] font-bold shadow-lg ${m.sender_id === userId ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white/5 text-slate-300 border border-white/5 rounded-tl-none'}`}>
              {m.message}
            </div>
          </div>
        ))}
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center space-y-4 opacity-20">
             <MessageCircle size={64} className="text-slate-500" />
             <p className="text-[10px] font-black uppercase tracking-widest">ابدأ محادثة مع الدعم</p>
          </div>
        )}
      </div>
      <div className="p-6 bg-[#0b0f1a]/80 border-t border-white/5 flex gap-3 shadow-2xl">
        <button onClick={sendMessage} className="p-4 bg-blue-600 text-white rounded-xl active:scale-90 transition-all shadow-xl"><Send size={20}/></button>
        <input value={newMessage} onChange={e => setNewMessage(e.target.value)} onKeyPress={e => e.key === 'Enter' && sendMessage()} placeholder="كيف يمكننا خدمتك اليوم؟" className="flex-1 bg-white/5 border border-white/10 rounded-xl px-5 text-sm text-white outline-none focus:border-blue-500/40 transition-all shadow-inner" />
      </div>
    </div>
  );
};

export default App;
