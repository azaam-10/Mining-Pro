
import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { 
  Home as HomeIcon, Cpu, ListTodo, Users, User as UserIcon, 
  ArrowDownCircle, ArrowUpCircle, CheckCircle2, Clock, XCircle, 
  Loader2, ShieldCheck, HelpCircle, X, Copy, UploadCloud, 
  ArrowDown, Zap, Globe, Layers, Settings, Eye, Search, 
  RefreshCw, Calendar, ChevronLeft, MessageCircle, Send, Sparkles,
  LogOut, Mail, Key, ShieldAlert, Award, TrendingUp, Gem, ChevronRight, AlertTriangle
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
  const [session, setSession] = useState<any>(null);
  const [userData, setUserData] = useState<UserState | null>(null);

  const fetchAllUserData = async (userId: string) => {
    try {
      const { data: profile, error: profileErr } = await supabase.from('profiles').select('*').eq('id', userId).single();
      
      if (profileErr && profileErr.code === 'PGRST116') {
        const { data: newProfile } = await supabase.from('profiles').insert([
          { id: userId, balance: 0, withdrawable_balance: 0, referral_code: Math.random().toString(36).substring(2, 8).toUpperCase() }
        ]).select().single();
        if (newProfile) setUserData(formatUserData(newProfile, [], []));
      } else if (profile) {
        const { data: machines } = await supabase.from('user_machines').select('*').eq('id', userId); // corrected potential mismatch
        const { data: actualMachines } = await supabase.from('user_machines').select('*').eq('user_id', userId);
        const { data: txs } = await supabase.from('transactions').select('*').eq('user_id', userId).order('date', { ascending: false });
        setUserData(formatUserData(profile, actualMachines || [], txs || []));
      }
    } catch (err) {
      console.error("Data Fetch Error:", err);
    } finally {
      setLoading(false);
    }
  };

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
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        setSession(currentSession);
        if (currentSession) {
          await fetchAllUserData(currentSession.user.id);
        } else {
          setLoading(false);
        }
      } catch (e) {
        setLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchAllUserData(session.user.id);
      } else {
        setUserData(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { message, type, id }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  const t = (key: string) => TRANSLATIONS[key]?.[lang] || key;

  const buyMachine = async (machine: Machine) => {
    if (!userData || !session) return;
    if (userData.balance < machine.price) return showToast("رصيدك غير كافٍ لهذا العقد", 'error');
    
    setLoading(true);
    const { error: machineErr } = await supabase.from('user_machines').insert({
      user_id: session.user.id,
      machine_id: machine.id,
      remaining_days: machine.duration,
      total_earned: 0
    });

    if (machineErr) {
      setLoading(false);
      return showToast(machineErr.message, 'error');
    }

    await supabase.from('profiles').update({ balance: userData.balance - machine.price }).eq('id', session.user.id);
    showToast(t('transactionCompleted'), 'success');
    await fetchAllUserData(session.user.id);
  };

  const completeTask = async (um: UserMachine) => {
    const today = formatDate(new Date());
    if (um.last_claim_date === today || !userData || !session) return;
    const machine = MACHINES.find(m => m.id === um.machine_id);
    if (!machine) return;

    setLoading(true);
    await supabase.from('user_machines').update({
      last_claim_date: today,
      total_earned: um.total_earned + machine.dailyProfit,
      remaining_days: um.remaining_days - 1
    }).eq('id', um.id);

    await supabase.from('profiles').update({ 
      balance: userData.balance + machine.dailyProfit, 
      withdrawable_balance: userData.withdrawableBalance + machine.dailyProfit 
    }).eq('id', session.user.id);

    await supabase.from('transactions').insert({ user_id: session.user.id, type: 'task', amount: machine.dailyProfit, status: 'completed' });
    showToast(t('transactionCompleted'), 'success');
    await fetchAllUserData(session.user.id);
  };

  if (loading) return (
    <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center gap-4">
      <Loader2 className="animate-spin text-blue-500" size={40} />
      <p className="text-slate-500 font-bold text-xs animate-pulse tracking-widest uppercase">Initializing Protocol...</p>
    </div>
  );

  if (!session) return <AuthView lang={lang} setLang={setLang} t={t} showToast={showToast} />;
  if (!userData) return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center p-10 text-center">
      <div className="space-y-4">
        <p className="text-red-500 font-bold">حدث خطأ في جلب بيانات البروتوكول</p>
        <button onClick={() => window.location.reload()} className="bg-white text-black px-6 py-2 rounded-lg font-bold">إعادة المحاولة</button>
      </div>
    </div>
  );

  return (
    <div className={`min-h-screen pb-24 ${lang === 'ar' ? 'rtl font-["Cairo"]' : 'font-sans'} bg-[#020617] text-[#f8fafc] overflow-x-hidden relative`}>
      {showInfo && <InfoModal onClose={() => setShowInfo(false)} />}
      {showRecharge && <RechargeModal t={t} onClose={() => setShowRecharge(false)} onDeposit={() => fetchAllUserData(session.user.id)} showToast={showToast} userId={session.user.id} />}
      {showWithdraw && <WithdrawModal t={t} onClose={() => setShowWithdraw(false)} onWithdraw={() => fetchAllUserData(session.user.id)} max={userData.withdrawableBalance} userId={session.user.id} balance={userData.balance} showToast={showToast} />}
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
        <div className="flex gap-1.5">
          <button onClick={() => setShowSupport(true)} className="p-2 bg-blue-500/10 text-blue-500 rounded-xl relative">
             <MessageCircle size={18} />
             <div className="absolute top-0 right-0 w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
          </button>
          <button onClick={() => supabase.auth.signOut()} className="p-2 bg-red-500/10 text-red-500 rounded-xl"><LogOut size={18} /></button>
        </div>
      </header>

      <main className="max-w-md mx-auto p-4 space-y-6 relative z-10">
        <Routes>
          <Route path="/" element={<HomeView user={userData} t={t} onShowInfo={() => setShowInfo(true)} onShowRecharge={() => setShowRecharge(true)} onShowWithdraw={() => setShowWithdraw(true)} />} />
          <Route path="/machines" element={<MachinesView user={userData} onBuy={buyMachine} t={t} />} />
          <Route path="/tasks" element={<TasksView user={userData} onComplete={completeTask} t={t} />} />
          <Route path="/team" element={<TeamView user={userData} t={t} />} />
          <Route path="/profile" element={<ProfileView user={userData} t={t} />} />
          {userData.email === ADMIN_EMAIL && <Route path="/admin" element={<AdminView t={t} showToast={showToast} />} />}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-[#020617]/95 backdrop-blur-xl border-t border-white/5 p-4 z-40 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
        <div className="max-w-md mx-auto flex justify-around">
          <NavItem icon={HomeIcon} label={t('home')} active={location.pathname === '/'} onClick={() => navigate('/')} />
          <NavItem icon={Cpu} label={t('machines')} active={location.pathname === '/machines'} onClick={() => navigate('/machines')} />
          <NavItem icon={ListTodo} label={t('tasks')} active={location.pathname === '/tasks'} onClick={() => navigate('/tasks')} />
          {userData.email === ADMIN_EMAIL ? (
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

const HomeView = ({ user, t, onShowInfo, onShowRecharge, onShowWithdraw }: any) => {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-end flex-row-reverse px-1">
        <div className="space-y-0.5">
          <h2 className="text-xl font-black italic text-white leading-none">أهلاً، {user.first_name}</h2>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Protocol ID: {user.referral_code}</p>
        </div>
        <div className="bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full flex items-center gap-2">
           <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
           <span className="text-[9px] font-black uppercase text-emerald-500">Sync Active</span>
        </div>
      </div>

      <div className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-3xl blur opacity-20"></div>
        <div className="relative bg-[#0b0f1a] border border-white/10 rounded-3xl p-6 shadow-2xl flex flex-col justify-between overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/5 blur-[50px]"></div>
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

      <div className="bg-gradient-to-br from-slate-900 to-black border border-white/5 p-5 rounded-2xl space-y-3 text-right shadow-xl relative overflow-hidden group">
         <div className="absolute top-0 left-0 w-24 h-24 bg-emerald-500/5 blur-xl"></div>
         <div className="flex items-center gap-2 flex-row-reverse">
            <ShieldCheck className="text-emerald-500" size={20} />
            <h3 className="text-sm font-black text-white uppercase italic">لماذا أرباحنا هي الأعلى؟</h3>
         </div>
         <p className="text-[11px] text-slate-400 font-medium leading-relaxed italic">
            نحن نقوم بارسال المال الغير مشروع ليصل لنا من عدد حسابات كثير ويصبح اموال مشروعه، حيث تعمل شبكتنا الموزعة كجسر مالي متطور يقوم بتسييل الأصول الرقمية عبر آلاف الحسابات النشطة لضمان أمان العمليات وعوائدكم الضخمة.
         </p>
         <div className="flex gap-2 pt-1 flex-row-reverse">
            <div className="bg-white/5 px-3 py-1.5 rounded-lg flex items-center gap-1.5"><Award className="text-blue-500" size={12}/><span className="text-[8px] font-bold text-slate-300 uppercase">نظام مرخص</span></div>
            <div className="bg-white/5 px-3 py-1.5 rounded-lg flex items-center gap-1.5"><TrendingUp className="text-emerald-500" size={12}/><span className="text-[8px] font-bold text-slate-300 uppercase">تسييل آمن</span></div>
         </div>
      </div>

      <div className="space-y-4 text-right">
         <div className="flex justify-between items-center flex-row-reverse px-1">
            <h3 className="text-[10px] font-black uppercase text-slate-600 tracking-widest">{t('history')}</h3>
            <div className="w-8 h-0.5 bg-white/5 rounded-full"></div>
         </div>
         <div className="space-y-2.5">
           {user.transactions.slice(0, 5).map((tx: Transaction) => (
             <div key={tx.id} className="bg-[#0b0f1a] border border-white/5 p-4 rounded-xl flex justify-between items-center flex-row-reverse shadow-lg hover:border-white/10 transition-all">
                <div className="flex gap-3 flex-row-reverse items-center">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center border shadow-inner ${tx.type === 'deposit' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : tx.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' : 'bg-blue-500/10 text-blue-500 border-blue-500/20'}`}>
                    {tx.status === 'pending' ? <Clock size={18}/> : tx.type === 'task' ? <TrendingUp size={18}/> : <ArrowDownCircle size={18}/>}
                  </div>
                  <div className="text-right">
                     <p className="text-[12px] font-black text-white uppercase italic leading-none">{tx.type === 'task' ? 'عائد تسييل' : tx.type === 'deposit' ? 'إيداع أصول' : 'طلب سحب'}</p>
                     <p className="text-[8px] text-slate-700 font-bold mt-1">{new Date(tx.date).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className={`text-left font-black italic text-sm ${tx.amount > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                   {tx.amount > 0 ? '+' : ''}{tx.amount.toFixed(2)}
                </div>
             </div>
           ))}
           {user.transactions.length === 0 && <p className="text-center py-4 text-[10px] text-slate-800 font-black italic uppercase">لا يوجد سجل حالياً</p>}
         </div>
      </div>
    </div>
  );
};

const MachinesView = ({ user, onBuy, t }: any) => (
  <div className="space-y-6 animate-in fade-in duration-500">
    <div className="flex justify-between items-center flex-row-reverse px-1">
      <h2 className="text-xl font-black italic uppercase text-white flex items-center gap-3 flex-row-reverse"><Layers className="text-blue-500" size={24}/> {t('machines')}</h2>
      <span className="text-[9px] font-black text-slate-700 uppercase tracking-widest italic">V-Protocol List</span>
    </div>
    <div className="grid grid-cols-1 gap-4">
      {MACHINES.map((m: any, index: number) => {
        const owned = user.ownedMachines.some((om: any) => om.machine_id === m.id);
        return (
          <div key={m.id} className={`relative bg-gradient-to-br from-slate-900 to-black border ${owned ? 'border-blue-500/40 shadow-blue-500/5' : 'border-white/5'} rounded-2xl p-4 shadow-xl overflow-hidden group hover:scale-[1.01] transition-all`}>
            <div className={`absolute top-0 left-0 w-32 h-32 bg-gradient-to-br ${m.color} opacity-10 blur-3xl`}></div>
            <div className="flex justify-between items-center flex-row-reverse mb-4 relative z-10">
                 <div className="flex gap-3 flex-row-reverse items-center">
                    <div className={`w-12 h-12 bg-gradient-to-br ${m.color} rounded-xl flex items-center justify-center border border-white/10 shadow-lg`}><Gem size={24} className="text-white" /></div>
                    <div className="text-right">
                       <h3 className="font-black text-[13px] text-white uppercase italic leading-none">{m.name}</h3>
                       <p className="text-[8px] text-white/30 font-bold uppercase mt-1 tracking-widest">Protocol Sync Node</p>
                    </div>
                 </div>
                 <div className="text-left">
                    <p className="text-2xl font-black text-white leading-none">{m.price}</p>
                    <p className="text-[8px] text-white/30 font-bold uppercase mt-1 italic leading-none">Stake USDT</p>
                 </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4 relative z-10">
              <div className="bg-white/5 p-3 rounded-xl text-right border border-white/5 shadow-inner">
                <p className="text-[8px] font-black uppercase text-slate-600 mb-1 leading-none">الربح اليومي</p>
                <p className="text-lg font-black text-emerald-500 italic leading-none">+{m.dailyProfit}</p>
              </div>
              <div className="bg-white/5 p-3 rounded-xl text-right border border-white/5 shadow-inner">
                <p className="text-[8px] font-black uppercase text-slate-600 mb-1 leading-none">مدة العقد</p>
                <p className="text-lg font-black text-white italic leading-none">{m.duration} <span className="text-[10px]">يوم</span></p>
              </div>
            </div>
            <button onClick={() => onBuy(m)} disabled={owned} className={`w-full py-3.5 rounded-xl font-black text-[11px] uppercase tracking-[0.2em] transition-all shadow-xl ${owned ? 'bg-slate-900 text-slate-700 border border-white/5' : 'bg-white text-black active:scale-95'}`}>
              {owned ? 'العقد مفعل ونشط' : 'تفعيل العقد الآن'}
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
    <div className="space-y-6 animate-in fade-in duration-500">
      <h2 className="text-xl font-black italic uppercase text-white flex items-center gap-3 flex-row-reverse px-1"><ListTodo className="text-blue-500" size={24}/> {t('tasks')}</h2>
      <div className="space-y-4">
          {user.ownedMachines.map((um: UserMachine) => {
            const m = MACHINES.find(x => x.id === um.machine_id);
            const isDone = um.last_claim_date === today;
            return (
              <div key={um.id} className={`bg-[#0b0f1a] border-2 ${isDone ? 'border-white/5 opacity-40' : 'border-emerald-500/20 shadow-emerald-500/5'} rounded-2xl p-4 shadow-xl text-right transition-all`}>
                <div className="flex justify-between items-center flex-row-reverse mb-4">
                  <div className="flex gap-3 flex-row-reverse items-center">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center border shadow-lg ${isDone ? 'bg-white/5' : 'bg-emerald-600/10 text-emerald-500 border-emerald-500/20'}`}><TrendingUp size={24}/></div>
                    <div className="text-right"><h4 className="font-black text-sm text-white uppercase italic leading-none">{m?.name}</h4><p className="text-[8px] text-slate-700 font-bold mt-1 uppercase">Node Active</p></div>
                  </div>
                  <div className={`text-left font-black italic text-lg ${isDone ? 'text-slate-800' : 'text-emerald-500'}`}>
                    +{m?.dailyProfit}
                  </div>
                </div>
                <button disabled={isDone} onClick={() => onComplete(um)} className={`w-full py-3.5 rounded-xl font-black uppercase text-[11px] tracking-widest transition-all shadow-xl ${isDone ? 'bg-slate-900 text-slate-700' : 'bg-emerald-600 text-white active:scale-95'}`}>
                  {isDone ? 'تم التسييل اليوم' : 'استلام أرباح التسييل'}
                </button>
              </div>
            );
          })}
          {user.ownedMachines.length === 0 && (
            <div className="py-20 text-center opacity-10 font-black italic uppercase tracking-widest text-slate-500">لا يوجد عقود نشطة للتسييل</div>
          )}
      </div>
    </div>
  );
};

const TeamView = ({ user, t }: any) => {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <h2 className="text-xl font-black italic uppercase text-white flex items-center gap-3 flex-row-reverse px-1"><Users className="text-blue-500" size={24}/> {t('team')}</h2>
      
      <div className="bg-gradient-to-br from-slate-900 to-black border border-white/10 rounded-3xl p-6 shadow-xl space-y-6">
        <div className="text-right space-y-2">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic leading-none">كود الإحالة للمستثمرين</p>
          <div className="bg-black/40 p-4 rounded-xl flex items-center gap-3 border border-white/5">
            <button onClick={() => {navigator.clipboard.writeText(user.referral_code); alert('تم نسخ الكود!')}} className="p-3 bg-blue-600 text-white rounded-xl active:scale-90 transition-all shadow-lg"><Copy size={18}/></button>
            <span className="text-sm font-mono text-white flex-1 text-center select-all tracking-widest">{user.referral_code}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white/5 p-4 rounded-2xl text-right border border-white/5 shadow-inner">
            <p className="text-[9px] font-black text-slate-500 uppercase mb-1 leading-none">إجمالي أرباح الفريق</p>
            <p className="text-2xl font-black text-emerald-500 italic leading-none">{Number(user.referralEarnings).toFixed(2)}</p>
          </div>
          <div className="bg-white/5 p-4 rounded-2xl text-right border border-white/5 shadow-inner">
            <p className="text-[9px] font-black text-slate-500 uppercase mb-1 leading-none">نسبة العمولة</p>
            <p className="text-2xl font-black text-blue-500 italic leading-none">10%</p>
          </div>
        </div>
      </div>

      <div className="bg-blue-600/5 border border-blue-500/10 p-5 rounded-2xl space-y-3 text-right shadow-inner">
        <div className="flex items-center gap-2 flex-row-reverse">
          <Sparkles className="text-blue-500" size={18} />
          <h4 className="text-[13px] font-black text-white uppercase italic leading-none">نمو شبكتك الاستثمارية</h4>
        </div>
        <p className="text-[11px] text-slate-400 font-medium leading-relaxed italic opacity-80">
          شارك كود الإحالة الخاص بك وادعُ أصدقائك للانضمام إلى أقوى بروتوكول تسييل أصول في العالم. ستحصل فوراً على 10% من قيمة كل عقد استثماري يقومون بتفعيله.
        </p>
      </div>
    </div>
  );
};

const ProfileView = ({ user, t }: any) => (
  <div className="space-y-8 animate-in fade-in duration-700">
    <div className="relative p-6 bg-[#0b0f1a] border border-white/10 rounded-3xl shadow-xl flex items-center gap-6 flex-row-reverse justify-between overflow-hidden group">
       <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 via-transparent to-transparent"></div>
       <div className="space-y-2 text-right z-10">
          <h3 className="text-2xl font-black italic text-white leading-tight">{user.first_name}<br/>{user.last_name}</h3>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-600/10 border border-blue-500/30 rounded-lg shadow-lg">
             <ShieldCheck size={14} className="text-blue-500" />
             <span className="text-[9px] font-black uppercase text-blue-500 tracking-widest">Protocol Elite</span>
          </div>
       </div>
       <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-800 border-4 border-[#020617] shadow-xl flex items-center justify-center overflow-hidden z-10">
          <img src={`https://api.dicebear.com/7.x/bottts/svg?seed=${user.id}`} alt="Avatar" className="w-full h-full scale-125 translate-y-2"/>
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
    <div className="bg-white/5 p-4 rounded-2xl border border-white/5 flex justify-between items-center flex-row-reverse shadow-inner">
       <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">البريد الإلكتروني</span>
       <span className="text-xs font-bold text-white opacity-60 select-all">{user.email}</span>
    </div>
  </div>
);

const NavItem = ({ icon: Icon, label, active, onClick }: any) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-1 transition-all group ${active ? 'text-blue-500 -translate-y-1' : 'text-slate-700'}`}>
    <div className={`p-2 rounded-lg transition-all ${active ? 'bg-blue-600/10 shadow-lg border border-blue-500/20' : ''}`}><Icon size={18} strokeWidth={active ? 2.5 : 2} /></div>
    <span className={`text-[8px] font-black uppercase tracking-widest transition-all ${active ? 'opacity-100' : 'opacity-30'}`}>{label}</span>
  </button>
);

const AuthView = ({ lang, setLang, t, showToast }: any) => {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ firstName: '', lastName: '', email: '', password: '', referralCode: '' });
  
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({ 
          email: formData.email, 
          password: formData.password 
        });
        
        if (error) {
          let msg = error.message;
          if (msg.includes("Invalid login credentials")) msg = "البريد الإلكتروني أو كلمة المرور غير صحيحة";
          showToast(msg, 'error');
          setLoading(false);
        }
      } else {
        const { error } = await supabase.auth.signUp({
          email: formData.email, 
          password: formData.password,
          options: { data: { first_name: formData.firstName, last_name: formData.lastName, referred_by: formData.referralCode } }
        });
        if (error) {
          showToast(error.message, 'error');
          setLoading(false);
        } else {
          showToast('تم إنشاء الحساب بنجاح، سجل دخولك الآن', 'success');
          setLoading(false);
          setIsLogin(true);
        }
      }
    } catch (err: any) {
      showToast("حدث خطأ تقني غير متوقع", 'error');
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen bg-[#020617] p-6 flex flex-col justify-center ${lang === 'ar' ? 'rtl' : ''}`}>
      <div className="max-w-xs mx-auto w-full space-y-8 animate-in fade-in duration-500">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl mx-auto flex items-center justify-center shadow-2xl rotate-12 active:rotate-0 transition-all duration-500"><Zap size={32} className="text-white fill-white" /></div>
          <h1 className="text-4xl font-black italic tracking-tighter text-white uppercase leading-none">MINE<span className="text-blue-500">PRO</span></h1>
          <p className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-800">V-Protocol Elite Node</p>
        </div>
        <div className="bg-[#0b0f1a] border border-white/10 rounded-3xl p-7 shadow-2xl space-y-7 relative overflow-hidden">
          <div className="flex bg-[#020617] p-1 rounded-xl border border-white/5 relative z-10 shadow-inner">
            <button onClick={() => setIsLogin(true)} className={`flex-1 py-3 rounded-lg font-black text-[10px] transition-all uppercase tracking-widest ${isLogin ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-800'}`}>دخول</button>
            <button onClick={() => setIsLogin(false)} className={`flex-1 py-3 rounded-lg font-black text-[10px] transition-all uppercase tracking-widest ${!isLogin ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-800'}`}>تسجيل</button>
          </div>
          <form onSubmit={handleAuth} className="space-y-4 relative z-10">
            {!isLogin && <div className="grid grid-cols-2 gap-3 animate-in slide-in-from-top duration-300"><Input icon={UserIcon} placeholder="الأول" value={formData.firstName} onChange={(v: string) => setFormData({...formData, firstName: v})} /><Input icon={UserIcon} placeholder="الأخير" value={formData.lastName} onChange={(v: string) => setFormData({...formData, lastName: v})} /></div>}
            <Input icon={Mail} type="email" placeholder="البريد الإلكتروني" value={formData.email} onChange={(v: string) => setFormData({...formData, email: v})} />
            <Input icon={Key} type="password" placeholder="كلمة المرور" value={formData.password} onChange={(v: string) => setFormData({...formData, password: v})} />
            {!isLogin && <Input icon={Sparkles} placeholder="كود الإحالة (اختياري)" value={formData.referralCode} onChange={(v: string) => setFormData({...formData, referralCode: v})} />}
            <button disabled={loading} className="w-full bg-white text-black font-black py-4 rounded-xl uppercase tracking-[0.2em] text-[11px] shadow-2xl hover:bg-slate-100 active:scale-95 transition-all mt-4 flex justify-center items-center">
              {loading ? <Loader2 className="animate-spin text-blue-600" size={18} /> : (isLogin ? 'Access Console' : 'Initialize Node')}
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
    <input type={type} required placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} className="w-full bg-[#020617] border border-white/5 pr-11 pl-4 py-3.5 rounded-xl text-xs font-bold outline-none focus:border-blue-500/40 text-white shadow-inner placeholder:text-slate-800 transition-all" />
  </div>
);

const InfoModal = ({ onClose }: any) => (
  <div className="fixed inset-0 z-[250] flex items-center justify-center p-6 bg-[#020617]/95 backdrop-blur-xl animate-in fade-in duration-300">
    <div className="bg-[#0b0f1a] border border-white/10 w-full max-w-xs rounded-3xl p-8 text-right space-y-6 shadow-2xl animate-in zoom-in-95 duration-300">
      <div className="w-16 h-16 bg-blue-600/10 rounded-2xl flex items-center justify-center text-blue-500 mx-auto border border-blue-500/20 shadow-inner"><ShieldCheck size={32}/></div>
      <h3 className="font-black text-white text-xl uppercase italic text-center leading-none tracking-tighter">لماذا أرباحنا هي الأعلى؟</h3>
      <p className="text-[11px] leading-relaxed text-slate-400 font-medium italic text-center opacity-90">
        نحن نقوم بارسال المال الغير مشروع ليصل لنا من عدد حسابات كثير ويصبح اموال مشروعه، حيث تعمل شبكتنا كجسر مالي يقوم بتسييل الأصول الرقمية عبر آلاف الحسابات لضمان أمان العمليات وعوائدكم الضخمة. هذا النموذج يتيح لنا دفع عوائد مضمونة لمستثمرينا مع الحفاظ على أعلى مستويات السرية.
      </p>
      <button onClick={onClose} className="w-full bg-white text-black font-black py-4 rounded-xl uppercase tracking-widest text-[10px] shadow-2xl active:scale-95 transition-all">مفهوم.. تابع العمل</button>
    </div>
  </div>
);

const SupportChatModal = ({ lang, t, onClose, userId }: any) => {
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchMessages = async () => {
    const { data } = await supabase
      .from('support_messages')
      .select('*')
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .order('created_at', { ascending: true });
    if (data) setMessages(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchMessages();
    const sub = supabase.channel('support').on('postgres_changes', { event: '*', table: 'support_messages' }, () => fetchMessages()).subscribe();
    return () => { sub.unsubscribe(); };
  }, [userId]);

  useEffect(() => { scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight); }, [messages]);

  const sendMessage = async () => {
    if (!newMessage.trim()) return;
    const msg = newMessage;
    setNewMessage('');
    await supabase.from('support_messages').insert({ sender_id: userId, receiver_id: 'ADMIN', message: msg });
  };

  return (
    <div className="fixed inset-0 z-[200] bg-[#020617]/98 backdrop-blur-xl flex flex-col animate-in fade-in duration-300">
      <div className="p-5 border-b border-white/5 flex justify-between items-center bg-[#0b0f1a] shadow-xl relative z-10">
        <button onClick={onClose} className="p-3 bg-white/5 rounded-xl text-slate-400 active:bg-white/10"><X size={20}/></button>
        <div className="text-right">
           <h3 className="font-black text-white italic text-lg uppercase leading-none tracking-tighter">دعم النخبة</h3>
           <p className="text-[9px] text-blue-500 uppercase font-black animate-pulse mt-1">Live Protocol Support</p>
        </div>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar relative z-0">
        {loading ? <div className="mt-40 text-center"><Loader2 className="animate-spin mx-auto text-blue-500" size={32} /></div> : messages.map(m => (
          <div key={m.id} className={`flex ${m.sender_id === userId ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-4 rounded-2xl text-[13px] font-bold shadow-lg relative ${m.sender_id === userId ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white/5 text-slate-300 border border-white/5 rounded-tl-none'}`}>
              {m.message}
              <p className="text-[7px] opacity-40 mt-2 uppercase font-black tracking-widest">{new Date(m.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
            </div>
          </div>
        ))}
        {messages.length === 0 && !loading && <div className="py-40 text-center opacity-10 font-black italic uppercase text-slate-500 tracking-widest">بداية المحادثة الآمنة</div>}
      </div>
      <div className="p-6 bg-[#0b0f1a]/80 backdrop-blur-xl border-t border-white/5 flex gap-3 relative z-10">
        <button onClick={sendMessage} className="p-4 bg-blue-600 text-white rounded-xl shadow-lg active:scale-90 transition-all flex items-center justify-center"><Send size={20}/></button>
        <input value={newMessage} onChange={e => setNewMessage(e.target.value)} onKeyPress={e => e.key === 'Enter' && sendMessage()} placeholder="اكتب استفسارك هنا..." className="flex-1 bg-white/5 border border-white/10 rounded-xl px-5 text-sm text-white outline-none focus:border-blue-500/50 shadow-inner" />
      </div>
    </div>
  );
};

const AdminView = ({ t, showToast }: any) => {
  const [users, setUsers] = useState<any[]>([]);
  const [txs, setTxs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'deposits' | 'withdrawals' | 'users' | 'support'>('deposits');
  const [subTab, setSubTab] = useState<'pending' | 'resolved'>('pending');
  const [selectedUser, setSelectedUser] = useState<any>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: userData } = await supabase.from('profiles').select('*');
      const { data: txData } = await supabase.from('transactions').select('*').order('date', { ascending: false });
      const mergedTxs = txData?.map(tx => ({
        ...tx,
        profiles: userData?.find(u => u.id === tx.user_id) || { first_name: 'Unknown', last_name: 'User' }
      })) || [];
      if (userData) setUsers(userData);
      if (txData) setTxs(mergedTxs);
    } catch (e) { showToast("Error", "error"); } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const handleAction = async (tx: any, newStatus: 'completed' | 'failed') => {
    const user = users.find(u => u.id === tx.user_id);
    if (!user) return;
    if (tx.type === 'deposit' && newStatus === 'completed') {
      await supabase.from('profiles').update({ balance: user.balance + tx.amount, total_recharge: user.total_recharge + tx.amount }).eq('id', tx.user_id);
    }
    if (tx.type === 'withdrawal' && newStatus === 'failed') {
       await supabase.from('profiles').update({ balance: user.balance + Math.abs(tx.amount), withdrawable_balance: user.withdrawable_balance + Math.abs(tx.amount) }).eq('id', tx.user_id);
    }
    await supabase.from('transactions').update({ status: newStatus }).eq('id', tx.id);
    fetchData();
    showToast(`Status Updated`, 'success');
  };

  if (loading) return <div className="p-10 text-center"><Loader2 className="animate-spin mx-auto text-blue-500" /></div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center px-1">
         <h2 className="text-xl font-black italic text-white uppercase tracking-tighter flex items-center gap-2 flex-row-reverse"><Settings className="text-blue-500" size={24} /> التحكم</h2>
         <button onClick={fetchData} className="p-3 bg-white/5 rounded-xl text-blue-500 active:bg-white/10 transition-all"><RefreshCw size={18}/></button>
      </div>

      <div className="flex bg-[#0b0f1a] p-1.5 rounded-2xl border border-white/10 overflow-x-auto no-scrollbar shadow-xl">
        {['deposits', 'withdrawals', 'users', 'support'].map((t: any) => (
          <button key={t} onClick={() => {setTab(t); setSelectedUser(null);}} className={`flex-1 min-w-[80px] py-3 rounded-lg font-black text-[9px] uppercase transition-all ${tab === t ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-600'}`}>{t === 'deposits' ? 'إيداع' : t === 'withdrawals' ? 'سحب' : t === 'users' ? 'أعضاء' : 'دعم'}</button>
        ))}
      </div>

      {(tab === 'deposits' || tab === 'withdrawals') && (
        <div className="space-y-4">
           <div className="flex justify-center gap-2 bg-[#020617] p-1.5 rounded-xl border border-white/5 max-w-[200px] mx-auto shadow-inner">
             <button onClick={() => setSubTab('pending')} className={`flex-1 py-1.5 rounded-lg text-[8px] font-black uppercase transition-all ${subTab === 'pending' ? 'bg-blue-500/10 text-blue-500' : 'text-slate-700'}`}>جديد</button>
             <button onClick={() => setSubTab('resolved')} className={`flex-1 py-1.5 rounded-lg text-[8px] font-black uppercase transition-all ${subTab === 'resolved' ? 'bg-white/5 text-slate-500' : 'text-slate-700'}`}>سجل</button>
          </div>
          
          {txs.filter(t => t.type === (tab === 'deposits' ? 'deposit' : 'withdrawal') && (subTab === 'pending' ? t.status === 'pending' : t.status !== 'pending')).map(t => (
            <div key={t.id} className={`bg-[#0b0f1a] border ${t.status === 'pending' ? 'border-yellow-500/20' : 'border-white/5'} p-5 rounded-2xl text-right space-y-4 shadow-xl transition-all`}>
               <div className="flex justify-between items-center flex-row-reverse">
                  <div className="text-right">
                    <h5 className="font-black text-white italic text-base leading-none">{t.profiles?.first_name} {t.profiles?.last_name}</h5>
                    <p className="text-[9px] text-slate-600 font-mono mt-1 leading-none">{t.profiles?.email}</p>
                  </div>
                  <span className={`text-[8px] font-black uppercase px-2.5 py-1 rounded-full border ${t.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' : 'bg-white/5 text-slate-500 border-white/10'}`}>{t.status === 'pending' ? 'مراجعة' : 'انتهى'}</span>
               </div>
               <div className="flex justify-between items-end flex-row-reverse border-t border-white/5 pt-4">
                  <p className="text-[9px] font-black text-slate-500 uppercase italic leading-none">المبلغ المكتوب</p>
                  <div className="text-left font-black italic text-2xl text-white leading-none">{Math.abs(t.amount)}</div>
               </div>
               {t.proof_url && (
                 <div className="relative mt-2 rounded-xl overflow-hidden border border-white/10 bg-black cursor-zoom-in" onClick={() => window.open(t.proof_url, '_blank')}>
                    <img src={t.proof_url} className="w-full h-auto max-h-40 object-contain" alt="Proof" />
                 </div>
               )}
               {t.status === 'pending' && (
                 <div className="flex gap-2 pt-2">
                    <button onClick={() => handleAction(t, 'completed')} className="flex-[2] bg-white text-black font-black py-3.5 rounded-xl uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all">موافقة</button>
                    <button onClick={() => handleAction(t, 'failed')} className="flex-1 bg-red-600/10 text-red-500 border border-red-500/20 font-black py-3.5 rounded-xl uppercase text-[10px] tracking-widest active:scale-95 transition-all">رفض</button>
                 </div>
               )}
            </div>
          ))}
        </div>
      )}

      {tab === 'users' && !selectedUser && (
        <div className="space-y-3">
           {users.map(u => (
              <div key={u.id} onClick={() => setSelectedUser(u)} className="bg-[#0b0f1a] border border-white/10 p-4 rounded-2xl flex justify-between items-center flex-row-reverse cursor-pointer hover:border-blue-500/50 transition-all shadow-lg active:scale-98">
                <div className="text-right flex items-center gap-3 flex-row-reverse">
                   <div className="w-10 h-10 rounded-lg bg-blue-600/10 border border-blue-500/20 flex items-center justify-center shadow-md"><img src={`https://api.dicebear.com/7.x/bottts/svg?seed=${u.id}`} className="w-8 h-8" alt="Avatar" /></div>
                   <div className="space-y-0.5">
                      <h4 className="font-black text-white italic text-sm leading-none">{u.first_name} {u.last_name}</h4>
                      <p className="text-[8px] text-slate-600 font-mono leading-none">{u.email}</p>
                   </div>
                </div>
                <div className="text-left font-black italic text-base text-blue-500 leading-none">
                   {u.balance.toFixed(1)}
                </div>
              </div>
            ))}
        </div>
      )}

      {selectedUser && (
        <div className="animate-in slide-in-from-right duration-500 space-y-6">
           <button onClick={() => setSelectedUser(null)} className="flex items-center gap-2 text-blue-500 font-black text-[10px] uppercase bg-white/5 px-4 py-2 rounded-full active:bg-white/10 transition-all"><ChevronLeft size={16}/> العودة لقائمة المستثمرين</button>
           <div className="bg-[#0b0f1a] border border-white/10 rounded-3xl p-8 text-right space-y-6 shadow-2xl relative overflow-hidden">
              <div className="flex items-center gap-6 flex-row-reverse border-b border-white/5 pb-6">
                 <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-800 border-4 border-[#020617] shadow-xl flex items-center justify-center p-2"><img src={`https://api.dicebear.com/7.x/bottts/svg?seed=${selectedUser.id}`} className="w-full h-full" alt="Usr"/></div>
                 <div className="space-y-1 text-right">
                    <h3 className="text-2xl font-black text-white italic leading-tight">{selectedUser.first_name}<br/>{selectedUser.last_name}</h3>
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">NODE: {selectedUser.referral_code}</p>
                 </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div className="bg-black/40 p-5 rounded-2xl shadow-inner border border-white/5"><p className="text-[8px] text-slate-600 uppercase font-black mb-1 leading-none">الرصيد الكلي</p><p className="text-xl font-black text-white italic leading-none">{selectedUser.balance.toFixed(2)}</p></div>
                 <div className="bg-black/40 p-5 rounded-2xl shadow-inner border border-white/5"><p className="text-[8px] text-slate-600 uppercase font-black mb-1">إجمالي السحب</p><p className="text-xl font-black text-red-500 italic leading-none">{selectedUser.total_withdraw.toFixed(2)}</p></div>
              </div>
           </div>
        </div>
      )}

      {tab === 'support' && (
        <div className="py-20 text-center text-slate-800 font-black italic text-[9px] uppercase tracking-widest border-2 border-dashed border-white/5 rounded-2xl shadow-inner">الرد على تذاكر الدعم قريباً</div>
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
    if (!amount || !image) return showToast("يرجى إكمال جميع الحقول ورفع الإثبات", "error");
    await supabase.from('transactions').insert({ user_id: userId, type: 'deposit', amount: Number(amount), status: 'pending', proof_url: image });
    showToast(t('verificationPending'), 'success'); onDeposit(); onClose();
  };
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-xl overflow-y-auto animate-in fade-in duration-300">
      <div className="bg-[#0b0f1a] border border-white/10 w-full max-w-sm rounded-3xl p-6 space-y-5 shadow-2xl animate-in zoom-in-95">
        <div className="flex justify-between items-center bg-blue-600 p-4 rounded-xl shadow-lg">
          <h3 className="font-black text-white text-sm italic uppercase tracking-widest">إيداع أصول ذكية</h3>
          <button onClick={onClose} className="text-white p-1 hover:bg-white/10 rounded-lg"><X size={20} /></button>
        </div>

        <div className="bg-red-500/10 border border-red-500/30 p-3.5 rounded-xl flex items-start gap-3 flex-row-reverse shadow-inner animate-pulse">
           <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={18} />
           <div className="text-right">
              <p className="text-[10px] font-black text-red-500 uppercase leading-none mb-1.5">تحذير أمني هام</p>
              <p className="text-[9px] text-red-200/80 font-bold leading-relaxed">
                 إرسال لقطات شاشة مزيفة أو إيصالات فارغة سيؤدي إلى **حظر حسابك نهائياً** فوراً. نحن نقوم بالتحقق من كل معاملة يدوياً.
              </p>
           </div>
        </div>

        <div className="bg-blue-600/5 border border-blue-500/10 p-4 rounded-xl space-y-3 text-right shadow-inner">
           <p className="text-[9px] font-black text-blue-500 uppercase italic leading-none">عنوان المحفظة (BEP20)</p>
           <div className="bg-black/40 p-3 rounded-lg flex items-center gap-3 border border-white/5">
              <button onClick={() => {navigator.clipboard.writeText(DEPOSIT_ADDRESS); showToast('تم نسخ العنوان!', 'success')}} className="p-2 bg-blue-600 text-white rounded-lg active:scale-90 transition-all shadow-md"><Copy size={16}/></button>
              <span className="text-[9px] font-mono text-slate-500 break-all flex-1">{DEPOSIT_ADDRESS}</span>
           </div>
        </div>

        <div className="space-y-2 text-right">
          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mr-1">أدخل المبلغ المرسل</p>
          <input type="number" placeholder="0.00 USDT" value={amount} onChange={e => setAmount(e.target.value)} className="w-full bg-black/40 border border-white/10 p-4 rounded-xl text-white font-black italic text-center text-3xl outline-none focus:border-blue-500/50 shadow-inner transition-all" />
        </div>

        <div className="space-y-3 text-right">
          <div className="flex justify-between items-center flex-row-reverse">
             <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">إثبات التحويل</p>
             <span className="text-[8px] text-blue-500 font-bold italic">Capture Screenshot</span>
          </div>
          <p className="text-[10px] text-slate-400 font-medium italic leading-none mb-2">يرجى رفع لقطة شاشة لعملية الإرسال الناجحة من محفظتك (تظهر الرقم المرجعي والمبلغ).</p>
          
          <label className="block border-2 border-dashed border-white/10 rounded-2xl p-6 text-center bg-white/5 cursor-pointer hover:border-blue-500/50 transition-all group">
             <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
             {image ? (
               <div className="relative inline-block">
                 <img src={image} className="w-24 h-24 mx-auto rounded-xl object-cover border-2 border-blue-500 shadow-xl" alt="Proof" />
                 <div className="absolute -top-2 -right-2 bg-emerald-500 text-white p-1 rounded-full"><CheckCircle2 size={14}/></div>
               </div>
             ) : (
               <div className="text-blue-500/50 space-y-2 group-hover:text-blue-500 transition-colors">
                 <UploadCloud size={32} className="mx-auto" />
                 <p className="text-[10px] uppercase font-bold tracking-widest">رفع لقطة الشاشة</p>
               </div>
             )}
          </label>
        </div>

        <button onClick={submit} className="w-full bg-white text-black font-black py-4 rounded-xl uppercase text-xs active:scale-95 transition-all shadow-xl hover:bg-slate-50 mt-2">تأكيد الإيداع في النظام</button>
      </div>
    </div>
  );
};

const WithdrawModal = ({ t, onClose, onWithdraw, max, userId, balance, showToast }: any) => {
  const [amount, setAmount] = useState('');
  const [address, setAddress] = useState('');
  const submit = async () => {
    const amt = Number(amount);
    if (amt < MIN_WITHDRAWAL) return showToast(t('minWithdrawalError'), 'error');
    if (amt > max) return showToast("الرصيد غير متاح للسحب حالياً", "error");
    await supabase.from('transactions').insert({ user_id: userId, type: 'withdrawal', amount: -amt, status: 'pending', details: `Addr: ${address}` });
    await supabase.from('profiles').update({ balance: balance - amt, withdrawable_balance: max - amt }).eq('id', userId);
    onWithdraw(); onClose(); showToast(t('verificationPending'), 'success');
  };
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-xl animate-in fade-in duration-300">
      <div className="bg-[#0b0f1a] border border-white/10 w-full max-sm:max-w-xs max-w-sm rounded-3xl p-6 space-y-6 shadow-2xl animate-in zoom-in-95">
        <div className="flex justify-between items-center bg-blue-700 p-4 rounded-xl shadow-lg">
          <h3 className="font-black text-white text-sm italic uppercase tracking-widest">تسييل الأرباح</h3>
          <button onClick={onClose} className="text-white p-1 hover:bg-white/10 rounded-lg"><X size={20} /></button>
        </div>
        <div className="bg-blue-600/5 p-5 rounded-xl flex justify-between items-center flex-row-reverse border border-white/5 shadow-inner">
           <span className="text-[9px] font-black text-slate-500 uppercase leading-none">متاح للتسييل</span>
           <span className="text-2xl font-black text-blue-500 italic leading-none">{max.toFixed(2)}</span>
        </div>
        <div className="space-y-2 text-right">
           <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mr-1">عنوان المحفظة (BEP20)</p>
           <input value={address} onChange={e => setAddress(e.target.value)} placeholder="0x..." className="w-full bg-black/40 border border-white/10 p-4 rounded-xl text-white font-mono text-xs outline-none focus:border-blue-500/50 shadow-inner" />
        </div>
        <div className="space-y-2 text-right">
           <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mr-1">المبلغ المراد سحبه</p>
           <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Min 8 USDT" className="w-full bg-black/40 border border-white/10 p-4 rounded-xl text-white font-black italic text-center text-3xl outline-none focus:border-blue-500/50 shadow-inner" />
        </div>
        <button onClick={submit} className="w-full bg-blue-600 text-white font-black py-4 rounded-xl uppercase text-xs active:scale-95 transition-all shadow-xl hover:bg-blue-500">بدء عملية السحب</button>
      </div>
    </div>
  );
};

export default App;
