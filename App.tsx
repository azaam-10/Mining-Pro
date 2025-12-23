
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { 
  Home as HomeIcon, Cpu, ListTodo, Users, User as UserIcon, 
  Loader2, ShieldCheck, HelpCircle, X, Copy, 
  Zap, Settings, RefreshCw, MessageCircle, Send,
  LogOut, TrendingUp, Activity, Info, Briefcase, History, 
  Search, Check, XCircle, Eye, UserPlus, DollarSign, ArrowDownCircle, ArrowUpCircle
} from 'lucide-react';
import { Language, UserState, UserMachine, Machine, Transaction, SupportMessage } from './types';
import { TRANSLATIONS, MACHINES, DEPOSIT_ADDRESS, MIN_WITHDRAWAL, ADMIN_EMAIL } from './constants';
import { supabase } from './supabase';

interface Toast { message: string; type: 'success' | 'error' | 'info'; id: number; }

const App: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const [lang, setLang] = useState<Language>(() => {
    const browserLang = navigator.language.split('-')[0];
    return browserLang === 'ar' ? 'ar' : 'en';
  });

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
  const [adminUUID, setAdminUUID] = useState<string | null>(null);

  const fetchAdminUUID = useCallback(async () => {
    try {
      const { data } = await supabase.from('profiles').select('id').eq('email', ADMIN_EMAIL).maybeSingle();
      if (data) setAdminUUID(data.id);
    } catch (e) { console.error("Admin fetch error", e); }
  }, []);

  const fetchAllUserData = useCallback(async (userId: string, userEmail: string, isManual: boolean = false) => {
    if (!userId) return;
    if (isManual) setSyncing(true);
    
    try {
      const [profileRes, machinesRes, txsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
        supabase.from('user_machines').select('*').eq('user_id', userId),
        supabase.from('transactions').select('*').eq('user_id', userId).order('date', { ascending: false })
      ]);

      let profile = profileRes.data;

      if (!profile) {
        const { data: newProfile, error } = await supabase.from('profiles').insert([
          { 
            id: userId, 
            balance: 0, 
            withdrawable_balance: 0, 
            referral_code: Math.random().toString(36).substring(2, 8).toUpperCase(),
            first_name: 'User',
            last_name: '',
            email: userEmail
          }
        ]).select().single();
        if (!error) profile = newProfile;
      }

      if (profile) {
        setUserData({
          ...profile,
          email: userEmail,
          withdrawableBalance: profile.withdrawable_balance || 0,
          totalRecharge: profile.total_recharge || 0,
          totalWithdraw: profile.total_withdraw || 0,
          referralEarnings: profile.referral_earnings || 0,
          ownedMachines: (machinesRes.data || []).filter(m => m.remaining_days > 0),
          transactions: txsRes.data || [],
          lastWithdrawDate: null
        });
        await fetchAdminUUID();
      }

      if (isManual) showToast(lang === 'ar' ? "تم تحديث البيانات" : "Data Updated", "success");
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }, [lang, fetchAdminUUID]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) fetchAllUserData(session.user.id, session.user.email || '');
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) fetchAllUserData(session.user.id, session.user.email || '');
      else { setUserData(null); setLoading(false); }
    });

    return () => subscription.unsubscribe();
  }, [fetchAllUserData]);

  const showToast = (message: any, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now();
    const finalMsg = typeof message === 'object' ? message.message || "System Message" : String(message);
    setToasts(prev => [...prev, { message: finalMsg, type, id }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  const t = (key: string) => TRANSLATIONS[key]?.[lang] || key;

  const buyMachine = async (machine: Machine) => {
    if (!userData || !session?.user || isProcessing) return;
    if (userData.balance < machine.price) {
      return showToast(lang === 'ar' ? "رصيدك غير كافٍ" : "Insufficient balance", 'error');
    }
    setIsProcessing(true);
    try {
      await supabase.from('user_machines').insert({
        user_id: session.user.id,
        machine_id: machine.id,
        remaining_days: machine.duration,
        total_earned: 0
      });
      await supabase.from('profiles').update({ balance: Number(userData.balance) - machine.price }).eq('id', session.user.id);
      showToast(lang === 'ar' ? "تم التفعيل بنجاح" : "Activation Success", 'success');
      await fetchAllUserData(session.user.id, session.user.email!);
    } catch (e) { showToast(e, 'error'); }
    finally { setIsProcessing(false); }
  };

  const completeTask = async (um: UserMachine) => {
    if (!userData || !session?.user || isProcessing) return;
    const lastClaim = um.last_claim_date ? new Date(um.last_claim_date).getTime() : 0;
    if (Date.now() - lastClaim < 24 * 60 * 60 * 1000) {
      return showToast(lang === 'ar' ? "المهمة قيد الانتظار" : "Task pending", 'error');
    }
    const machine = MACHINES.find(m => m.id === um.machine_id);
    if (!machine) return;
    setIsProcessing(true);
    try {
      await supabase.from('user_machines').update({
        last_claim_date: new Date().toISOString(),
        total_earned: (um.total_earned || 0) + machine.dailyProfit,
        remaining_days: Math.max(0, um.remaining_days - 1)
      }).eq('id', um.id);
      await supabase.from('profiles').update({ 
        balance: Number(userData.balance) + machine.dailyProfit,
        withdrawable_balance: Number(userData.withdrawableBalance) + machine.dailyProfit
      }).eq('id', session.user.id);
      await supabase.from('transactions').insert({ user_id: session.user.id, type: 'task', amount: machine.dailyProfit, status: 'completed' });
      showToast(lang === 'ar' ? "تم استلام الربح" : "Profit claimed", 'success');
      await fetchAllUserData(session.user.id, session.user.email!);
    } catch (e) { showToast(e, 'error'); }
    finally { setIsProcessing(false); }
  };

  if (loading) return <ProtocolLoadingScreen />;
  if (!session) return <AuthView lang={lang} t={t} showToast={showToast} />;
  if (!userData) return <ProtocolLoadingScreen />;

  return (
    <div className={`min-h-screen pb-24 ${lang === 'ar' ? 'rtl font-["Cairo"]' : 'font-sans'} bg-[#020617] text-[#f8fafc] overflow-x-hidden relative`}>
      {isProcessing && <div className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm flex items-center justify-center"><Loader2 className="animate-spin text-blue-500" size={32} /></div>}
      
      {showInfo && <InfoModal lang={lang} onClose={() => setShowInfo(false)} />}
      {showRecharge && <RechargeModal lang={lang} t={t} onClose={() => setShowRecharge(false)} onDeposit={() => fetchAllUserData(session.user.id, session.user.email || '')} showToast={showToast} userId={session.user.id} />}
      {showWithdraw && <WithdrawModal lang={lang} t={t} onClose={() => setShowWithdraw(false)} onWithdraw={() => fetchAllUserData(session.user.id, session.user.email || '')} userData={userData} userId={session.user.id} showToast={showToast} />}
      {showSupport && <SupportChatModal lang={lang} onClose={() => setShowSupport(false)} userId={session.user.id} adminId={adminUUID} />}
      
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-full max-w-[85%] space-y-2 pointer-events-none">
        {toasts.map(toast => (
          <div key={toast.id} className={`flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl pointer-events-auto backdrop-blur-3xl border border-white/10 ${toast.type === 'error' ? 'bg-red-500/20 text-red-200' : 'bg-emerald-500/20 text-emerald-100'}`}>
            <span className="text-[12px] font-bold">{toast.message}</span>
          </div>
        ))}
      </div>

      <header className="px-4 py-4 border-b border-white/5 backdrop-blur-xl sticky top-0 z-40 bg-[#020617]/80 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center"><Zap size={18} className="text-white fill-white" /></div>
          <span className="font-black italic text-lg tracking-tighter uppercase">MINE<span className="text-blue-500">PRO</span></span>
        </div>
        <div className="flex gap-1.5 items-center">
          <button onClick={() => fetchAllUserData(session.user.id, session.user.email || '', true)} className={`p-2 bg-blue-500/10 text-blue-400 rounded-xl ${syncing ? 'animate-spin' : ''}`}><RefreshCw size={18} /></button>
          <button onClick={() => setShowSupport(true)} className="p-2 bg-blue-500/10 text-blue-500 rounded-xl"><MessageCircle size={18}/></button>
          <button onClick={() => supabase.auth.signOut()} className="p-2 bg-red-500/10 text-red-500 rounded-xl"><LogOut size={18} /></button>
        </div>
      </header>

      <main className="max-w-md mx-auto p-4 space-y-6">
        <Routes>
          <Route path="/" element={<HomeView user={userData} t={t} onShowInfo={() => setShowInfo(true)} onShowRecharge={() => setShowRecharge(true)} onShowWithdraw={() => setShowWithdraw(true)} lang={lang} />} />
          <Route path="/machines" element={<MachinesView user={userData} onBuy={buyMachine} t={t} lang={lang} />} />
          <Route path="/tasks" element={<TasksView user={userData} onComplete={completeTask} t={t} lang={lang} />} />
          <Route path="/team" element={<TeamView user={userData} t={t} lang={lang} />} />
          <Route path="/profile" element={<ProfileView user={userData} t={t} lang={lang} />} />
          <Route path="/admin" element={userData.email === ADMIN_EMAIL ? <AdminView t={t} showToast={showToast} lang={lang} currentAdminId={session.user.id} /> : <Navigate to="/" />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-[#020617]/95 backdrop-blur-xl border-t border-white/5 p-4 z-40">
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

// الواجهات (Views)
const HomeView = ({ user, t, onShowInfo, onShowRecharge, onShowWithdraw, lang }: any) => (
  <div className="space-y-6 animate-in fade-in">
    <div className="bg-[#0b0f1a] border border-white/10 rounded-3xl p-6 shadow-2xl space-y-6">
      <div className="flex justify-between items-center">
        <p className="text-white/40 font-black text-[10px] uppercase tracking-widest">{t('balanceTitle')}</p>
        <button onClick={onShowInfo} className="text-blue-500 text-[10px] font-bold">INFO</button>
      </div>
      <h2 className="text-5xl font-black text-white">{(Number(user?.balance) || 0).toFixed(2)}<span className="text-sm text-blue-500 ml-2">USDT</span></h2>
      <div className="flex gap-3">
        <button onClick={onShowRecharge} className="flex-1 bg-white text-black font-black py-3 rounded-xl text-[12px] uppercase">{t('recharge')}</button>
        <button onClick={onShowWithdraw} className="flex-1 bg-blue-600 text-white font-black py-3 rounded-xl text-[12px] uppercase">{t('withdraw')}</button>
      </div>
    </div>
    <div className="space-y-4">
      <h3 className="text-[10px] font-black uppercase text-slate-600 px-1">{t('history')}</h3>
      {(user?.transactions || []).slice(0, 5).map((tx: any) => (
        <div key={tx.id} className="bg-[#0b0f1a] p-4 rounded-xl flex justify-between items-center border border-white/5">
          <div className="flex gap-3 items-center">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${tx.amount > 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
              {tx.type === 'task' ? <TrendingUp size={14}/> : <Activity size={14}/>}
            </div>
            <div>
              <p className="text-xs font-black text-white uppercase italic">{tx.type}</p>
              <p className="text-[8px] text-slate-700">{new Date(tx.date).toLocaleDateString()}</p>
            </div>
          </div>
          <p className={`font-black ${tx.amount > 0 ? 'text-emerald-500' : 'text-red-500'}`}>{tx.amount > 0 ? '+' : ''}{tx.amount.toFixed(2)}</p>
        </div>
      ))}
    </div>
  </div>
);

const MachinesView = ({ user, onBuy, t, lang }: any) => (
  <div className="space-y-6 animate-in fade-in">
    <h2 className="text-xl font-black italic uppercase text-white px-1">{t('machines')}</h2>
    <div className="space-y-6">
      {MACHINES.map(m => {
        const owned = (user?.ownedMachines || []).some((om: any) => om.machine_id === m.id);
        return (
          <div key={m.id} className={`bg-[#0b0f1a] rounded-3xl p-6 border ${owned ? 'border-emerald-500/30' : 'border-white/10'} space-y-4 shadow-xl`}>
             <div className="flex justify-between items-start">
                <div className={`w-12 h-12 bg-gradient-to-br ${m.color} rounded-2xl flex items-center justify-center`}><Cpu className="text-white" /></div>
                <div className="text-right">
                   <p className="text-2xl font-black text-white">{m.price} <span className="text-[10px] text-blue-500">USDT</span></p>
                   <p className="text-[10px] text-emerald-500 font-black">+{m.dailyProfit} DAILY</p>
                </div>
             </div>
             <div>
                <h3 className="font-black text-white uppercase italic">{m.name}</h3>
                <p className="text-[10px] text-slate-500 mt-1">{lang === 'ar' ? `المدة: ${m.duration} يوم` : `Duration: ${m.duration} Days`}</p>
             </div>
             <button onClick={() => !owned && onBuy(m)} disabled={owned} className={`w-full py-3 rounded-xl font-black uppercase text-xs ${owned ? 'bg-slate-800 text-slate-500' : 'bg-white text-black'}`}>
                {owned ? 'ACTIVE' : t('buyNow')}
             </button>
          </div>
        );
      })}
    </div>
  </div>
);

const TasksView = ({ user, onComplete, t, lang }: any) => (
  <div className="space-y-6 animate-in fade-in">
    <h2 className="text-xl font-black italic uppercase text-white px-1">{t('tasks')}</h2>
    {(user?.ownedMachines || []).map((um: any) => {
      const m = MACHINES.find(x => x.id === um.machine_id);
      const lastClaim = um.last_claim_date ? new Date(um.last_claim_date).getTime() : 0;
      const isLocked = Date.now() - lastClaim < 24 * 60 * 60 * 1000;
      return (
        <div key={um.id} className="bg-[#0b0f1a] p-5 rounded-2xl border border-white/5 space-y-4 shadow-lg">
           <div className="flex justify-between items-center">
              <div>
                 <p className="text-white font-black text-sm uppercase italic">{m?.name}</p>
                 <p className="text-[9px] text-slate-500">{um.remaining_days} DAYS LEFT</p>
              </div>
              <p className="text-emerald-500 font-black">+{m?.dailyProfit}</p>
           </div>
           <button onClick={() => !isLocked && onComplete(um)} disabled={isLocked} className={`w-full py-3 rounded-xl font-black uppercase text-xs ${isLocked ? 'bg-slate-800 text-slate-500' : 'bg-emerald-600 text-white'}`}>
              {isLocked ? 'PENDING...' : t('completeTask')}
           </button>
        </div>
      );
    })}
    {(user?.ownedMachines || []).length === 0 && <div className="py-20 text-center text-slate-600 font-bold uppercase italic text-xs">No active machines</div>}
  </div>
);

const TeamView = ({ user, t, lang }: any) => (
  <div className="space-y-6 animate-in fade-in">
    <h2 className="text-xl font-black italic uppercase text-white px-1">{t('team')}</h2>
    <div className="bg-[#0b0f1a] p-6 rounded-3xl border border-white/10 space-y-4">
       <p className="text-[10px] font-black text-slate-500 uppercase">Referral Code</p>
       <div className="flex items-center gap-3 bg-black/40 p-3 rounded-xl border border-white/5">
          <span className="flex-1 font-mono text-white text-center tracking-widest">{user?.referral_code}</span>
          <button onClick={() => navigator.clipboard.writeText(user?.referral_code || '')} className="p-2 bg-blue-600 rounded-lg text-white"><Copy size={16}/></button>
       </div>
       <div className="grid grid-cols-2 gap-4">
          <div className="bg-white/5 p-4 rounded-2xl border border-white/5 text-center">
             <p className="text-[9px] font-black text-slate-500 uppercase">Earnings</p>
             <p className="text-xl font-black text-emerald-500">{(user?.referralEarnings || 0).toFixed(2)}</p>
          </div>
          <div className="bg-white/5 p-4 rounded-2xl border border-white/5 text-center">
             <p className="text-[9px] font-black text-slate-500 uppercase">Comm</p>
             <p className="text-xl font-black text-blue-500">10%</p>
          </div>
       </div>
    </div>
  </div>
);

const ProfileView = ({ user, t, lang }: any) => (
  <div className="space-y-6 animate-in fade-in">
    <div className="p-6 bg-[#0b0f1a] border border-white/10 rounded-3xl shadow-xl flex items-center gap-4">
       <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center p-2">
          <img src={`https://api.dicebear.com/7.x/bottts/svg?seed=${user?.id || 'default'}`} className="w-full h-full" alt="avatar"/>
       </div>
       <div>
          <h3 className="text-xl font-black text-white italic">{user?.first_name} {user?.last_name}</h3>
          <p className="text-[10px] text-blue-500 font-mono">{user?.email}</p>
       </div>
    </div>
    <div className="grid grid-cols-2 gap-4">
       <div className="bg-[#0b0f1a] p-4 rounded-2xl border border-white/5"><p className="text-[9px] text-slate-600 uppercase font-black">Total In</p><p className="text-xl font-black text-emerald-500">{(user?.totalRecharge || 0).toFixed(2)}</p></div>
       <div className="bg-[#0b0f1a] p-4 rounded-2xl border border-white/5"><p className="text-[9px] text-slate-600 uppercase font-black">Total Out</p><p className="text-xl font-black text-red-500">{(user?.totalWithdraw || 0).toFixed(2)}</p></div>
    </div>
  </div>
);

const AdminView = ({ t, showToast, lang, currentAdminId }: any) => {
  const [activeTab, setActiveTab] = useState<'support' | 'deposits' | 'withdrawals' | 'members'>('support');
  const [threads, setThreads] = useState<any[]>([]);
  const [deposits, setDeposits] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === 'support') {
        const { data: msgs } = await supabase.from('support_messages').select('*').order('created_at', { ascending: false });
        const { data: users } = await supabase.from('profiles').select('*');
        if (msgs && users) {
          const userIds = Array.from(new Set(msgs.map(m => m.sender_id === currentAdminId ? m.receiver_id : m.sender_id))).filter(id => id !== currentAdminId);
          const threadList = userIds.map(uid => {
            const user = users.find(u => u.id === uid);
            const last = msgs.find(m => m.sender_id === uid || m.receiver_id === uid);
            return { userId: uid, name: user?.first_name || 'Anonymous', lastMsg: last?.message, date: last?.created_at };
          });
          setThreads(threadList);
        }
      } else if (activeTab === 'deposits') {
        const { data } = await supabase.from('transactions').select('*, profiles(first_name, email)').eq('type', 'deposit').eq('status', 'pending');
        setDeposits(data || []);
      } else if (activeTab === 'withdrawals') {
        const { data } = await supabase.from('transactions').select('*, profiles(first_name, email, withdrawable_balance)').eq('type', 'withdrawal').eq('status', 'pending');
        setWithdrawals(data || []);
      } else if (activeTab === 'members') {
        const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
        setMembers(data || []);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [activeTab, currentAdminId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleTx = async (tx: any, newStatus: 'completed' | 'failed') => {
    try {
      await supabase.from('transactions').update({ status: newStatus }).eq('id', tx.id);
      if (tx.type === 'deposit' && newStatus === 'completed') {
        const { data: profile } = await supabase.from('profiles').select('balance, total_recharge').eq('id', tx.user_id).single();
        await supabase.from('profiles').update({ 
          balance: Number(profile.balance) + tx.amount,
          total_recharge: Number(profile.total_recharge || 0) + tx.amount 
        }).eq('id', tx.user_id);
      }
      showToast("Updated Success", "success");
      fetchData();
    } catch (e) { showToast(e, "error"); }
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4">
      <div className="flex bg-[#0b0f1a] p-1 rounded-2xl border border-white/5 overflow-x-auto no-scrollbar">
        <TabBtn active={activeTab === 'support'} onClick={() => setActiveTab('support')} icon={MessageCircle} label="Chat" />
        <TabBtn active={activeTab === 'deposits'} onClick={() => setActiveTab('deposits')} icon={ArrowDownCircle} label="Deps" />
        <TabBtn active={activeTab === 'withdrawals'} onClick={() => setActiveTab('withdrawals')} icon={ArrowUpCircle} label="With" />
        <TabBtn active={activeTab === 'members'} onClick={() => setActiveTab('members')} icon={Users} label="Users" />
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-500" /></div>
      ) : (
        <div className="space-y-3">
          {activeTab === 'support' && (
            <>
              {activeChat && <div className="fixed inset-0 z-[250] bg-black"><SupportChatModal userId={activeChat} adminId={currentAdminId} onClose={() => setActiveChat(null)} lang={lang} /></div>}
              {threads.length === 0 ? <EmptyState /> : threads.map(t => (
                <div key={t.userId} onClick={() => setActiveChat(t.userId)} className="bg-[#0b0f1a] p-4 rounded-2xl border border-white/5 flex justify-between items-center cursor-pointer">
                  <div className="flex gap-3 items-center">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500 font-bold italic">{t.name[0]}</div>
                    <div><p className="text-white font-black text-xs">{t.name}</p><p className="text-[10px] text-slate-500 truncate">{t.lastMsg}</p></div>
                  </div>
                  <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
                </div>
              ))}
            </>
          )}

          {activeTab === 'deposits' && deposits.map(d => (
            <div key={d.id} className="bg-[#0b0f1a] p-4 rounded-2xl border border-white/5 space-y-3">
              <div className="flex justify-between items-start">
                <div><p className="text-white font-black text-xs">{d.profiles?.first_name}</p><p className="text-[9px] text-slate-500">{d.profiles?.email}</p></div>
                <p className="text-emerald-500 font-black">+{d.amount} USDT</p>
              </div>
              {d.proof_url && (
                <div className="relative group">
                   <img src={d.proof_url} className="w-full h-32 object-cover rounded-xl opacity-60 group-hover:opacity-100 transition-opacity" alt="proof" />
                   <button onClick={() => window.open(d.proof_url)} className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100"><Eye className="text-white" /></button>
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={() => handleTx(d, 'completed')} className="flex-1 bg-emerald-600 py-2 rounded-lg text-[10px] font-black"><Check size={14} className="inline mr-1" /> APPROVE</button>
                <button onClick={() => handleTx(d, 'failed')} className="flex-1 bg-red-600/20 text-red-500 py-2 rounded-lg text-[10px] font-black"><XCircle size={14} className="inline mr-1" /> REJECT</button>
              </div>
            </div>
          ))}

          {activeTab === 'withdrawals' && withdrawals.map(w => (
            <div key={w.id} className="bg-[#0b0f1a] p-4 rounded-2xl border border-white/5 space-y-3">
              <div className="flex justify-between items-start">
                <div><p className="text-white font-black text-xs">{w.profiles?.first_name}</p><p className="text-[9px] text-slate-500">Avail: {w.profiles?.withdrawable_balance}</p></div>
                <p className="text-red-500 font-black">{w.amount} USDT</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleTx(w, 'completed')} className="flex-1 bg-blue-600 py-2 rounded-lg text-[10px] font-black">APPROVE</button>
                <button onClick={() => handleTx(w, 'failed')} className="flex-1 bg-red-600/20 text-red-500 py-2 rounded-lg text-[10px] font-black">REJECT</button>
              </div>
            </div>
          ))}

          {activeTab === 'members' && members.map(m => (
            <div key={m.id} className="bg-[#0b0f1a] p-4 rounded-2xl border border-white/5 flex justify-between items-center">
               <div className="flex gap-3 items-center">
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center"><UserIcon size={14}/></div>
                  <div><p className="text-white font-black text-xs">{m.first_name}</p><p className="text-[9px] text-slate-500">{m.email}</p></div>
               </div>
               <div className="text-right"><p className="text-blue-500 font-black text-xs">{Number(m.balance).toFixed(2)}</p><p className="text-[8px] text-slate-600 uppercase font-black">USDT</p></div>
            </div>
          ))}
          
          {!loading && activeTab !== 'support' && (activeTab === 'deposits' ? deposits.length : activeTab === 'withdrawals' ? withdrawals.length : members.length) === 0 && <EmptyState />}
        </div>
      )}
    </div>
  );
};

const TabBtn = ({ active, onClick, icon: Icon, label }: any) => (
  <button onClick={onClick} className={`flex-1 py-3 px-2 rounded-xl flex flex-col items-center gap-1 transition-all ${active ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-600'}`}>
    <Icon size={16} /><span className="text-[8px] font-black uppercase tracking-tighter">{label}</span>
  </button>
);

const EmptyState = () => (
  <div className="py-20 text-center opacity-20 space-y-2">
    <HelpCircle size={40} className="mx-auto" />
    <p className="text-[10px] font-black uppercase italic">No records found</p>
  </div>
);

const SupportChatModal = ({ userId, adminId, onClose, lang }: any) => {
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchMessages = useCallback(async () => {
    if (!userId || !adminId) return;
    const { data } = await supabase.from('support_messages')
      .select('*')
      .or(`and(sender_id.eq.${userId},receiver_id.eq.${adminId}),and(sender_id.eq.${adminId},receiver_id.eq.${userId})`)
      .order('created_at', { ascending: true });
    if (data) setMessages(data);
    setLoading(false);
  }, [userId, adminId]);

  useEffect(() => {
    fetchMessages();
    const sub = supabase.channel(`support-${userId}`).on('postgres_changes', { event: '*', table: 'support_messages' }, fetchMessages).subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [userId, adminId, fetchMessages]);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages]);

  const send = async () => {
    if (!newMessage.trim() || !userId || !adminId) return;
    const msg = newMessage; setNewMessage('');
    await supabase.from('support_messages').insert({ sender_id: userId, receiver_id: adminId, message: msg });
  };

  return (
    <div className="fixed inset-0 z-[200] bg-[#020617]/98 backdrop-blur-xl flex flex-col">
      <div className="p-5 border-b border-white/5 flex justify-between items-center bg-[#0b0f1a]">
        <button onClick={onClose} className="p-2 bg-white/5 rounded-lg text-slate-400"><X size={20}/></button>
        <h3 className="font-black text-white italic tracking-widest">{lang === 'ar' ? 'الدعم المباشر' : 'Live Support'}</h3>
        <div className="w-8"></div>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar">
        {loading ? <div className="flex justify-center"><Loader2 className="animate-spin" /></div> : messages.map(m => (
          <div key={m.id} className={`flex ${m.sender_id === userId ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] p-3 rounded-2xl text-[11px] font-bold ${m.sender_id === userId ? 'bg-blue-600 text-white rounded-tr-none shadow-lg' : 'bg-white/10 text-slate-200 rounded-tl-none border border-white/5'}`}>{m.message}</div>
          </div>
        ))}
      </div>
      <div className="p-4 bg-[#0b0f1a] border-t border-white/5 flex gap-2">
        <button onClick={send} className="p-3 bg-blue-600 text-white rounded-xl"><Send size={18}/></button>
        <input value={newMessage} onChange={e => setNewMessage(e.target.value)} onKeyPress={e => e.key === 'Enter' && send()} placeholder="..." className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 text-xs text-white outline-none" />
      </div>
    </div>
  );
};

const AuthView = ({ lang, t, showToast }: any) => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ firstName: '', lastName: '', email: '', password: '' });
  const handleAuth = async (e: any) => {
    e.preventDefault();
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email: formData.email, password: formData.password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ 
          email: formData.email, password: formData.password, 
          options: { data: { first_name: formData.firstName, last_name: formData.lastName } }
        });
        if (error) throw error;
        showToast("Success! Please login.", "success"); setIsLogin(true);
      }
    } catch (e) { showToast(e, 'error'); }
  };
  return (
    <div className="min-h-screen bg-[#020617] p-6 flex flex-col justify-center">
       <div className="max-w-xs mx-auto w-full space-y-8">
          <div className="text-center">
            <h1 className="text-4xl font-black text-white italic tracking-tighter uppercase">MINE<span className="text-blue-500">PRO</span></h1>
          </div>
          <form onSubmit={handleAuth} className="bg-[#0b0f1a] p-6 rounded-3xl border border-white/10 space-y-4 shadow-2xl relative overflow-hidden">
             <div className="flex p-1 bg-black/50 rounded-xl mb-4">
                <button type="button" onClick={() => setIsLogin(true)} className={`flex-1 py-2 rounded-lg text-[10px] font-black transition-all ${isLogin ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-600'}`}>LOGIN</button>
                <button type="button" onClick={() => setIsLogin(false)} className={`flex-1 py-2 rounded-lg text-[10px] font-black transition-all ${!isLogin ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-600'}`}>JOIN</button>
             </div>
             {!isLogin && <input placeholder="First Name" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} className="w-full bg-[#020617] border border-white/5 p-3 rounded-xl text-xs text-white outline-none" />}
             <input placeholder="Email Address" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full bg-[#020617] border border-white/5 p-3 rounded-xl text-xs text-white outline-none" />
             <input type="password" placeholder="Password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full bg-[#020617] border border-white/5 p-3 rounded-xl text-xs text-white outline-none" />
             <button className="w-full bg-white text-black font-black py-4 rounded-xl text-[10px] uppercase shadow-xl">Authorize Protocol</button>
          </form>
       </div>
    </div>
  );
};

