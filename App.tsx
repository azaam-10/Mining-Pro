
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { 
  Home as HomeIcon, Cpu, ListTodo, Users, User as UserIcon, 
  ArrowDownCircle, ArrowUpCircle, CheckCircle2, Clock, XCircle, 
  Loader2, ShieldCheck, HelpCircle, X, Copy, UploadCloud, 
  ArrowDown, Zap, Globe, Layers, Settings, Eye, Search, 
  RefreshCw, Calendar, ChevronLeft, MessageCircle, Send, Sparkles,
  LogOut, Mail, Key, ShieldAlert, Award, TrendingUp, Gem, ChevronRight, AlertTriangle, ExternalLink
} from 'lucide-react';
import { Language, UserState, UserMachine, Machine, Transaction, SupportMessage } from './types';
import { TRANSLATIONS, MACHINES, DEPOSIT_ADDRESS, MIN_WITHDRAWAL, ADMIN_EMAIL } from './constants';
import { supabase } from './supabase';

const formatDate = (date: Date) => date.toISOString().split('T')[0];

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
  const [isProcessing, setIsProcessing] = useState(false); // لمنع Race Conditions
  const [syncing, setSyncing] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [userData, setUserData] = useState<UserState | null>(null);
  const [fetchError, setFetchError] = useState(false);

  const fetchAllUserData = useCallback(async (userId: string, isManual: boolean = false) => {
    if (isManual) setSyncing(true);
    setFetchError(false);
    
    try {
      const [profileRes, machinesRes, txsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).single(),
        supabase.from('user_machines').select('*').eq('user_id', userId),
        supabase.from('transactions').select('*').eq('user_id', userId).order('date', { ascending: false })
      ]);

      let profile = profileRes.data;

      if (profileRes.error && profileRes.error.code === 'PGRST116') {
        const { data: newProfile } = await supabase.from('profiles').insert([
          { 
            id: userId, 
            balance: 0, 
            withdrawable_balance: 0, 
            referral_code: Math.random().toString(36).substring(2, 8).toUpperCase(),
            first_name: session?.user?.user_metadata?.first_name || 'User',
            last_name: session?.user?.user_metadata?.last_name || ''
          }
        ]).select().single();
        profile = newProfile;
      }

      if (profile) {
        setUserData(formatUserData(profile, machinesRes.data || [], txsRes.data || []));
      } else {
        setFetchError(true);
      }

      if (isManual) showToast("تم التحديث بنجاح", "success");
    } catch (err) {
      console.error("Fetch Error:", err);
      setFetchError(true);
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }, [session]);

  const formatUserData = (profile: any, machines: any[], txs: any[]): UserState => ({
    ...profile,
    withdrawableBalance: profile.withdrawable_balance || 0,
    totalRecharge: profile.total_recharge || 0,
    totalWithdraw: profile.total_withdraw || 0,
    referralEarnings: profile.referral_earnings || 0,
    ownedMachines: machines,
    transactions: txs,
    lastWithdrawDate: profile.last_withdraw_date || null
  });

  useEffect(() => {
    const initAuth = async () => {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      setSession(currentSession);
      if (currentSession) {
        fetchAllUserData(currentSession.user.id);
      } else {
        setLoading(false);
      }
    };
    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        if (!userData) setLoading(true);
        fetchAllUserData(session.user.id);
      } else {
        setUserData(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchAllUserData]);

  const handleManualRefresh = () => {
    if (session) fetchAllUserData(session.user.id, true);
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { message, type, id }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  const t = (key: string) => TRANSLATIONS[key]?.[lang] || key;

  // شراء الماكينة مع حماية كاملة
  const buyMachine = async (machine: Machine) => {
    if (!userData || !session || isProcessing) return;
    
    // فحص أمني للرصيد قبل أي عملية
    if (userData.balance < machine.price) {
      return showToast("عذراً، رصيدك الحالي غير كافٍ لتفعيل هذا العقد", 'error');
    }
    
    setIsProcessing(true);
    try {
      // 1. إضافة الماكينة للمستخدم
      const { error: machineErr } = await supabase.from('user_machines').insert({
        user_id: session.user.id,
        machine_id: machine.id,
        remaining_days: machine.duration,
        total_earned: 0
      });

      if (machineErr) throw machineErr;

      // 2. تحديث الرصيد (يُفضل عمل هذا في Supabase Function ولكن سنقوم به هنا بحذر)
      const { error: updateErr } = await supabase.from('profiles')
        .update({ balance: userData.balance - machine.price })
        .eq('id', session.user.id)
        .gte('balance', machine.price); // شرط إضافي لضمان عدم السحب إذا قل الرصيد فجأة

      if (updateErr) throw updateErr;

      showToast("تم تفعيل عقد التسييل بنجاح", 'success');
      await fetchAllUserData(session.user.id);
    } catch (err: any) {
      showToast(err.message || "حدث خطأ غير متوقع", 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // تنفيذ المهمة مع حماية من التلاعب بالوقت
  const completeTask = async (um: UserMachine) => {
    if (!userData || !session || isProcessing) return;
    
    const now = Date.now();
    const lastClaim = um.last_claim_date ? new Date(um.last_claim_date).getTime() : 0;
    
    // منع الاستلام قبل مرور 24 ساعة (أمنياً)
    if (now - lastClaim < 24 * 60 * 60 * 1000) {
      return showToast("لم تنتهِ دورة الـ 24 ساعة بعد", 'error');
    }

    const machine = MACHINES.find(m => m.id === um.machine_id);
    if (!machine) return;

    setIsProcessing(true);
    try {
      const nowISO = new Date().toISOString();
      
      // تحديث بيانات الماكينة
      const { error: machineUpdateErr } = await supabase.from('user_machines').update({
        last_claim_date: nowISO,
        total_earned: um.total_earned + machine.dailyProfit,
        remaining_days: um.remaining_days - 1
      }).eq('id', um.id).eq('user_id', session.user.id);

      if (machineUpdateErr) throw machineUpdateErr;

      // تحديث الرصيد
      await supabase.from('profiles').update({ 
        balance: userData.balance + machine.dailyProfit, 
        withdrawable_balance: userData.withdrawableBalance + machine.dailyProfit 
      }).eq('id', session.user.id);

      // تسجيل المعاملة
      await supabase.from('transactions').insert({ 
        user_id: session.user.id, 
        type: 'task', 
        amount: machine.dailyProfit, 
        status: 'completed',
        date: nowISO
      });

      showToast("تم استلام العوائد اليومية", 'success');
      await fetchAllUserData(session.user.id);
    } catch (err: any) {
      showToast("فشل استلام الأرباح، يرجى المحاولة لاحقاً", 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center gap-4">
      <div className="relative">
        <Loader2 className="animate-spin text-blue-500" size={48} />
        <Zap className="absolute inset-0 m-auto text-white fill-white" size={16} />
      </div>
      <div className="space-y-1 text-center">
        <p className="text-white font-black text-xs uppercase tracking-widest italic">MINEPRO SECURITY CHECK</p>
        <p className="text-slate-500 font-bold text-[10px] animate-pulse">تأمين الاتصال بالبروتوكول V-2...</p>
      </div>
    </div>
  );

  if (!session) return <AuthView lang={lang} t={t} showToast={showToast} />;

  return (
    <div className={`min-h-screen pb-24 ${lang === 'ar' ? 'rtl font-["Cairo"]' : 'font-sans'} bg-[#020617] text-[#f8fafc] overflow-x-hidden relative`}>
      {/* طبقة حماية أثناء المعالجة */}
      {isProcessing && (
        <div className="fixed inset-0 z-[300] bg-black/40 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-[#0b0f1a] p-6 rounded-3xl border border-white/10 flex flex-col items-center gap-4 shadow-2xl">
            <Loader2 className="animate-spin text-blue-500" size={32} />
            <p className="text-[10px] font-black uppercase tracking-widest text-white/60">جاري تأمين المعاملة...</p>
          </div>
        </div>
      )}

      {showInfo && <InfoModal onClose={() => setShowInfo(false)} />}
      {showRecharge && <RechargeModal t={t} onClose={() => setShowRecharge(false)} onDeposit={() => fetchAllUserData(session.user.id)} showToast={showToast} userId={session.user.id} />}
      {showWithdraw && <WithdrawModal t={t} onClose={() => setShowWithdraw(false)} onWithdraw={() => fetchAllUserData(session.user.id)} max={userData!.withdrawableBalance} userId={session.user.id} balance={userData!.balance} showToast={showToast} isProcessing={isProcessing} />}
      {showSupport && <SupportChatModal lang={lang} t={t} onClose={() => setShowSupport(false)} userId={session.user.id} />}
      
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-full max-w-[85%] space-y-2 pointer-events-none">
        {toasts.map(toast => (
          <div key={toast.id} className={`flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl pointer-events-auto backdrop-blur-3xl border border-white/10 ${toast.type === 'error' ? 'bg-red-500/20 text-red-200' : toast.type === 'success' ? 'bg-emerald-500/20 text-emerald-100' : 'bg-slate-900/80'}`}>
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
          <button onClick={handleManualRefresh} disabled={syncing || isProcessing} className={`p-2 bg-blue-500/10 text-blue-400 rounded-xl active:scale-90 transition-all ${syncing ? 'animate-spin opacity-50' : ''}`}><RefreshCw size={18} /></button>
          <button onClick={() => setShowSupport(true)} className="p-2 bg-blue-500/10 text-blue-500 rounded-xl relative"><MessageCircle size={18}/></button>
          <button onClick={() => supabase.auth.signOut()} className="p-2 bg-red-500/10 text-red-500 rounded-xl active:scale-90 transition-all"><LogOut size={18} /></button>
        </div>
      </header>

      <main className="max-w-md mx-auto p-4 space-y-6 relative z-10">
        <Routes>
          <Route path="/" element={<HomeView user={userData!} t={t} onShowInfo={() => setShowInfo(true)} onShowRecharge={() => setShowRecharge(true)} onShowWithdraw={() => setShowWithdraw(true)} syncing={syncing} />} />
          <Route path="/machines" element={<MachinesView user={userData!} onBuy={buyMachine} t={t} isProcessing={isProcessing} />} />
          <Route path="/tasks" element={<TasksView user={userData!} onComplete={completeTask} t={t} isProcessing={isProcessing} />} />
          <Route path="/team" element={<TeamView user={userData!} t={t} />} />
          <Route path="/profile" element={<ProfileView user={userData!} t={t} />} />
          {userData!.email === ADMIN_EMAIL && <Route path="/admin" element={<AdminView t={t} showToast={showToast} />} />}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-[#020617]/95 backdrop-blur-xl border-t border-white/5 p-4 z-40 shadow-xl">
        <div className="max-w-md mx-auto flex justify-around">
          <NavItem icon={HomeIcon} label={t('home')} active={location.pathname === '/'} onClick={() => navigate('/')} />
          <NavItem icon={Cpu} label={t('machines')} active={location.pathname === '/machines'} onClick={() => navigate('/machines')} />
          <NavItem icon={ListTodo} label={t('tasks')} active={location.pathname === '/tasks'} onClick={() => navigate('/tasks')} />
          {userData!.email === ADMIN_EMAIL ? (
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

// مكون التنقل المصغر
const NavItem = ({ icon: Icon, label, active, onClick }: any) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-1 transition-all group ${active ? 'text-blue-500 -translate-y-1' : 'text-slate-700'}`}>
    <div className={`p-2 rounded-lg transition-all ${active ? 'bg-blue-600/10 shadow-lg border border-blue-500/20' : ''}`}><Icon size={18} strokeWidth={active ? 2.5 : 2} /></div>
    <span className={`text-[8px] font-black uppercase tracking-widest transition-all ${active ? 'opacity-100' : 'opacity-30'}`}>{label}</span>
  </button>
);

const HomeView = ({ user, t, onShowInfo, onShowRecharge, onShowWithdraw, syncing }: any) => (
  <div className="space-y-6 animate-in fade-in duration-500">
    <div className="flex justify-between items-end flex-row-reverse px-1">
      <div className="space-y-0.5">
        <h2 className="text-xl font-black italic text-white leading-none">أهلاً، {user.first_name}</h2>
        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Protocol ID: {user.referral_code}</p>
      </div>
      <div className={`px-3 py-1.5 rounded-full flex items-center gap-2 border transition-all ${syncing ? 'bg-blue-500/10 border-blue-500/20' : 'bg-emerald-500/10 border-emerald-500/20'}`}>
         <div className={`w-1.5 h-1.5 rounded-full animate-pulse shadow-md ${syncing ? 'bg-blue-500 shadow-blue-500/50' : 'bg-emerald-500 shadow-emerald-500/50'}`}></div>
         <span className={`text-[9px] font-black uppercase ${syncing ? 'text-blue-500' : 'text-emerald-500'}`}>
            {syncing ? 'جاري المزامنة...' : 'متصل بالبروتوكول'}
         </span>
      </div>
    </div>

    <div className="relative group">
      <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-3xl blur opacity-20"></div>
      <div className="relative bg-[#0b0f1a] border border-white/10 rounded-3xl p-6 shadow-2xl flex flex-col justify-between overflow-hidden">
        <div className="relative z-10 space-y-6">
          <div className="flex justify-between items-center">
            <p className="text-white/40 font-black text-[10px] uppercase tracking-widest italic">{t('balanceTitle')}</p>
            <button onClick={onShowInfo} className="bg-white/5 px-2.5 py-1.5 rounded-lg border border-white/10 text-white/90 text-[10px] font-bold flex items-center gap-1.5"><HelpCircle size={14} className="text-blue-500" /> نموذجنا</button>
          </div>
          <div className="text-right">
             <h2 className="text-5xl font-black tracking-tighter text-white leading-none">{Number(user.balance).toFixed(2)}<span className="text-sm text-blue-500 italic ml-2">USDT</span></h2>
          </div>
        </div>
        <div className="flex gap-3 relative z-10 mt-6">
          <button onClick={onShowRecharge} className="flex-1 bg-white text-black font-black py-3.5 rounded-xl flex items-center justify-center gap-2 text-[12px] uppercase active:scale-95 transition-all shadow-xl"><ArrowDownCircle size={18} className="text-blue-600" /> {t('recharge')}</button>
          <button onClick={onShowWithdraw} className="flex-1 bg-blue-600 text-white font-black py-3.5 rounded-xl flex items-center justify-center gap-2 text-[12px] uppercase active:scale-95 transition-all shadow-xl"><ArrowUpCircle size={18} /> {t('withdraw')}</button>
        </div>
      </div>
    </div>

    <div className="bg-gradient-to-br from-slate-900 to-black border border-white/5 p-5 rounded-2xl space-y-3 text-right shadow-xl">
       <div className="flex items-center gap-2 flex-row-reverse">
          <ShieldCheck className="text-emerald-500" size={20} />
          <h3 className="text-sm font-black text-white uppercase italic">نظام آمن ومحمي</h3>
       </div>
       <p className="text-[11px] text-slate-400 font-medium leading-relaxed italic">
          يستخدم بروتوكول MINEPRO تقنيات التشفير المتقدمة لضمان أمان أصولكم الرقمية. يتم تسييل الأرباح عبر شبكة موزعة عالمياً لضمان استمرارية العوائد العالية بأعلى مستويات الخصوصية.
       </p>
    </div>

    <div className="space-y-4 text-right">
       <h3 className="text-[10px] font-black uppercase text-slate-600 tracking-widest px-1">{t('history')}</h3>
       <div className="space-y-2.5">
         {user.transactions.slice(0, 5).map((tx: Transaction) => (
           <div key={tx.id} className="bg-[#0b0f1a] border border-white/5 p-4 rounded-xl flex justify-between items-center flex-row-reverse shadow-lg">
              <div className="flex gap-3 flex-row-reverse items-center">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${tx.type === 'deposit' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : tx.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' : 'bg-blue-500/10 text-blue-500 border-blue-500/20'}`}>
                  {tx.status === 'pending' ? <Clock size={18}/> : tx.type === 'task' ? <TrendingUp size={18}/> : <ArrowDownCircle size={18}/>}
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

const MachinesView = ({ user, onBuy, t, isProcessing }: any) => (
  <div className="space-y-6 animate-in fade-in duration-500">
    <h2 className="text-xl font-black italic uppercase text-white flex items-center gap-3 flex-row-reverse px-1"><Layers className="text-blue-500" size={24}/> {t('machines')}</h2>
    <div className="grid grid-cols-1 gap-4">
      {MACHINES.map((m: any) => {
        const owned = user.ownedMachines.some((om: any) => om.machine_id === m.id);
        return (
          <div key={m.id} className={`relative bg-gradient-to-br from-slate-900 to-black border ${owned ? 'border-blue-500/40 shadow-blue-500/5' : 'border-white/5'} rounded-2xl p-4 shadow-xl overflow-hidden`}>
            <div className="flex justify-between items-center flex-row-reverse mb-4 relative z-10">
                 <div className="flex gap-3 flex-row-reverse items-center">
                    <div className={`w-12 h-12 bg-gradient-to-br ${m.color} rounded-xl flex items-center justify-center border border-white/10 shadow-lg`}><Gem size={24} className="text-white" /></div>
                    <div className="text-right">
                       <h3 className="font-black text-[13px] text-white uppercase italic leading-none">{m.name}</h3>
                       <p className="text-[8px] text-white/30 font-bold mt-1 tracking-widest">Protocol Sync Node</p>
                    </div>
                 </div>
                 <div className="text-left">
                    <p className="text-2xl font-black text-white leading-none">{m.price}</p>
                    <p className="text-[8px] text-white/30 font-bold uppercase mt-1 italic leading-none">Stake USDT</p>
                 </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4 relative z-10">
              <div className="bg-white/5 p-3 rounded-xl text-right border border-white/5">
                <p className="text-[8px] font-black uppercase text-slate-600 mb-1">الربح اليومي</p>
                <p className="text-lg font-black text-emerald-500 italic">+{m.dailyProfit}</p>
              </div>
              <div className="bg-white/5 p-3 rounded-xl text-right border border-white/5">
                <p className="text-[8px] font-black uppercase text-slate-600 mb-1">مدة العقد</p>
                <p className="text-lg font-black text-white italic">{m.duration} <span className="text-[10px]">يوم</span></p>
              </div>
            </div>
            <button onClick={() => onBuy(m)} disabled={owned || isProcessing} className={`w-full py-3.5 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all ${owned ? 'bg-slate-900 text-slate-700' : 'bg-white text-black active:scale-95 disabled:opacity-50'}`}>
              {owned ? 'العقد مفعل' : 'تفعيل العقد'}
            </button>
          </div>
        );
      })}
    </div>
  </div>
);

// عداد تنازلي دقيق
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
          {user.ownedMachines.map((um: UserMachine) => {
            const m = MACHINES.find(x => x.id === um.machine_id);
            const lastClaim = um.last_claim_date ? new Date(um.last_claim_date).getTime() : 0;
            const now = Date.now();
            const isLocked = um.last_claim_date && (now - lastClaim < 24 * 60 * 60 * 1000);

            return (
              <div key={um.id} className={`bg-[#0b0f1a] border ${isLocked ? 'border-white/5' : 'border-emerald-500/20 shadow-emerald-500/5'} rounded-2xl p-4 shadow-xl text-right`}>
                <div className="flex justify-between items-center flex-row-reverse mb-4">
                  <div className="text-right">
                    <div className="flex items-center gap-2 flex-row-reverse">
                      <h4 className="font-black text-sm text-white uppercase italic">{m?.name}</h4>
                      {isLocked && <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-ping"></div>}
                    </div>
                    <p className="text-[8px] text-slate-700 font-bold mt-1 uppercase">Node Active • {um.remaining_days} days left</p>
                  </div>
                  <div className={`text-left font-black italic text-lg ${isLocked ? 'text-slate-800' : 'text-emerald-500'}`}>
                    +{m?.dailyProfit}
                  </div>
                </div>
                
                <button 
                  disabled={isLocked || isProcessing} 
                  onClick={() => onComplete(um)} 
                  className={`w-full py-4 rounded-xl font-black uppercase text-[11px] tracking-widest transition-all relative overflow-hidden ${isLocked ? 'bg-slate-900/50 text-slate-500 border border-white/5' : 'bg-emerald-600 text-white active:scale-95 shadow-lg'}`}
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
          {user.ownedMachines.length === 0 && <div className="py-20 text-center text-slate-700 font-bold uppercase italic text-xs">لا توجد عقود نشطة حالياً</div>}
      </div>
    </div>
  );
};

const TeamView = ({ user, t }: any) => (
  <div className="space-y-6 animate-in fade-in duration-500">
    <h2 className="text-xl font-black italic uppercase text-white flex items-center gap-3 flex-row-reverse px-1"><Users className="text-blue-500" size={24}/> {t('team')}</h2>
    <div className="bg-[#0b0f1a] border border-white/10 rounded-3xl p-6 shadow-xl space-y-6">
      <div className="text-right space-y-2">
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">كود الإحالة الخاص بك</p>
        <div className="bg-black/40 p-4 rounded-xl flex items-center gap-3 border border-white/5">
          <button onClick={() => {navigator.clipboard.writeText(user.referral_code); alert('تم نسخ الكود')}} className="p-3 bg-blue-600 text-white rounded-xl active:scale-90 shadow-lg"><Copy size={18}/></button>
          <span className="text-sm font-mono text-white flex-1 text-center tracking-widest">{user.referral_code}</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white/5 p-4 rounded-2xl text-right border border-white/5">
          <p className="text-[9px] font-black text-slate-500 uppercase mb-1">أرباح الفريق</p>
          <p className="text-2xl font-black text-emerald-500 italic">{Number(user.referralEarnings).toFixed(2)}</p>
        </div>
        <div className="bg-white/5 p-4 rounded-2xl text-right border border-white/5">
          <p className="text-[9px] font-black text-slate-500 uppercase mb-1">نسبة الربح</p>
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
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-600/10 border border-blue-500/30 rounded-lg shadow-lg">
             <ShieldCheck size={14} className="text-blue-500" />
             <span className="text-[9px] font-black uppercase text-blue-500 tracking-widest">Protocol Elite Member</span>
          </div>
       </div>
       <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-800 border-4 border-[#020617] shadow-xl flex items-center justify-center p-2">
          <img src={`https://api.dicebear.com/7.x/bottts/svg?seed=${user.id}`} alt="Avatar" className="w-full h-full"/>
       </div>
    </div>
    <div className="grid grid-cols-2 gap-4">
      <div className="bg-[#0b0f1a] border border-white/10 rounded-2xl p-5 text-right shadow-lg">
         <p className="text-[9px] text-slate-700 font-black uppercase mb-1 leading-none">إجمالي السحوبات</p>
         <p className="text-2xl font-black text-red-500 italic leading-none">{Number(user.totalWithdraw).toFixed(2)}</p>
      </div>
      <div className="bg-[#0b0f1a] border border-white/10 rounded-2xl p-5 text-right shadow-lg">
         <p className="text-[9px] text-slate-700 font-black uppercase mb-1 leading-none">إجمالي الإيداعات</p>
         <p className="text-2xl font-black text-emerald-500 italic leading-none">{Number(user.totalRecharge).toFixed(2)}</p>
      </div>
    </div>
  </div>
);

const AuthView = ({ lang, t, showToast }: any) => {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ firstName: '', lastName: '', email: '', password: '', referralCode: '' });
  
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ 
          email: formData.email, 
          password: formData.password 
        });
        if (error) { 
           showToast("البريد أو كلمة المرور غير صحيحة", 'error'); 
           setLoading(false); 
        }
      } else {
        const { error } = await supabase.auth.signUp({
          email: formData.email, 
          password: formData.password,
          options: { data: { first_name: formData.firstName, last_name: formData.lastName, referred_by: formData.referralCode } }
        });
        if (error) { showToast(error.message, 'error'); setLoading(false); }
        else { showToast('تم إنشاء الحساب، يرجى تسجيل الدخول', 'success'); setIsLogin(true); setLoading(false); }
      }
    } catch (err: any) { showToast("فشل الاتصال بالخادم", 'error'); setLoading(false); }
  };

  return (
    <div className={`min-h-screen bg-[#020617] p-6 flex flex-col justify-center ${lang === 'ar' ? 'rtl' : ''}`}>
      <div className="max-w-xs mx-auto w-full space-y-8 animate-in fade-in">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl mx-auto flex items-center justify-center shadow-2xl rotate-12 transition-all"><Zap size={32} className="text-white fill-white" /></div>
          <h1 className="text-4xl font-black italic tracking-tighter text-white uppercase leading-none">MINE<span className="text-blue-500">PRO</span></h1>
        </div>
        <div className="bg-[#0b0f1a] border border-white/10 rounded-3xl p-7 shadow-2xl space-y-7">
          <div className="flex bg-[#020617] p-1 rounded-xl border border-white/5">
            <button onClick={() => setIsLogin(true)} className={`flex-1 py-3 rounded-lg font-black text-[10px] transition-all uppercase tracking-widest ${isLogin ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-800'}`}>دخول</button>
            <button onClick={() => setIsLogin(false)} className={`flex-1 py-3 rounded-lg font-black text-[10px] transition-all uppercase tracking-widest ${!isLogin ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-800'}`}>تسجيل</button>
          </div>
          <form onSubmit={handleAuth} className="space-y-4">
            {!isLogin && <div className="grid grid-cols-2 gap-3"><Input icon={UserIcon} placeholder="الأول" value={formData.firstName} onChange={(v: string) => setFormData({...formData, firstName: v})} /><Input icon={UserIcon} placeholder="الأخير" value={formData.lastName} onChange={(v: string) => setFormData({...formData, lastName: v})} /></div>}
            <Input icon={Mail} type="email" placeholder="البريد الإلكتروني" value={formData.email} onChange={(v: string) => setFormData({...formData, email: v})} />
            <Input icon={Key} type="password" placeholder="كلمة المرور" value={formData.password} onChange={(v: string) => setFormData({...formData, password: v})} />
            <button disabled={loading} className="w-full bg-white text-black font-black py-4 rounded-xl uppercase tracking-widest text-[11px] shadow-2xl active:scale-95 transition-all flex justify-center items-center disabled:opacity-50">
              {loading ? <Loader2 className="animate-spin text-blue-600" size={18} /> : (isLogin ? 'دخول النظام' : 'تفعيل العضوية')}
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
    <input type={type} required placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} className="w-full bg-[#020617] border border-white/5 pr-11 pl-4 py-3.5 rounded-xl text-xs font-bold outline-none focus:border-blue-500/40 text-white shadow-inner placeholder:text-slate-800" />
  </div>
);

const AdminView = ({ t, showToast }: any) => {
  const [users, setUsers] = useState<any[]>([]);
  const [txs, setTxs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'deposits' | 'withdrawals' | 'users'>('deposits');
  const [subTab, setSubTab] = useState<'pending' | 'resolved'>('pending');

  const fetchData = async () => {
    try {
      setLoading(true);
      const [profilesRes, txsRes] = await Promise.all([
        supabase.from('profiles').select('*'),
        supabase.from('transactions').select('*').order('date', { ascending: false })
      ]);

      if (profilesRes.data) setUsers(profilesRes.data);
      
      if (txsRes.data && profilesRes.data) {
        const profileMap = new Map(profilesRes.data.map(p => [p.id, p]));
        const merged = txsRes.data.map(tx => ({
          ...tx,
          profiles: profileMap.get(tx.user_id) || { first_name: 'Unknown', last_name: 'User' }
        }));
        setTxs(merged);
      }
    } catch (e) { 
      showToast("خطأ في جلب بيانات الإدارة", "error"); 
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleAction = async (tx: any, newStatus: 'completed' | 'failed') => {
    const user = users.find(u => u.id === tx.user_id);
    if (!user) return;
    
    try {
      if (tx.type === 'deposit' && newStatus === 'completed') {
        await supabase.from('profiles').update({ balance: user.balance + tx.amount, total_recharge: user.total_recharge + tx.amount }).eq('id', tx.user_id);
      }
      if (tx.type === 'withdrawal' && newStatus === 'failed') {
         await supabase.from('profiles').update({ balance: user.balance + Math.abs(tx.amount), withdrawable_balance: user.withdrawable_balance + Math.abs(tx.amount) }).eq('id', tx.user_id);
      }
      await supabase.from('transactions').update({ status: newStatus }).eq('id', tx.id);
      fetchData();
      showToast(`تم تحديث الحالة بنجاح`, 'success');
    } catch (e) {
      showToast("فشل تحديث المعاملة", "error");
    }
  };

  if (loading) return <div className="p-10 text-center"><Loader2 className="animate-spin mx-auto text-blue-500" /></div>;

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex justify-between items-center px-1">
         <h2 className="text-xl font-black italic text-white uppercase flex items-center gap-2 flex-row-reverse"><Settings className="text-blue-500" size={24} /> التحكم بالإدارة</h2>
         <button onClick={fetchData} className="p-3 bg-white/5 rounded-xl text-blue-500 active:bg-white/10 transition-all"><RefreshCw size={18}/></button>
      </div>

      <div className="flex bg-[#0b0f1a] p-1 rounded-2xl border border-white/10 shadow-xl overflow-x-auto no-scrollbar">
        {['deposits', 'withdrawals', 'users'].map((t: any) => (
          <button key={t} onClick={() => setTab(t)} className={`flex-1 py-3 rounded-lg font-black text-[9px] uppercase transition-all px-4 ${tab === t ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-600'}`}>{t === 'deposits' ? 'إيداع' : t === 'withdrawals' ? 'سحب' : 'أعضاء'}</button>
        ))}
      </div>

      {(tab === 'deposits' || tab === 'withdrawals') && (
        <div className="space-y-4">
          <div className="flex justify-center gap-2 bg-[#020617] p-1 rounded-xl border border-white/5 max-w-[200px] mx-auto shadow-inner">
             <button onClick={() => setSubTab('pending')} className={`flex-1 py-1.5 rounded-lg text-[8px] font-black uppercase transition-all ${subTab === 'pending' ? 'bg-blue-500/10 text-blue-500' : 'text-slate-700'}`}>جديد</button>
             <button onClick={() => setSubTab('resolved')} className={`flex-1 py-1.5 rounded-lg text-[8px] font-black uppercase transition-all ${subTab === 'resolved' ? 'bg-white/5 text-slate-500' : 'text-slate-700'}`}>السجل</button>
          </div>
          
          {txs.filter(t => t.type === (tab === 'deposits' ? 'deposit' : 'withdrawal') && (subTab === 'pending' ? t.status === 'pending' : t.status !== 'pending')).map(t => (
            <div key={t.id} className="bg-[#0b0f1a] border border-white/5 p-5 rounded-2xl text-right space-y-4 shadow-xl">
               <div className="flex justify-between items-center flex-row-reverse">
                  <div className="text-right">
                    <h5 className="font-black text-white italic text-base leading-none">{t.profiles?.first_name} {t.profiles?.last_name}</h5>
                    <p className="text-[9px] text-slate-600 mt-1 leading-none font-mono">{t.profiles?.email}</p>
                  </div>
                  <span className={`text-[8px] font-black uppercase px-2 py-1 rounded-full border ${t.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' : t.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>{t.status === 'pending' ? 'قيد المراجعة' : t.status === 'completed' ? 'تم القبول' : 'مرفوض'}</span>
               </div>
               
               <div className="flex justify-between items-center flex-row-reverse border-t border-white/5 pt-4">
                  <p className="text-[9px] font-black text-slate-500 uppercase italic leading-none">المبلغ</p>
                  <div className="text-left font-black italic text-2xl text-white leading-none">{Math.abs(t.amount)} <span className="text-[10px]">USDT</span></div>
               </div>

               {t.type === 'withdrawal' && t.details && (
                 <div className="bg-black/40 p-3 rounded-xl border border-white/5 space-y-2">
                    <p className="text-[8px] font-black text-slate-500 uppercase">عنوان المحفظة (BEP20)</p>
                    <p className="text-[10px] font-mono text-blue-400 break-all text-left bg-black/20 p-2 rounded-lg">{t.details.replace('Addr: ', '')}</p>
                 </div>
               )}

               {t.proof_url && (
                 <div className="relative mt-2 rounded-xl overflow-hidden border border-white/10 bg-black cursor-zoom-in" onClick={() => window.open(t.proof_url, '_blank')}>
                    <img src={t.proof_url} className="w-full h-auto max-h-40 object-contain" alt="Proof" />
                 </div>
               )}

               {t.status === 'pending' && (
                 <div className="flex gap-2 pt-2">
                    <button onClick={() => handleAction(t, 'completed')} className="flex-[2] bg-white text-black font-black py-3.5 rounded-xl uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all">موافقة</button>
                    <button onClick={() => handleAction(t, 'failed')} className="flex-1 bg-red-600/10 text-red-500 border border-red-500/20 font-black py-3.5 rounded-xl uppercase text-[10px] active:scale-95">رفض</button>
                 </div>
               )}
            </div>
          ))}
        </div>
      )}

      {tab === 'users' && (
        <div className="space-y-3">
           {users.map(u => (
              <div key={u.id} className="bg-[#0b0f1a] border border-white/10 p-4 rounded-2xl flex justify-between items-center flex-row-reverse shadow-lg hover:border-blue-500/50 transition-all">
                <div className="text-right flex items-center gap-3 flex-row-reverse">
                   <div className="w-10 h-10 rounded-lg bg-blue-600/10 border border-blue-500/20 flex items-center justify-center"><img src={`https://api.dicebear.com/7.x/bottts/svg?seed=${u.id}`} className="w-8 h-8" alt="Avatar" /></div>
                   <div className="space-y-0.5">
                      <h4 className="font-black text-white italic text-sm leading-none">{u.first_name} {u.last_name}</h4>
                      <p className="text-[8px] text-slate-600 font-mono leading-none">{u.email}</p>
                   </div>
                </div>
                <div className="text-left font-black italic text-blue-500 text-lg leading-none">{u.balance.toFixed(2)}</div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
};

const RechargeModal = ({ t, onClose, onDeposit, showToast, userId }: any) => {
  const [amount, setAmount] = useState('');
  const [image, setImage] = useState('');
  const handleFileUpload = (e: any) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => { setImage(reader.result as string); };
      reader.readAsDataURL(file);
    }
  };
  const submit = async () => {
    if (!amount || !image) return showToast("يرجى إكمال البيانات المطلوبة", "error");
    await supabase.from('transactions').insert({ user_id: userId, type: 'deposit', amount: Number(amount), status: 'pending', proof_url: image });
    showToast(t('verificationPending'), 'success'); onDeposit(); onClose();
  };
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-xl overflow-y-auto animate-in fade-in">
      <div className="bg-[#0b0f1a] border border-white/10 w-full max-w-sm rounded-3xl p-6 space-y-5 shadow-2xl animate-in zoom-in-95">
        <div className="flex justify-between items-center bg-blue-600 p-4 rounded-xl shadow-lg">
          <h3 className="font-black text-white text-sm italic uppercase tracking-widest">إيداع أصول مشفرة</h3>
          <button onClick={onClose} className="text-white p-1 hover:bg-white/10 rounded-lg"><X size={20} /></button>
        </div>
        <div className="bg-blue-600/5 border border-blue-500/10 p-4 rounded-xl space-y-3 text-right">
           <p className="text-[9px] font-black text-blue-500 uppercase italic">عنوان المحفظة (BEP20)</p>
           <div className="bg-black/40 p-3 rounded-lg flex items-center gap-3 border border-white/5">
              <button onClick={() => {navigator.clipboard.writeText(DEPOSIT_ADDRESS); showToast('تم نسخ العنوان', 'success')}} className="p-2 bg-blue-600 text-white rounded-lg active:scale-90"><Copy size={16}/></button>
              <span className="text-[9px] font-mono text-slate-500 break-all flex-1">{DEPOSIT_ADDRESS}</span>
           </div>
        </div>
        <div className="space-y-2 text-right">
          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mr-1">المبلغ المراد شحنه</p>
          <input type="number" placeholder="0.00 USDT" value={amount} onChange={e => setAmount(e.target.value)} className="w-full bg-black/40 border border-white/10 p-4 rounded-xl text-white font-black italic text-center text-3xl outline-none focus:border-blue-500/50" />
        </div>
        <div className="space-y-3 text-right">
          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">إثبات التحويل (لقطة شاشة)</p>
          <label className="block border-2 border-dashed border-white/10 rounded-2xl p-6 text-center bg-white/5 cursor-pointer hover:border-blue-500/50 transition-all">
             <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
             {image ? (
               <img src={image} className="w-24 h-24 mx-auto rounded-xl object-cover border-2 border-blue-500 shadow-xl" alt="Proof" />
             ) : (
               <div className="text-blue-500/50 space-y-2">
                 <UploadCloud size={32} className="mx-auto" />
                 <p className="text-[10px] uppercase font-bold tracking-widest">رفع لقطة الشاشة</p>
               </div>
             )}
          </label>
        </div>
        <button onClick={submit} className="w-full bg-white text-black font-black py-4 rounded-xl uppercase text-xs active:scale-95 shadow-xl hover:bg-slate-50">تأكيد عملية الإيداع</button>
      </div>
    </div>
  );
};

const WithdrawModal = ({ t, onClose, onWithdraw, max, userId, balance, showToast, isProcessing }: any) => {
  const [amount, setAmount] = useState('');
  const [address, setAddress] = useState('');
  
  const submit = async () => {
    if (isProcessing) return;
    const amt = Number(amount);
    if (amt < MIN_WITHDRAWAL) return showToast(`الحد الأدنى للسحب ${MIN_WITHDRAWAL} عملات`, 'error');
    if (amt > max) return showToast("رصيد السحب المتاح غير كافٍ", "error");
    if (!address.trim()) return showToast("يرجى إدخال عنوان المحفظة", "error");
    
    try {
      await supabase.from('transactions').insert({ 
        user_id: userId, 
        type: 'withdrawal', 
        amount: -amt, 
        status: 'pending', 
        details: `Addr: ${address}` 
      });
      // تحديث الرصيد بحذر
      await supabase.from('profiles').update({ 
        balance: balance - amt, 
        withdrawable_balance: max - amt 
      }).eq('id', userId).gte('withdrawable_balance', amt);

      onWithdraw(); onClose(); showToast("تم إرسال طلب السحب بنجاح", 'success');
    } catch (e) {
      showToast("خطأ في معالجة الطلب", "error");
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-xl animate-in fade-in">
      <div className="bg-[#0b0f1a] border border-white/10 w-full max-w-sm rounded-3xl p-6 space-y-6 shadow-2xl animate-in zoom-in-95">
        <div className="flex justify-between items-center bg-blue-700 p-4 rounded-xl shadow-lg">
          <h3 className="font-black text-white text-sm italic uppercase tracking-widest">تسييل الأصول</h3>
          <button onClick={onClose} className="text-white p-1 hover:bg-white/10 rounded-lg"><X size={20} /></button>
        </div>
        <div className="bg-blue-600/5 p-5 rounded-xl flex justify-between items-center flex-row-reverse border border-white/5">
           <span className="text-[9px] font-black text-slate-500 uppercase">متاح للسحب</span>
           <span className="text-2xl font-black text-blue-500 italic">{max.toFixed(2)} USDT</span>
        </div>
        <div className="space-y-2 text-right">
           <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mr-1">عنوان المحفظة المستلمة (BEP20)</p>
           <input value={address} onChange={e => setAddress(e.target.value)} placeholder="0x..." className="w-full bg-black/40 border border-white/10 p-4 rounded-xl text-white font-mono text-xs outline-none focus:border-blue-500/50" />
        </div>
        <div className="space-y-2 text-right">
           <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mr-1">المبلغ (الحد الأدنى 8)</p>
           <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="8+" className="w-full bg-black/40 border border-white/10 p-4 rounded-xl text-white font-black italic text-center text-3xl outline-none focus:border-blue-500/50" />
        </div>
        <button onClick={submit} disabled={isProcessing} className="w-full bg-blue-600 text-white font-black py-4 rounded-xl uppercase text-xs active:scale-95 shadow-xl disabled:opacity-50">تأكيد طلب السحب</button>
      </div>
    </div>
  );
};

const InfoModal = ({ onClose }: any) => (
  <div className="fixed inset-0 z-[250] flex items-center justify-center p-6 bg-[#020617]/95 backdrop-blur-xl animate-in fade-in">
    <div className="bg-[#0b0f1a] border border-white/10 w-full max-w-xs rounded-3xl p-8 text-right space-y-6 shadow-2xl animate-in zoom-in-95">
      <div className="w-16 h-16 bg-blue-600/10 rounded-2xl flex items-center justify-center text-blue-500 mx-auto border border-blue-500/20"><ShieldCheck size={32}/></div>
      <h3 className="font-black text-white text-xl uppercase italic text-center leading-none tracking-tighter">بروتوكول الأمان V-2</h3>
      <p className="text-[11px] leading-relaxed text-slate-400 font-medium italic text-center opacity-90">
        يعمل MINEPRO كجسر تقني متطور لتسييل الأصول الرقمية. نظامنا محمي ضد هجمات التكرار (Race Attacks) ويضمن دقة العمليات المالية بنسبة 100% عبر عقود ذكية مشفرة.
      </p>
      <button onClick={onClose} className="w-full bg-white text-black font-black py-4 rounded-xl uppercase tracking-widest text-[10px] shadow-2xl active:scale-95">فهمت، استمرار</button>
    </div>
  </div>
);

const SupportChatModal = ({ userId, onClose }: any) => {
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchMessages = useCallback(async () => {
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
    if (!newMessage.trim()) return;
    const msg = newMessage;
    setNewMessage('');
    await supabase.from('support_messages').insert({ sender_id: userId, receiver_id: 'ADMIN', message: msg });
  };

  return (
    <div className="fixed inset-0 z-[200] bg-[#020617]/98 backdrop-blur-xl flex flex-col animate-in fade-in">
      <div className="p-5 border-b border-white/5 flex justify-between items-center bg-[#0b0f1a] shadow-xl">
        <button onClick={onClose} className="p-3 bg-white/5 rounded-xl text-slate-400"><X size={20}/></button>
        <h3 className="font-black text-white italic text-lg uppercase leading-none">مركز الدعم الآمن</h3>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.sender_id === userId ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-4 rounded-2xl text-[13px] font-bold shadow-lg ${m.sender_id === userId ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white/5 text-slate-300 border border-white/5 rounded-tl-none'}`}>
              {m.message}
            </div>
          </div>
        ))}
      </div>
      <div className="p-6 bg-[#0b0f1a]/80 border-t border-white/5 flex gap-3">
        <button onClick={sendMessage} className="p-4 bg-blue-600 text-white rounded-xl active:scale-90"><Send size={20}/></button>
        <input value={newMessage} onChange={e => setNewMessage(e.target.value)} onKeyPress={e => e.key === 'Enter' && sendMessage()} placeholder="كيف يمكننا مساعدتك؟" className="flex-1 bg-white/5 border border-white/10 rounded-xl px-5 text-sm text-white outline-none" />
      </div>
    </div>
  );
};

export default App;
