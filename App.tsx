
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
import { TRANSLATIONS, MACHINES, DEPOSIT_ADDRESS, MIN_WITHDRAWAL, ADMIN_EMAIL, NETWORK } from './constants';
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

  // شراء ماكينة
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

  // استلام الربح اليومي
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
  
  // Guard against null userData after session is active but data hasn't loaded or failed
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

// الدعم الفني والمودلز
const SupportChatModal = ({ userId, adminId, onClose, lang }: any) => {
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchMessages = useCallback(async () => {
    if (!userId || !adminId) return;
    const { data } = await supabase.from('support_messages')
      .select('*')
      .or(`and(sender_id.eq.${userId},receiver_id.eq.${adminId}),and(sender_id.eq.${adminId},receiver_id.eq.${userId})`)
      .order('created_at', { ascending: true });
    if (data) setMessages(data);
  }, [userId, adminId]);

  useEffect(() => {
    fetchMessages();
    const sub = supabase.channel(`support-${userId}`).on('postgres_changes', { event: 'INSERT', table: 'support_messages' }, fetchMessages).subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [userId, adminId, fetchMessages]);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages]);

  const send = async () => {
    if (!newMessage.trim() || !userId || !adminId) return;
    const msg = newMessage; setNewMessage('');
    await supabase.from('support_messages').insert({ sender_id: userId, receiver_id: adminId, message: msg });
  };

  return (
    <div className="fixed inset-0 z-[200] bg-[#020617]/98 backdrop-blur-xl flex flex-col animate-in fade-in">
      <div className="p-5 border-b border-white/5 flex justify-between items-center bg-[#0b0f1a]">
        <button onClick={onClose} className="p-2 bg-white/5 rounded-lg"><X size={20}/></button>
        <h3 className="font-black text-white italic">{lang === 'ar' ? 'الدعم المباشر' : 'Live Support'}</h3>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar">
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.sender_id === userId ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] p-3 rounded-2xl text-xs font-bold ${m.sender_id === userId ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white/10 text-slate-200 rounded-tl-none border border-white/5'}`}>{m.message}</div>
          </div>
        ))}
      </div>
      <div className="p-4 bg-[#0b0f1a] flex gap-2">
        <button onClick={send} className="p-3 bg-blue-600 text-white rounded-xl"><Send/></button>
        <input value={newMessage} onChange={e => setNewMessage(e.target.value)} onKeyPress={e => e.key === 'Enter' && send()} placeholder="..." className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 text-white" />
      </div>
    </div>
  );
};

const AdminView = ({ t, showToast, lang, currentAdminId }: any) => {
  const [threads, setThreads] = useState<any[]>([]);
  const [activeChat, setActiveChat] = useState<string | null>(null);

  const fetchThreads = useCallback(async () => {
    const { data: msgs } = await supabase.from('support_messages').select('*').order('created_at', { ascending: false });
    const { data: users } = await supabase.from('profiles').select('*');
    if (msgs && users) {
       const userIds = Array.from(new Set(msgs.map(m => m.sender_id === currentAdminId ? m.receiver_id : m.sender_id))).filter(id => id !== currentAdminId);
       const threadList = userIds.map(uid => {
          const user = users.find(u => u.id === uid);
          const last = msgs.find(m => m.sender_id === uid || m.receiver_id === uid);
          return { userId: uid, name: user?.first_name, lastMsg: last?.message, date: last?.created_at };
       });
       setThreads(threadList);
    }
  }, [currentAdminId]);

  useEffect(() => { fetchThreads(); }, [fetchThreads]);

  return (
    <div className="space-y-6">
       <h2 className="text-xl font-black text-white px-2">SUPPORT REQUESTS</h2>
       {activeChat && (
         <div className="fixed inset-0 z-[250] bg-black/95 flex flex-col">
            <div className="p-4 border-b border-white/5 flex justify-between"><button onClick={() => setActiveChat(null)}><X/></button><span>Chat</span></div>
            <div className="flex-1"><SupportChatModal userId={activeChat} adminId={currentAdminId} onClose={() => setActiveChat(null)} lang={lang} /></div>
         </div>
       )}
       <div className="space-y-3">
          {threads.map(t => (
            <div key={t.userId} onClick={() => setActiveChat(t.userId)} className="bg-[#0b0f1a] p-4 rounded-xl border border-white/5 flex justify-between cursor-pointer">
               <div><p className="text-white font-black text-sm">{t.name}</p><p className="text-[10px] text-slate-500 truncate">{t.lastMsg}</p></div>
               <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
            </div>
          ))}
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
          <div className="text-center"><h1 className="text-3xl font-black text-white">MINEPRO</h1></div>
          <form onSubmit={handleAuth} className="bg-[#0b0f1a] p-6 rounded-3xl border border-white/10 space-y-4 shadow-2xl">
             <div className="flex p-1 bg-black/50 rounded-xl mb-4">
                <button type="button" onClick={() => setIsLogin(true)} className={`flex-1 py-2 rounded-lg text-xs font-black ${isLogin ? 'bg-blue-600 text-white' : 'text-slate-600'}`}>LOGIN</button>
                <button type="button" onClick={() => setIsLogin(false)} className={`flex-1 py-2 rounded-lg text-xs font-black ${!isLogin ? 'bg-blue-600 text-white' : 'text-slate-600'}`}>SIGNUP</button>
             </div>
             {!isLogin && <input placeholder="First Name" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} className="w-full bg-[#020617] p-3 rounded-xl text-xs text-white" />}
             <input placeholder="Email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full bg-[#020617] p-3 rounded-xl text-xs text-white" />
             <input type="password" placeholder="Password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full bg-[#020617] p-3 rounded-xl text-xs text-white" />
             <button className="w-full bg-white text-black font-black py-3 rounded-xl text-xs uppercase shadow-xl">SUBMIT</button>
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
    await supabase.from('transactions').insert({ user_id: userId, type: 'deposit', amount: Number(amount), proof_url: image });
    showToast("Sent for review", "success"); onClose();
  };
  return (
    <div className="fixed inset-0 z-[110] bg-black/95 p-6 flex items-center justify-center">
       <div className="bg-[#0b0f1a] w-full max-w-xs p-6 rounded-3xl border border-white/10 space-y-4 shadow-2xl">
          <div className="flex justify-between items-center"><h3 className="text-white font-black">DEPOSIT</h3><button onClick={onClose}><X/></button></div>
          <div className="p-3 bg-white/5 rounded-xl text-[10px] break-all font-mono text-center border border-white/5">{DEPOSIT_ADDRESS}</div>
          <input type="number" placeholder="Amount" value={amount} onChange={e => setAmount(e.target.value)} className="w-full bg-black/50 p-3 rounded-xl text-white text-center" />
          <input placeholder="Base64 Image Data" value={image} onChange={e => setImage(e.target.value)} className="w-full bg-black/50 p-3 rounded-xl text-[10px] text-white" />
          <button onClick={submit} className="w-full bg-blue-600 py-3 rounded-xl font-black text-white text-xs">SUBMIT PROOF</button>
       </div>
    </div>
  );
};