const RechargeModal = ({ onClose, onDeposit, showToast, userId, lang }: any) => {
  const [amount, setAmount] = useState('');
  const [image, setImage] = useState('');
  const submit = async () => {
    if (!amount || !image) return;
    await supabase.from('transactions').insert({ user_id: userId, type: 'deposit', amount: Number(amount), proof_url: image, status: 'pending', date: new Date().toISOString() });
    showToast("Sent for review", "success"); onClose();
  };
  return (
    <div className="fixed inset-0 z-[110] bg-black/95 p-6 flex items-center justify-center animate-in zoom-in-95">
       <div className="bg-[#0b0f1a] w-full max-w-xs p-6 rounded-3xl border border-white/10 space-y-4 shadow-2xl">
          <div className="flex justify-between items-center"><h3 className="text-white font-black italic uppercase">Recharge</h3><button onClick={onClose} className="p-2 bg-white/5 rounded-lg"><X size={16}/></button></div>
          <div className="p-3 bg-white/5 rounded-xl text-[9px] break-all font-mono text-center border border-white/5 text-blue-300 select-all cursor-pointer" onClick={() => {navigator.clipboard.writeText(DEPOSIT_ADDRESS); showToast("Copied!", "success")}}>{DEPOSIT_ADDRESS}</div>
          <input type="number" placeholder="Enter Amount" value={amount} onChange={e => setAmount(e.target.value)} className="w-full bg-black/50 border border-white/5 p-3 rounded-xl text-white text-center font-black outline-none" />
          <textarea placeholder="Paste Proof Image Data / Base64" value={image} onChange={e => setImage(e.target.value)} className="w-full bg-black/50 border border-white/5 p-3 rounded-xl text-[9px] text-white h-20 outline-none" />
          <button onClick={submit} className="w-full bg-blue-600 py-3 rounded-xl font-black text-white text-[10px] uppercase tracking-widest shadow-lg active:scale-95 transition-transform">Submit Protocol Proof</button>
       </div>
    </div>
  );
};

const WithdrawModal = ({ onClose, userData, userId, showToast, lang }: any) => {
  const [amount, setAmount] = useState('');
  const [address, setAddress] = useState('');
  const submit = async () => {
    const amt = Number(amount);
    if (amt < MIN_WITHDRAWAL) return showToast(`Min withdrawal is ${MIN_WITHDRAWAL} USDT`, "error");
    if (amt > (userData?.withdrawableBalance || 0)) return showToast("Insufficient withdrawable balance", "error");
    await supabase.from('transactions').insert({ user_id: userId, type: 'withdrawal', amount: -amt, status: 'pending', date: new Date().toISOString() });
    await supabase.from('profiles').update({ 
      balance: Number(userData?.balance || 0) - amt, 
      withdrawable_balance: Number(userData?.withdrawableBalance || 0) - amt 
    }).eq('id', userId);
    showToast("Withdrawal pending review", "success"); onClose();
  };
  return (
    <div className="fixed inset-0 z-[110] bg-black/95 p-6 flex items-center justify-center animate-in zoom-in-95">
       <div className="bg-[#0b0f1a] w-full max-w-xs p-6 rounded-3xl border border-white/10 space-y-4 shadow-2xl">
          <div className="flex justify-between items-center"><h3 className="text-white font-black italic uppercase">Withdraw</h3><button onClick={onClose} className="p-2 bg-white/5 rounded-lg"><X size={16}/></button></div>
          <div className="bg-red-500/5 border border-red-500/10 p-3 rounded-xl"><p className="text-[9px] text-red-400 font-black uppercase text-center">Available: {(userData?.withdrawableBalance || 0).toFixed(2)} USDT</p></div>
          <input placeholder="Wallet Address (BEP20)" value={address} onChange={e => setAddress(e.target.value)} className="w-full bg-black/50 border border-white/5 p-3 rounded-xl text-[10px] text-white outline-none" />
          <input type="number" placeholder="Amount" value={amount} onChange={e => setAmount(e.target.value)} className="w-full bg-black/50 border border-white/5 p-3 rounded-xl text-center text-white font-black outline-none" />
          <button onClick={submit} className="w-full bg-white text-black py-3 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl active:scale-95 transition-transform">Confirm Release</button>
       </div>
    </div>
  );
};