const WithdrawModal = ({ onClose, userData, userId, showToast, lang }: any) => {
  const [amount, setAmount] = useState('');
  const [address, setAddress] = useState('');
  const submit = async () => {
    const amt = Number(amount);
    if (amt < MIN_WITHDRAWAL || amt > (userData?.withdrawableBalance || 0)) return showToast("Invalid amount", "error");
    await supabase.from('transactions').insert({ user_id: userId, type: 'withdrawal', amount: -amt, status: 'pending' });
    await supabase.from('profiles').update({ balance: Number(userData?.balance || 0) - amt, withdrawable_balance: Number(userData?.withdrawableBalance || 0) - amt }).eq('id', userId);
    showToast("Withdrawal pending", "success"); onClose();
  };
  return (
    <div className="fixed inset-0 z-[110] bg-black/95 p-6 flex items-center justify-center">
       <div className="bg-[#0b0f1a] w-full max-w-xs p-6 rounded-3xl border border-white/10 space-y-4 shadow-2xl">
          <div className="flex justify-between items-center"><h3 className="text-white font-black">WITHDRAW</h3><button onClick={onClose}><X/></button></div>
          <input placeholder="Wallet Address" value={address} onChange={e => setAddress(e.target.value)} className="w-full bg-black/50 p-3 rounded-xl text-xs text-white" />
          <input type="number" placeholder="Amount" value={amount} onChange={e => setAmount(e.target.value)} className="w-full bg-black/50 p-3 rounded-xl text-center text-white" />
          <button onClick={submit} className="w-full bg-red-600 py-3 rounded-xl font-black text-white text-xs">CONFIRM WITHDRAW</button>
       </div>
    </div>
  );
};

const InfoModal = ({ onClose, lang }: any) => (
  <div className="fixed inset-0 z-[250] bg-black/90 p-10 flex items-center justify-center text-center">
     <div className="space-y-6">
        <h3 className="text-2xl font-black text-white italic">V-PROTOCOL</h3>
        <p className="text-xs text-slate-400">Our platform bridges the gap between digital assets and liquidity.</p>
        <button onClick={onClose} className="bg-white text-black px-8 py-3 rounded-xl font-black text-xs">CONTINUE</button>
     </div>
  </div>
);

const ProtocolLoadingScreen = () => <div className="min-h-screen bg-[#020617] flex items-center justify-center flex-col gap-4"><Loader2 className="animate-spin text-blue-500" size={32}/><p className="text-[10px] font-black text-slate-600 tracking-widest uppercase">Initializing Protocol...</p></div>;
const NavItem = ({ icon: Icon, label, active, onClick }: any) => <button onClick={onClick} className={`flex flex-col items-center gap-1 ${active ? 'text-blue-500' : 'text-slate-700'}`}><Icon size={18}/><span className="text-[8px] font-black uppercase tracking-widest">{label}</span></button>;

export default App;