const InfoModal = ({ onClose, lang }: any) => (
  <div className="fixed inset-0 z-[250] bg-[#020617]/95 p-10 flex items-center justify-center text-center backdrop-blur-xl animate-in fade-in">
     <div className="space-y-8 max-w-xs">
        <div className="w-20 h-20 bg-blue-600 rounded-3xl mx-auto flex items-center justify-center shadow-[0_0_50px_rgba(37,99,235,0.4)]"><ShieldCheck size={40} className="text-white"/></div>
        <div className="space-y-2">
           <h3 className="text-2xl font-black text-white italic tracking-tighter uppercase">MINE<span className="text-blue-500">PRO</span> ELITE</h3>
           <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-relaxed">Secure Multi-Chain Infrastructure for Automated Digital Asset Mining.</p>
        </div>
        <button onClick={onClose} className="w-full bg-white text-black px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-2xl">Accept Protocol</button>
     </div>
  </div>
);

const ProtocolLoadingScreen = () => <div className="min-h-screen bg-[#020617] flex items-center justify-center flex-col gap-6"><Loader2 className="animate-spin text-blue-500" size={40}/><p className="text-[9px] font-black text-slate-600 tracking-[0.3em] uppercase animate-pulse">Establishing Secure Uplink...</p></div>;
const NavItem = ({ icon: Icon, label, active, onClick }: any) => <button onClick={onClick} className={`flex flex-col items-center gap-1.5 transition-all ${active ? 'text-blue-500' : 'text-slate-700 opacity-60 hover:opacity-100'}`}><Icon size={18}/><span className="text-[7px] font-black uppercase tracking-[0.1em]">{label}</span></button>;

export default App;
